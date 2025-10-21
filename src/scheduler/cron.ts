import cron from 'node-cron';
import { collectFromAllSources, processPendingTopics } from '../services/sourceCollector.js';
import { logger } from '../utils/logger.js';

const CHECK_INTERVAL = process.env.CHECK_INTERVAL_MINUTES || '30';

export function startScheduler() {
  // 1. Check sorgenti ogni X minuti (FAST MODE)
  const cronExpression = `*/${CHECK_INTERVAL} * * * *`;

  logger.info(`Starting scheduler with cron expression: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    logger.info('🔄 Starting scheduled source check (FAST MODE)...');

    try {
      const results = await collectFromAllSources({
        extractTopicsImmediately: false, // Fast mode
        timeout: 30000,
      });

      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const totalPending = results.reduce((sum, r) => sum + r.pendingTopicExtraction, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      logger.info(`✅ Check complete. New: ${totalNew}, Pending: ${totalPending}, Errors: ${totalErrors}`);
    } catch (error) {
      logger.error('❌ Error in scheduled source check:', error);
    }
  });

  // 2. NUOVO: Processa topic pending ogni 5 minuti
  cron.schedule('*/5 * * * *', async () => {
    logger.info('🧠 Starting pending topics processing...');

    try {
      const processed = await processPendingTopics(50);

      if (processed > 0) {
        logger.info(`✅ Processed ${processed} pending topics`);
      }
    } catch (error) {
      logger.error('❌ Error processing pending topics:', error);
    }
  });

  logger.info('✅ Scheduler started successfully');
  logger.info('   • Source checks: every ' + CHECK_INTERVAL + ' minutes (fast mode)');
  logger.info('   • Topic extraction: every 5 minutes');
}

export default { startScheduler };
