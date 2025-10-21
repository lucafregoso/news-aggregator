import { generateSummary } from '../../services/summaryService.js';
import { logger } from '../../utils/logger.js';

export const summaryResolvers = {
  Query: {
    summary: async (
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
        logger.info('Generating summary', { startDate, endDate, topics });

        const summary = await generateSummary({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          topics,
        });

        return summary;
      } catch (error) {
        logger.error('Error generating summary:', error);
        throw new Error('Failed to generate summary');
      }
    },
  },
};

export default summaryResolvers;
