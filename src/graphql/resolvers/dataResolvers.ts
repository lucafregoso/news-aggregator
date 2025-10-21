import { prisma } from '../../config/database.js';
import { collectFromSource, collectFromAllSources } from '../../services/sourceCollector.js';
import { logger } from '../../utils/logger.js';

export const dataResolvers = {
  Query: {
    articles: async (
      _: any,
      {
        startDate,
        endDate,
        topics,
      }: {
        startDate: string;
        endDate: string;
        topics?: string[];
      }
    ) => {
      try {
        const articles = await prisma.article.findMany({
          where: {
            publishedAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
            ...(topics && topics.length > 0 ? { topic: { in: topics } } : {}),
          },
          include: {
            source: true,
          },
          orderBy: {
            publishedAt: 'desc',
          },
        });

        return articles;
      } catch (error) {
        logger.error('Error fetching articles:', error);
        throw new Error('Failed to fetch articles');
      }
    },
  },

  Mutation: {
    checkSources: async (_: any, { sourceIds }: { sourceIds?: string[] }) => {
      try {
        let results;

        if (sourceIds && sourceIds.length > 0) {
          results = await Promise.all(sourceIds.map((id) => collectFromSource(id)));
        } else {
          results = await collectFromAllSources();
        }

        const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
        const allErrors = results.flatMap((r) => r.errors);

        return {
          checkedSources: results.length,
          newArticles: totalNew,
          errors: allErrors,
        };
      } catch (error) {
        logger.error('Error checking sources:', error);
        throw new Error('Failed to check sources');
      }
    },
  },

  Article: {
    source: async (parent: any) => {
      return await prisma.source.findUnique({
        where: { id: parent.sourceId },
      });
    },
  },
};

export default dataResolvers;
