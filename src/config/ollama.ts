import ollama from 'ollama';
import { logger } from '../utils/logger.js';

export interface OllamaConfig {
  host: string;
  model: string;
}

export const ollamaConfig: OllamaConfig = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3',
};

export async function testOllamaConnection(): Promise<boolean> {
  try {
    const response = await ollama.chat({
      model: ollamaConfig.model,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    });
    logger.info('✅ Ollama connection successful');
    return true;
  } catch (error) {
    logger.warn('⚠️  Ollama not available. LLM features will be disabled.', error);
    return false;
  }
}

export default ollama;
