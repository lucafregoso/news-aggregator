import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export const sourceResolvers = {
  Query: {
    sources: async () => {
      return await prisma.source.findMany({
        orderBy: { createdAt: 'desc' },
      });
    },

    source: async (_: any, { id }: { id: string }) => {
      return await prisma.source.findUnique({
        where: { id },
      });
    },
  },

  Mutation: {
    addSource: async (_: any, { input }: { input: any }) => {
      try {
        logger.info('Adding new source:', input.name);

        const source = await prisma.source.create({
          data: {
            name: input.name,
            type: input.type,
            config: input.config,
            active: true,
          },
        });

        logger.info(`Source added successfully: ${source.id}`);
        return source;
      } catch (error) {
        logger.error('Error adding source:', error);
        throw new Error('Failed to add source');
      }
    },

    updateSource: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        logger.info(`Updating source: ${id}`);

        const source = await prisma.source.update({
          where: { id },
          data: {
            name: input.name,
            type: input.type,
            config: input.config,
          },
        });

        logger.info(`Source updated successfully: ${id}`);
        return source;
      } catch (error) {
        logger.error('Error updating source:', error);
        throw new Error('Failed to update source');
      }
    },

    deleteSource: async (_: any, { id }: { id: string }) => {
      try {
        logger.info(`Deleting source: ${id}`);

        await prisma.source.delete({
          where: { id },
        });

        logger.info(`Source deleted successfully: ${id}`);
        return true;
      } catch (error) {
        logger.error('Error deleting source:', error);
        throw new Error('Failed to delete source');
      }
    },
  },

  Source: {
    config: (parent: any) => {
      const config = { ...parent.config };
      if (config.password) {
        config.password = '***HIDDEN***';
      }
      return config;
    },
  },
};

export default sourceResolvers;
