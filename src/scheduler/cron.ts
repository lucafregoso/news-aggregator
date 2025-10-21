import cron from 'node-cron';
import { collectFromAllSources } from '../services/sourceCollector.js';
import { logger } from '../utils/logger.js';

const CHECK_INTERVAL = process.env.CHECK_INTERVAL_MINUTES || '30';

export function startScheduler() {
  const cronExpression = `*/${CHECK_INTERVAL} * * * *`;

  logger.info(`Starting scheduler with cron expression: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    logger.info('🔄 Starting scheduled source check...');

    try {
      const results = await collectFromAllSources();

      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      logger.info(`✅ Scheduled check complete. New articles: ${totalNew}, Errors: ${totalErrors}`);
    } catch (error) {
      logger.error('❌ Error in scheduled source check:', error);
    }
  });

  logger.info('✅ Scheduler started successfully');
}

export default { startScheduler };
