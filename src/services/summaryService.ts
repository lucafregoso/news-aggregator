import { prisma } from '../config/database.js';
import { summarizeArticles, clusterArticlesByTopic } from './llmService.js';
import { logger } from '../utils/logger.js';

export interface SummaryRequest {
  startDate: Date;
  endDate: Date;
  topics?: string[];
  forceRefresh?: boolean;
}

export interface TopicSummary {
  topic: string;
  summary: string;
  articles: any[];
  sources: any[];
  count: number;
}

export interface Summary {
  id?: string;
  topics: TopicSummary[];
  totalArticles: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  articleIds?: string[];
}

if (!prisma) {
  logger.error('❌ CRITICAL: Prisma client is undefined!');
  throw new Error('Prisma client not initialized');
}

async function getCachedSummary(request: SummaryRequest): Promise<Summary | null> {
  try {
    if (!prisma?.summary) return null;

    const cached = await prisma.summary.findFirst({
      where: {
        startDate: request.startDate,
        endDate: request.endDate,
        queryTopics: { equals: request.topics || [] },
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!cached) return null;

    const newArticlesCount = await prisma.article.count({
      where: {
        publishedAt: { gte: request.startDate, lte: request.endDate },
        extractedAt: { gt: cached.generatedAt },
        ...(request.topics?.length ? { topic: { in: request.topics } } : {}),
      },
    });

    if (newArticlesCount > 0) {
      logger.info(`Cache invalidated: ${newArticlesCount} new articles`);
      return null;
    }

    logger.info('Using cached summary', { id: cached.id });
    return {
      id: cached.id,
      topics: cached.topics as unknown as TopicSummary[],
      totalArticles: cached.totalArticles,
      timeRange: { startDate: cached.startDate, endDate: cached.endDate },
      generatedAt: cached.generatedAt,
      articleIds: cached.articleIds,
    };
  } catch (error) {
    logger.error('Error checking cache:', error);
    return null;
  }
}

async function saveSummary(summary: Summary): Promise<string> {
  try {
    if (!prisma?.summary) {
      logger.warn('Summary model not available');
      return 'temp-id-' + Date.now();
    }

    logger.info('💾 Saving summary...');
    const saved = await prisma.summary.create({
      data: {
        startDate: summary.timeRange.startDate,
        endDate: summary.timeRange.endDate,
        topics: summary.topics as any,
        totalArticles: summary.totalArticles,
        articleIds: summary.articleIds || [],
        queryTopics: [],
      },
    });

    logger.info('✅ Summary saved to DB:', { id: saved.id });
    return saved.id;
  } catch (error) {
    logger.error('Error saving summary:', error);
    throw error;
  }
}

// ✅ FUNZIONE INTERNA - Usata sia da generateSummary che dal Job Worker
export async function generateSummaryInternal(
  startDate: Date,
  endDate: Date,
  topics?: string[],
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<Summary> {
  const startTime = Date.now();

  try {
    if (!prisma?.article) {
      throw new Error('Database not initialized');
    }

    logger.info('🔄 Generating summary', { startDate, endDate });

    const MAX_ARTICLES = 100;

    logger.info('🔍 Fetching articles...');
    const articles = await prisma.article.findMany({
      where: {
        publishedAt: { gte: startDate, lte: endDate },
        ...(topics?.length ? { topic: { in: topics } } : {}),
      },
      include: { source: true },
      orderBy: { publishedAt: 'desc' },
      take: MAX_ARTICLES,
    });

    logger.info(`✅ Found ${articles.length} articles`);

    if (articles.length === 0) {
      return {
        topics: [],
        totalArticles: 0,
        timeRange: { startDate, endDate },
        generatedAt: new Date(),
        articleIds: [],
      };
    }

    logger.info('🎯 Clustering articles...');
    const clusters = await clusterArticlesByTopic(
      articles.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        topic: a.topic,
      }))
    );

    const totalTopics = clusters.size;
    logger.info(`✅ Clustering complete: ${totalTopics} topics`);

    const topicSummaries: TopicSummary[] = [];
    let processedCount = 0;

    const topicsArray = Array.from(clusters.entries());

    for (let i = 0; i < topicsArray.length; i++) {
      const [topic, articleIds] = topicsArray[i];

      try {
        logger.info(`📝 [${i + 1}/${totalTopics}] Processing: "${topic.substring(0, 50)}"`);

        const topicArticles = articles.filter((a) => articleIds.includes(a.id));

        logger.info(`  → Calling Ollama...`);
        const summaryText = await summarizeArticles(
          topicArticles.map((a) => ({
            title: a.title,
            content: a.content,
            author: a.author ?? undefined,
          }))
        );

        logger.info(`  ✅ Generated (${summaryText.length} chars)`);

        const uniqueSources = Array.from(
          new Map(topicArticles.map((a) => [a.source.id, a.source])).values()
        );

        topicSummaries.push({
          topic,
          summary: summaryText,
          articles: topicArticles,
          sources: uniqueSources,
          count: topicArticles.length,
        });

        processedCount++;

        // ✅ Chiama callback onProgress se provided (da job worker)
        if (onProgress) {
          await onProgress(processedCount, totalTopics);
        }
      } catch (error) {
        logger.error(`❌ ERROR processing topic:`, error);
        topicSummaries.push({
          topic,
          summary: `[Error: ${error}]`,
          articles: [],
          sources: [],
          count: 0,
        });
      }
    }

    logger.info(`✅ Processing complete: ${processedCount}/${totalTopics} topics`);

    const summary: Summary = {
      topics: topicSummaries,
      totalArticles: articles.length,
      timeRange: { startDate, endDate },
      generatedAt: new Date(),
      articleIds: articles.map((a) => a.id),
    };

    const duration = Date.now() - startTime;
    logger.info(`🎉 Complete! Duration: ${(duration / 1000).toFixed(1)}s`);

    return summary;
  } catch (error) {
    logger.error('❌ FATAL in generateSummary:', error);
    throw error;
  }
}

