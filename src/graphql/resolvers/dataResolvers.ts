import { prisma } from '../../config/database.js';
import { collectFromSource, collectFromAllSources, processPendingTopics } from '../../services/sourceCollector.js';
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
    pendingTopicsCount: async () => {
      try {
        const count = await prisma.article.count({
          where: {
            OR: [
              { topic: 'pending' },
              { macroTopic: 'pending' },
            ],
          },
        });

        logger.info(`Pending topics count: ${count}`);
        return count;  // ✅ Ritorna numero, non null!
      } catch (error) {
        logger.error('Error counting pending topics:', error);
        return 0;  // ✅ Ritorna 0 in caso di errore
      }
    },
  },

  Mutation: {
    // AGGIORNATO: supporta fast mode e full mode
    checkSources: async (
      _: any,
      {
        sourceIds,
        fastMode,
      }: {
        sourceIds?: string[];
        fastMode?: boolean;
      }
    ) => {
      try {
        const extractTopicsImmediately = !fastMode; // default: fast mode

        logger.info(`Starting source check in ${fastMode ? 'FAST' : 'FULL'} mode`);

        let results;

        if (sourceIds && sourceIds.length > 0) {
          results = await Promise.all(
            sourceIds.map((id) =>
              collectFromSource(id, {
                extractTopicsImmediately,
                timeout: 30000,
              })
            )
          );
        } else {
          results = await collectFromAllSources({
            extractTopicsImmediately,
            timeout: 30000,
          });
        }

        const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
        const totalPending = results.reduce((sum, r) => sum + r.pendingTopicExtraction, 0);
        const allErrors = results.flatMap((r) => r.errors);

        return {
          checkedSources: results.length,
          newArticles: totalNew,
          pendingTopicExtraction: totalPending,
          errors: allErrors,
        };
      } catch (error) {
        logger.error('Error checking sources:', error);
        throw new Error('Failed to check sources');
      }
    },
    processPendingTopics: async (_: any, { batchSize }: { batchSize?: number }) => {
      try {
        const processed = await processPendingTopics(batchSize || 50);
        logger.info(`Processed ${processed} pending topics`);
        return processed;
      } catch (error) {
        logger.error('Error processing pending topics:', error);
        throw new Error('Failed to process pending topics');
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
