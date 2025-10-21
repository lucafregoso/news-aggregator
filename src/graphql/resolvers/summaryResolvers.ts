import { generateSummary, getSavedSummaries, getSavedSummary, cleanOldSummaries } from '../../services/summaryService.js';
import { createSummaryJob, getJobStatus } from '../../services/jobService.js';
import { logger } from '../../utils/logger.js';

export const summaryResolvers = {
  Query: {
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
        logger.info('Generating summary', { startDate, endDate, topics });

        const summary = await generateSummary({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          topics,
          forceRefresh,
        });

        return summary;
      } catch (error) {
        logger.error('Error generating summary:', error);
        throw new Error(`Failed to generate summary: ${error}`);
      }
    },

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

    savedSummary: async (_: any, { id }: { id: string }) => {
      try {
        const summary = await getSavedSummary(id);
        return summary;
      } catch (error) {
        logger.error('Error fetching saved summary:', error);
        throw new Error('Failed to fetch saved summary');
      }
    },

    // NUOVO - Status job
    summaryJobStatus: async (_: any, { jobId }: { jobId: string }) => {
      try {
        logger.info('Getting job status:', { jobId });

        const status = await getJobStatus(jobId);

        if (!status) {
          logger.error('Job not found:', { jobId });
          throw new Error(`Job ${jobId} not found`);
        }

        logger.info('Job status retrieved:', { jobId, status: status.status });
        return status;
      } catch (error) {
        logger.error('Error fetching job status:', error);
        throw error;
      }
    },
  },

  Mutation: {
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

    // NUOVO - Crea job async
    generateSummaryAsync: async (
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
        logger.info('🚀 Creating summary job...', { startDate, endDate, topics });

        // ✅ VERIFICA CHE FUNZIONE ESISTA
        if (!createSummaryJob) {
          logger.error('❌ createSummaryJob function not found!');
          throw new Error('Job service not initialized');
        }

        // ✅ CHIAMA FUNZIONE
        const jobId = await createSummaryJob({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          topics,
        });

        logger.info('✅ Job created successfully!', { jobId });

        // ✅ RITORNA OGGETTO VALIDO (non null!)
        const response = {
          jobId,
          status: 'QUEUED',
        };

        logger.info('📤 Returning response:', response);
        return response;
      } catch (error) {
        logger.error('❌ FATAL ERROR in generateSummaryAsync:', error);
        throw error;
      }
    },
  },
};

export default summaryResolvers;
