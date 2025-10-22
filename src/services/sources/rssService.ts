import Parser from 'rss-parser';
import { logger } from '../../utils/logger.js';
import { RSSConfig } from '../../config/sources.js';

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [['media:content', 'mediaContent']],
  },
});

export interface RSSItem {
  title: string;
  content: string;
  author?: string;
  publishedAt: Date;
  url?: string;
}

export async function fetchRSSFeed(config: RSSConfig): Promise<RSSItem[]> {
  try {
    logger.info(`Fetching RSS feed: ${config.feedUrl}`);
    const feed = await parser.parseURL(config.feedUrl);

    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || (item as any).description || '',
      author: (item as any).creator || (item as any).author || undefined,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      url: item.link || undefined,
    }));
  } catch (error) {
    logger.error(`Error fetching RSS feed ${config.feedUrl}:`, error);
    throw new Error(`Failed to fetch RSS feed: ${error}`);
  }
}

export default { fetchRSSFeed };
