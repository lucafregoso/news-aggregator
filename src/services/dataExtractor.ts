import ollama from '../config/ollama.js';
import { ollamaConfig } from '../config/ollama.js';
import { logger } from '../utils/logger.js';

export interface ExtractedData {
  topic: string;
  macroTopic: string;
}

export async function extractTopicAndMacroTopic(
  title: string,
  content: string
): Promise<ExtractedData> {
  try {
    const prompt = `Analyze this article and extract:
1. A specific topic (2-4 words)
2. A macro topic/category (1-2 words)

Article Title: ${title}
Article Content: ${content.substring(0, 500)}...

Respond ONLY in this JSON format:
{
  "topic": "specific topic here",
  "macroTopic": "category here"
}`;

    const response = await ollama.chat({
      model: ollamaConfig.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
    });

    const result = JSON.parse(response.message.content);

    return {
      topic: result.topic || 'General',
      macroTopic: result.macroTopic || 'News',
    };
  } catch (error) {
    logger.error('Error extracting topics with LLM:', error);
    return {
      topic: title.substring(0, 50),
      macroTopic: 'General',
    };
  }
}

export default { extractTopicAndMacroTopic };
