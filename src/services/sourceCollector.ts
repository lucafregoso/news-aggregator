import { prisma } from '../config/database.js';
import { SourceType } from '../config/sources.js';
import { fetchRSSFeed } from './sources/rssService.js';
import { fetchYouTubeFeed } from './sources/youtubeService.js';
import { fetchIMAPEmails } from './sources/imapService.js';
import { extractTopicsInBatch } from './dataExtractor.js';
import { logger } from '../utils/logger.js';

export interface CollectionResult {
  sourceId: string;
  sourceName: string;
  newArticles: number;
  pendingTopicExtraction: number;
  errors: string[];
  duration: number;
}

// NUOVO: Parametro per modalità veloce
export interface CollectionOptions {
  extractTopicsImmediately?: boolean; // default: false
  timeout?: number; // ms, default: 30000
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

export async function collectFromSource(
  sourceId: string,
  options: CollectionOptions = {}
): Promise<CollectionResult> {
  const startTime = Date.now();
  const {
    extractTopicsImmediately = false,
    timeout = 30000,
  } = options;

  const result: CollectionResult = {
    sourceId,
    sourceName: '',
    newArticles: 0,
    pendingTopicExtraction: 0,
    errors: [],
    duration: 0,
  };

  try {
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
    });

    if (!source || !source.active) {
      result.errors.push('Source not found or inactive');
      result.duration = Date.now() - startTime;
      return result;
    }

    result.sourceName = source.name;
    logger.info(`📡 Collecting from: ${source.name} (${source.type})`);

    let items: any[] = [];

