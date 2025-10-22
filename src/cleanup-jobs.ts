import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';

/**
 * Pulizia: Elimina SummaryJob COMPLETED
 * (Usa solo se non ti servono i dati!)
 * 
 * Usa: npx ts-node src/cleanup-jobs.ts
 */

async function deleteCompletedJobs() {
  try {
    logger.info('🗑️  Starting cleanup of completed jobs...');

    // Conta job COMPLETED
    const count = await prisma.summaryJob.count({
      where: { status: 'COMPLETED' },
    });

    logger.info(`📊 Found ${count} completed jobs`);

    if (count === 0) {
      logger.info('✅ No jobs to clean');
      await prisma.$disconnect();
      return;
    }

    // ⚠️ Conferma eliminazione
    logger.warn('⚠️  WARNING: You are about to DELETE completed jobs!');
    logger.warn('⚠️  This cannot be undone!');
    logger.warn(`⚠️  Jobs to delete: ${count}`);

    // Pausa 5 secondi per permettere Ctrl+C
    logger.info('Proceeding in 5 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Elimina
    const result = await prisma.summaryJob.deleteMany({
      where: { status: 'COMPLETED' },
    });

    logger.info(`
===============================================
✅ Cleanup complete!
   • Deleted: ${result.count} jobs
===============================================
    `);

    await prisma.$disconnect();
  } catch (error) {
    logger.error('Error in cleanup:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Avvia pulizia
deleteCompletedJobs();
