import { prisma } from './config/database.js';
import { generateSummaryInternal } from './services/summaryService.js';
import { logger } from './utils/logger.js';

/**
 * Background Worker
 * Processa i job in stato QUEUED
 * Avvia come: npm run worker
 */

async function processQueue() {
  logger.info('🤖 Worker started - monitoring jobs...');

  // Controlla ogni 5 secondi
  setInterval(async () => {
    try {
      // Trova job in QUEUED state
      const queuedJob = await prisma.summaryJob.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });

      if (!queuedJob) {
        // Niente da processare
        return;
      }

      logger.info(`📝 Processing job ${queuedJob.id}...`);

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
        logger.info(`⏳ Job ${queuedJob.id}: ${current}/${total} topics`);
      };

      // Genera il summary
      logger.info(`🧠 Generating summary for job ${queuedJob.id}...`);
      const result = await generateSummaryInternal(
        queuedJob.startDate,
        queuedJob.endDate,
        queuedJob.topics.length > 0 ? queuedJob.topics : undefined,
        onProgress
      );

      // Salva risultato
      await prisma.summaryJob.update({
        where: { id: queuedJob.id },
        data: {
          status: 'COMPLETED',
          result: result as any,
          completedAt: new Date(),
          totalTopics: result.topics.length,
        },
      });

      logger.info(`✅ Job ${queuedJob.id} completed!`);
    } catch (error) {
      // Aggiorna job come FAILED
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

        logger.error(`❌ Job ${failedJob.id} failed:`, error);
      } else {
        logger.error('❌ Unknown error in worker:', error);
      }
    }
  }, 5000); // Controlla ogni 5 secondi
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
