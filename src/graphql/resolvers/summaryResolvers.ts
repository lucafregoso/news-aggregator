import {
  generateSummary,
  getSavedSummaries,
  getSavedSummary,
  cleanOldSummaries,
} from '../../services/summaryService.js';
import { logger } from '../../utils/logger.js';

export const summaryResolvers = {
  Query: {
    // Query principale - usa cache automaticamente
    summary: async (
      _: any,
      {
        startDate,
        endDate,
        topics,
        forceRefresh,
      }: {
        startDate: string;
        endDate: string;
        topics?: string[];
        forceRefresh?: boolean;
      }
    ) => {
      try {
        logger.info('Generating summary', {
          startDate,
          endDate,
          topics,
          forceRefresh,
        });

        const summary = await generateSummary({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          topics,
          forceRefresh,
        });

        return summary;
      } catch (error) {
        logger.error('Error generating summary:', error);
        throw new Error('Failed to generate summary');
      }
    },

    // NUOVO: Lista riepiloghi salvati
    summaries: async (
      _: any,
      {
        startDate,
        endDate,
        limit,
      }: {
        startDate?: string;
        endDate?: string;
        limit?: number;
      }
    ) => {
      try {
        const summaries = await getSavedSummaries(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined,
          limit || 10
        );

        return summaries;
      } catch (error) {
        logger.error('Error fetching summaries:', error);
        throw new Error('Failed to fetch summaries');
      }
    },

    // NUOVO: Singolo riepilogo salvato
    savedSummary: async (_: any, { id }: { id: string }) => {
      try {
        const summary = await getSavedSummary(id);
        return summary;
      } catch (error) {
        logger.error('Error fetching saved summary:', error);
        throw new Error('Failed to fetch saved summary');
      }
    },
  },

  Mutation: {
    // NUOVO: Pulisci riepiloghi vecchi
    cleanOldSummaries: async (_: any, { olderThanDays }: { olderThanDays: number }) => {
      try {
        const deleted = await cleanOldSummaries(olderThanDays);
        logger.info(`Cleaned ${deleted} old summaries`);
        return deleted;
      } catch (error) {
        logger.error('Error cleaning old summaries:', error);
        throw new Error('Failed to clean old summaries');
      }
    },
  },
};

export default summaryResolvers;
