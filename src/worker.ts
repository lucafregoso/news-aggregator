import { prisma } from './config/database.js';
import { generateSummaryInternal } from './services/summaryService.js';
import { logger } from './utils/logger.js';

/**
 * Background Worker - OTTIMIZZATO
 * 1. Processa job QUEUED
 * 2. Genera summary
 * 3. Salva result in Summary table
 * 4. Elimina SummaryJob
 */

async function processQueue() {
  logger.info('🤖 Worker started - monitoring job queue...');

  setInterval(async () => {
    try {
      // Trova job in QUEUED state
      const queuedJob = await prisma.summaryJob.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });

      if (!queuedJob) {
        return;
      }

      logger.info(`📝 [Queue] Processing job ${queuedJob.id}...`);

      // Aggiorna status a PROCESSING
      await prisma.summaryJob.update({
        where: { id: queuedJob.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Callback per aggiornare progress
      const onProgress = async (current: number, total: number) => {
        await prisma.summaryJob.update({
          where: { id: queuedJob.id },
          data: {
            currentTopic: current,
            totalTopics: total,
          },
        });
        logger.info(`⏳ [Queue] Job ${queuedJob.id}: ${current}/${total} topics`);
      };

      // Genera il summary
      logger.info(`🧠 [Queue] Generating summary for job ${queuedJob.id}...`);
      const result = await generateSummaryInternal(
        queuedJob.startDate,
        queuedJob.endDate,
        queuedJob.topics.length > 0 ? queuedJob.topics : undefined,
        onProgress
      );

      // ✅ NUOVO: Salva result in Summary table
      logger.info(`💾 [Queue] Moving result to Summary table...`);
      const savedSummary = await prisma.summary.create({
        data: {
          startDate: queuedJob.startDate,
          endDate: queuedJob.endDate,
          topics: result.topics as any,
          totalArticles: result.totalArticles,
          articleIds: result.articleIds || [],
          queryTopics: queuedJob.topics,
        },
      });

      logger.info(`✅ [Queue] Summary saved: ${savedSummary.id}`);

      // ✅ NUOVO: Elimina il job dalla coda
      await prisma.summaryJob.delete({
        where: { id: queuedJob.id },
      });

      logger.info(`🗑️  [Queue] Job ${queuedJob.id} removed from queue`);
      logger.info(`✅ [Queue] Job completed! Summary: ${savedSummary.id}`);

    } catch (error) {
      // Se fallisce, segna come FAILED ma NON eliminare
      const failedJob = await prisma.summaryJob.findFirst({
        where: { status: 'PROCESSING' },
        orderBy: { startedAt: 'desc' },
      });

      if (failedJob) {
        await prisma.summaryJob.update({
          where: { id: failedJob.id },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          },
        });

        logger.error(`❌ [Queue] Job ${failedJob.id} failed:`, error);
      } else {
        logger.error('❌ [Queue] Unknown error:', error);
      }
    }
  }, 5000);
}

// Avvia il worker
processQueue().catch((error) => {
  logger.error('Fatal error in worker:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Worker shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Worker interrupted...');
  await prisma.$disconnect();
  process.exit(0);
});
