import Parser from 'rss-parser';
import { logger } from '../../utils/logger.js';
import { YouTubeConfig } from '../../config/sources.js';

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['yt:videoId', 'videoId'],
    ],
  },
});

export interface YouTubeVideo {
  title: string;
  content: string;
  author?: string;
  publishedAt: Date;
  url?: string;
}

export async function fetchYouTubeFeed(config: YouTubeConfig): Promise<YouTubeVideo[]> {
  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${config.channelId}`;
    logger.info(`Fetching YouTube feed: ${feedUrl}`);

    const feed = await parser.parseURL(feedUrl);

    return feed.items.map((item: any) => ({
      title: item.title || 'Untitled Video',
      content: item.contentSnippet || item.content || '',
      author: item.author || feed.title || undefined,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      url: item.link || `https://www.youtube.com/watch?v=${item.videoId}`,
    }));
  } catch (error) {
    logger.error(`Error fetching YouTube feed for channel ${config.channelId}:`, error);
    throw new Error(`Failed to fetch YouTube feed: ${error}`);
  }
}

export default { fetchYouTubeFeed };
