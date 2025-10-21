import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface SummaryJobRequest {
  startDate: Date;
  endDate: Date;
  topics?: string[];
}

//Crea nuovo job SENZA Bull Queue - solo DB polling
export async function createSummaryJob(request: SummaryJobRequest): Promise<string> {
  try {
    logger.info('Creating summary job...', request);

    //✅ Salva job in DB
    const job = await prisma.summaryJob.create({
      data: {
        startDate: request.startDate,
        endDate: request.endDate,
        topics: request.topics || [],
        status: 'QUEUED',
      },
    });

    logger.info('✅ Job created in DB:', { jobId: job.id, status: 'QUEUED' });

    //✅ RITORNA SUBITO L'ID (non aspetta processing)
    return job.id;
  } catch (error) {
    logger.error('❌ Error creating job:', error);
    throw new Error(`Failed to create job: ${error}`);
  }
}

//Ottieni status job
export async function getJobStatus(jobId: string) {
  try {
    const job = await prisma.summaryJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        currentTopic: true,
        totalTopics: true,
        result: true,
        error: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) {
      logger.warn(`Job not found: ${jobId}`);
      return null;
    }

    return {
      ...job,
      progress: job.totalTopics > 0 ? (job.currentTopic / job.totalTopics) * 100 : 0,
    };
  } catch (error) {
    logger.error('Error getting job status:', error);
    return null;
  }
}

export default {
  createSummaryJob,
  getJobStatus,
};