// ✅ LEGACY API - Mantiene compatibilità
export async function generateSummary(request: SummaryRequest): Promise<Summary> {
  if (!request.forceRefresh) {
    const cached = await getCachedSummary(request);
    if (cached) return cached;
  }

  const summary = await generateSummaryInternal(
    request.startDate,
    request.endDate,
    request.topics
  );

  try {
    const summaryId = await saveSummary(summary);
    summary.id = summaryId;
  } catch (error) {
    logger.warn('Could not save summary to cache');
  }

  return summary;
}

export async function getSavedSummaries(
  startDate?: Date,
  endDate?: Date,
  limit: number = 10
): Promise<Summary[]> {
  try {
    if (!prisma?.summary) return [];

    const summaries = await prisma.summary.findMany({
      where: {
        ...(startDate ? { startDate: { gte: startDate } } : {}),
        ...(endDate ? { endDate: { lte: endDate } } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });

    return summaries.map((s) => ({
      id: s.id,
      topics: s.topics as unknown as TopicSummary[],
      totalArticles: s.totalArticles,
      timeRange: { startDate: s.startDate, endDate: s.endDate },
      generatedAt: s.generatedAt,
      articleIds: s.articleIds,
    }));
  } catch (error) {
    logger.error('Error fetching summaries:', error);
    return [];
  }
}

export async function getSavedSummary(id: string): Promise<Summary | null> {
  try {
    if (!prisma?.summary) return null;

    const summary = await prisma.summary.findUnique({ where: { id } });
    if (!summary) return null;

    return {
      id: summary.id,
      topics: summary.topics as unknown as TopicSummary[],
      totalArticles: summary.totalArticles,
      timeRange: { startDate: summary.startDate, endDate: summary.endDate },
      generatedAt: summary.generatedAt,
      articleIds: summary.articleIds,
    };
  } catch (error) {
    logger.error('Error fetching summary:', error);
    return null;
  }
}

export async function cleanOldSummaries(olderThanDays: number): Promise<number> {
  try {
    if (!prisma?.summary) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await prisma.summary.deleteMany({
      where: { generatedAt: { lt: cutoff } },
    });

    logger.info(`Deleted ${result.count} old summaries`);
    return result.count;
  } catch (error) {
    logger.error('Error cleaning summaries:', error);
    return 0;
  }
}

export default {
  generateSummary,
  generateSummaryInternal,
  getSavedSummaries,
  getSavedSummary,
  cleanOldSummaries,
};