    // Fetch con timeout
    try {
      switch (source.type) {
        case SourceType.RSS:
          items = await withTimeout(
            fetchRSSFeed(source.config as any),
            timeout,
            `RSS feed timeout for ${source.name}`
          );
          break;
        case SourceType.YOUTUBE:
          items = await withTimeout(
            fetchYouTubeFeed(source.config as any),
            timeout,
            `YouTube feed timeout for ${source.name}`
          );
          break;
        case SourceType.IMAP:
          items = await withTimeout(
            fetchIMAPEmails(source.config as any),
            timeout,
            `IMAP timeout for ${source.name}`
          );
          break;
        default:
          result.errors.push(`Unsupported source type: ${source.type}`);
          result.duration = Date.now() - startTime;
          return result;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error fetching from ${source.name}:`, errorMsg);
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
      return result;
    }

    logger.info(`✓ Collected ${items.length} items from ${source.name}`);

    if (items.length === 0) {
      await prisma.source.update({
        where: { id: source.id },
        data: { lastChecked: new Date() },
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    // Filtra duplicati esistenti
    const newItems: any[] = [];
    for (const item of items) {
      const existing = await prisma.article.findFirst({
        where: {
          sourceId: source.id,
          title: item.title,
          publishedAt: item.publishedAt,
        },
      });

      if (!existing) {
        newItems.push(item);
      }
    }

    logger.info(`📝 Found ${newItems.length} new items (${items.length - newItems.length} duplicates)`);

    if (newItems.length === 0) {
      await prisma.source.update({
        where: { id: source.id },
        data: { lastChecked: new Date() },
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    // MODALITÀ 1: VELOCE - Salva senza topic, estrai dopo
    if (!extractTopicsImmediately) {
      logger.info(`⚡ Fast mode: Saving ${newItems.length} articles without topics`);

      for (const item of newItems) {
        try {
          await prisma.article.create({
            data: {
              sourceId: source.id,
              title: item.title,
              content: item.content,
              author: item.author,
              publishedAt: item.publishedAt,
              topic: 'pending', // Placeholder
              macroTopic: 'pending', // Placeholder
              url: item.url,
            },
          });
          result.newArticles++;
        } catch (error) {
          logger.error(`Error saving article:`, error);
          result.errors.push(`Failed to save: ${item.title}`);
        }
      }

      result.pendingTopicExtraction = result.newArticles;
      logger.info(`✅ Saved ${result.newArticles} articles. Topics will be extracted in background.`);
    }
    // MODALITÀ 2: COMPLETA - Estrai topic in batch prima di salvare
    else {
      logger.info(`🧠 Full mode: Extracting topics in batch for ${newItems.length} articles`);

      try {
        // ESTRAZIONE IN BATCH (molto più veloce!)
        const extractedTopics = await withTimeout(
          extractTopicsInBatch(newItems),
          60000,
          'Topic extraction timeout'
        );

        // Salva con topic
        for (let i = 0; i < newItems.length; i++) {
          const item = newItems[i];
          const topics = extractedTopics[i] || { topic: 'General', macroTopic: 'News' };

          try {
            await prisma.article.create({
              data: {
                sourceId: source.id,
                title: item.title,
                content: item.content,
                author: item.author,
                publishedAt: item.publishedAt,
                topic: topics.topic,
                macroTopic: topics.macroTopic,
                url: item.url,
              },
            });
            result.newArticles++;
          } catch (error) {
            logger.error(`Error saving article:`, error);
            result.errors.push(`Failed to save: ${item.title}`);
          }
        }

        logger.info(`✅ Saved ${result.newArticles} articles with topics`);
      } catch (error) {
        logger.error(`❌ Topic extraction failed:`, error);
        result.errors.push('Topic extraction failed, articles not saved');
      }
    }

    // Aggiorna lastChecked
    await prisma.source.update({
      where: { id: source.id },
      data: { lastChecked: new Date() },
    });

    result.duration = Date.now() - startTime;
    logger.info(`⏱️  Collection completed in ${result.duration}ms`);
  } catch (error) {
    logger.error(`Error collecting from source ${sourceId}:`, error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.duration = Date.now() - startTime;
  }

  return result;
}

export async function collectFromAllSources(
  options: CollectionOptions = {}
): Promise<CollectionResult[]> {
  const sources = await prisma.source.findMany({
    where: { active: true },
  });

  logger.info(`🔄 Starting collection from ${sources.length} active sources`);

  const results = await Promise.all(
    sources.map((source) => collectFromSource(source.id, options))
  );

  const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
  const totalPending = results.reduce((sum, r) => sum + r.pendingTopicExtraction, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  logger.info(`📊 Collection summary:`);
  logger.info(`   ✓ New articles: ${totalNew}`);
  logger.info(`   ⏳ Pending topic extraction: ${totalPending}`);
  logger.info(`   ❌ Errors: ${totalErrors}`);

  return results;
}

// NUOVO: Job in background per estrarre topic degli articoli pending
export async function processPendingTopics(batchSize: number = 50): Promise<number> {
  logger.info('🔄 Processing pending topic extractions...');

  const pendingArticles = await prisma.article.findMany({
    where: {
      OR: [
        { topic: 'pending' },
        { macroTopic: 'pending' },
      ],
    },
    take: batchSize,
  });

  if (pendingArticles.length === 0) {
    logger.info('✓ No pending articles to process');
    return 0;
  }

  logger.info(`📝 Processing ${pendingArticles.length} pending articles`);

  try {
    const extractedTopics = await extractTopicsInBatch(
      pendingArticles.map((a) => ({
        title: a.title,
        content: a.content,
      }))
    );

    let updated = 0;
    for (let i = 0; i < pendingArticles.length; i++) {
      const article = pendingArticles[i];
      const topics = extractedTopics[i] || { topic: 'General', macroTopic: 'News' };

      await prisma.article.update({
        where: { id: article.id },
        data: {
          topic: topics.topic,
          macroTopic: topics.macroTopic,
        },
      });
      updated++;
    }

    logger.info(`✅ Updated ${updated} articles with topics`);
    return updated;
  } catch (error) {
    logger.error('❌ Error processing pending topics:', error);
    throw error;
  }
}

export default {
  collectFromSource,
  collectFromAllSources,
  processPendingTopics,
};
