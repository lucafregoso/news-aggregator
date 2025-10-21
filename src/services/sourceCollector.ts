import { prisma } from '../config/database.js';
import { SourceType } from '../config/sources.js';
import { fetchRSSFeed } from './sources/rssService.js';
import { fetchYouTubeFeed } from './sources/youtubeService.js';
import { fetchIMAPEmails } from './sources/imapService.js';
import { extractTopicAndMacroTopic } from './dataExtractor.js';
import { logger } from '../utils/logger.js';

export interface CollectionResult {
  sourceId: string;
  sourceName: string;
  newArticles: number;
  errors: string[];
}

export async function collectFromSource(sourceId: string): Promise<CollectionResult> {
  const result: CollectionResult = {
    sourceId,
    sourceName: '',
    newArticles: 0,
    errors: [],
  };

  try {
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
    });

    if (!source || !source.active) {
      result.errors.push('Source not found or inactive');
      return result;
    }

    result.sourceName = source.name;

    let items: any[] = [];

    switch (source.type) {
      case SourceType.RSS:
        items = await fetchRSSFeed(source.config as any);
        break;
      case SourceType.YOUTUBE:
        items = await fetchYouTubeFeed(source.config as any);
        break;
      case SourceType.IMAP:
        items = await fetchIMAPEmails(source.config as any);
        break;
      default:
        result.errors.push(`Unsupported source type: ${source.type}`);
        return result;
    }

    logger.info(`Collected ${items.length} items from ${source.name}`);

    for (const item of items) {
      try {
        const existing = await prisma.article.findFirst({
          where: {
            sourceId: source.id,
            title: item.title,
            publishedAt: item.publishedAt,
          },
        });

        if (existing) {
          continue;
        }

        const { topic, macroTopic } = await extractTopicAndMacroTopic(
          item.title,
          item.content
        );

        await prisma.article.create({
          data: {
            sourceId: source.id,
            title: item.title,
            content: item.content,
            author: item.author,
            publishedAt: item.publishedAt,
            topic,
            macroTopic,
            url: item.url,
          },
        });

        result.newArticles++;
      } catch (error) {
        logger.error(`Error processing item from ${source.name}:`, error);
        result.errors.push(`Failed to process item: ${item.title}`);
      }
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastChecked: new Date() },
    });

    logger.info(`Saved ${result.newArticles} new articles from ${source.name}`);
  } catch (error) {
    logger.error(`Error collecting from source ${sourceId}:`, error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

export async function collectFromAllSources(): Promise<CollectionResult[]> {
  const sources = await prisma.source.findMany({
    where: { active: true },
  });

  logger.info(`Collecting from ${sources.length} active sources`);

  const results = await Promise.all(
    sources.map((source) => collectFromSource(source.id))
  );

  const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
  logger.info(`Collection complete. Total new articles: ${totalNew}`);

  return results;
}

export default {
  collectFromSource,
  collectFromAllSources,
};
