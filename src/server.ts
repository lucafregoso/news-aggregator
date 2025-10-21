import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import dotenv from 'dotenv';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers/index.js';
import { logger } from './utils/logger.js';
import { testOllamaConnection } from './config/ollama.js';
import { startScheduler } from './scheduler/cron.js';
import './config/database.js';
import { mkdirSync, existsSync } from 'fs';

dotenv.config();

if (!existsSync('logs')) {
  mkdirSync('logs');
}

const PORT = parseInt(process.env.PORT || '4000', 10);

async function startServer() {
  logger.info('🚀 Starting News Aggregator Tool...');

  await testOllamaConnection();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error) => {
      logger.error('GraphQL Error:', error);
      return error;
    },
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => ({}),
  });

  logger.info(`✅ GraphQL Server ready at ${url}`);
  logger.info(`📊 GraphQL Playground available at ${url}`);

  startScheduler();

  logger.info('🎉 News Aggregator Tool is fully operational!');
  logger.info('');
  logger.info('Available operations:');
  logger.info('  • Manage sources (add, update, delete, list)');
  logger.info('  • Check sources manually or automatically');
  logger.info('  • Query articles by date range and topics');
  logger.info('  • Generate AI-powered summaries');
  logger.info('');
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
