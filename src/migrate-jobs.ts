import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';

async function migrateCompletedJobs() {
  try {
    logger.info('🔄 Starting migration of completed jobs...');

    // Trova tutti i SummaryJob COMPLETED
    const completedJobs = await prisma.summaryJob.findMany({
      where: { status: 'COMPLETED' },
    });

    logger.info(`📊 Found ${completedJobs.length} completed jobs to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const job of completedJobs) {
      try {
        logger.info(`📝 Migrating job ${job.id}...`);
        // Estrai i dati veri dal campo result (JSON)
        let topics = [];
        let totalArticles = 0;
        let articleIds = [];
        try {
          if (job.result && typeof job.result === 'object') {
            const r = job.result as any;
            if (Array.isArray(r.topics)) topics = r.topics;
            if (typeof r.totalArticles === 'number') totalArticles = r.totalArticles;
            if (Array.isArray(r.articleIds)) articleIds = r.articleIds;
          }
        } catch (ex) { logger.warn('JSON parse error in job', job.id); }

        const parsedResult = typeof job.result === "string"
          ? JSON.parse(job.result)
          : job.result;

        const summary = await prisma.summary.create({
          data: {
            startDate: job.startDate,
            endDate: job.endDate,
            topics: parsedResult.topics || [],
            totalArticles: parsedResult.totalArticles || 0,
            articleIds: parsedResult.articleIds || [],
            queryTopics: job.topics,
            generatedAt: job.completedAt || new Date(),
          },
        });

        logger.info(`✅ Summary created: ${summary.id}`);
        // Elimina il job
        await prisma.summaryJob.delete({ where: { id: job.id } });
        logger.info(`🗑️  Job deleted: ${job.id}`);
        migrated++;
      } catch (error) {
        logger.error(`❌ Failed to migrate job ${job.id}:`, error);
        failed++;
      }
    }

    logger.info(`
===============================================
✅ Migration complete!
   • Migrated: ${migrated}
   • Failed: ${failed}
   • Total: ${completedJobs.length}
===============================================
    `);
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Fatal error in migration:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrateCompletedJobs();
