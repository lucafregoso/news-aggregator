import { prisma } from '../config/database.js';
import { summarizeArticles, clusterArticlesByTopic } from './llmService.js';
import { logger } from '../utils/logger.js';

export interface SummaryRequest {
  startDate: Date;
  endDate: Date;
  topics?: string[];
}

export interface TopicSummary {
  topic: string;
  summary: string;
  articles: any[];
  sources: any[];
  count: number;
}

export interface Summary {
  topics: TopicSummary[];
  totalArticles: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
}

export async function generateSummary(request: SummaryRequest): Promise<Summary> {
  try {
    logger.info('Generating summary for date range', {
      startDate: request.startDate,
      endDate: request.endDate,
    });

    const articles = await prisma.article.findMany({
      where: {
        publishedAt: {
          gte: request.startDate,
          lte: request.endDate,
        },
        ...(request.topics && request.topics.length > 0
          ? { topic: { in: request.topics } }
          : {}),
      },
      include: {
        source: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    if (articles.length === 0) {
      return {
        topics: [],
        totalArticles: 0,
        timeRange: {
          startDate: request.startDate,
          endDate: request.endDate,
        },
        generatedAt: new Date(),
      };
    }

    const clusters = await clusterArticlesByTopic(
      articles.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        topic: a.topic,
      }))
    );

    const topicSummaries: TopicSummary[] = [];

    for (const [topic, articleIds] of clusters.entries()) {
      const topicArticles = articles.filter((a) => articleIds.includes(a.id));

      const summaryText = await summarizeArticles(
        topicArticles.map((a) => ({
          title: a.title,
          content: a.content,
          author: a.author || undefined,
        }))
      );

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
    }

    return {
      topics: topicSummaries,
      totalArticles: articles.length,
      timeRange: {
        startDate: request.startDate,
        endDate: request.endDate,
      },
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error('Error generating summary:', error);
    throw new Error('Failed to generate summary');
  }
}

export default { generateSummary };
