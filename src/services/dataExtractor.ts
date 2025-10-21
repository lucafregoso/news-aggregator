import ollama from '../config/ollama.js';
import { ollamaConfig } from '../config/ollama.js';
import { logger } from '../utils/logger.js';

export interface ExtractedData {
  topic: string;
  macroTopic: string;
}

// VECCHIA FUNZIONE (lenta) - mantenuta per compatibilità
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

// NUOVA FUNZIONE (veloce) - Estrazione in batch
export async function extractTopicsInBatch(
  articles: Array<{ title: string; content: string }>
): Promise<ExtractedData[]> {
  if (articles.length === 0) {
    return [];
  }

  logger.info(`🧠 Extracting topics for ${articles.length} articles in batch...`);

  try {
    // Prepara lista articoli per il prompt
    const articlesList = articles
      .map((article, index) => {
        return `Article ${index + 1}:
Title: ${article.title}
Content: ${article.content.substring(0, 300)}...
---`;
      })
      .join('\n\n');

    const prompt = `You are analyzing ${articles.length} articles. For each article, extract:
1. A specific topic (2-4 words)
2. A macro topic/category (1-2 words)

Articles:
${articlesList}

Respond ONLY with a JSON array of objects, one per article in order:
[
  {"topic": "specific topic", "macroTopic": "category"},
  {"topic": "specific topic", "macroTopic": "category"},
  ...
]`;

    const startTime = Date.now();
    const response = await ollama.chat({
      model: ollamaConfig.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
    });

    const duration = Date.now() - startTime;
    logger.info(`✓ Batch extraction completed in ${duration}ms (${Math.round(duration / articles.length)}ms/article)`);

    const results = JSON.parse(response.message.content);

    // Verifica che abbiamo il numero corretto di risultati
    if (!Array.isArray(results) || results.length !== articles.length) {
      logger.warn(`Batch extraction returned ${results?.length || 0} results, expected ${articles.length}`);
      // Fallback: usa risultati parziali o genera default
      const extractedData: ExtractedData[] = [];
      for (let i = 0; i < articles.length; i++) {
        if (results[i]) {
          extractedData.push({
            topic: results[i].topic || 'General',
            macroTopic: results[i].macroTopic || 'News',
          });
        } else {
          extractedData.push({
            topic: articles[i].title.substring(0, 50),
            macroTopic: 'General',
          });
        }
      }
      return extractedData;
    }

    return results.map((r: any) => ({
      topic: r.topic || 'General',
      macroTopic: r.macroTopic || 'News',
    }));
  } catch (error) {
    logger.error('Error in batch topic extraction:', error);
    // Fallback: genera topic basic da titoli
    logger.warn('Falling back to title-based topics');
    return articles.map((article) => ({
      topic: article.title.substring(0, 50),
      macroTopic: 'General',
    }));
  }
}

// NUOVO: Estrazione intelligente con chunking per grandi batch
export async function extractTopicsInBatchChunked(
  articles: Array<{ title: string; content: string }>,
  chunkSize: number = 20
): Promise<ExtractedData[]> {
  if (articles.length === 0) {
    return [];
  }

  logger.info(`🧠 Extracting topics for ${articles.length} articles in chunks of ${chunkSize}...`);

  const allResults: ExtractedData[] = [];

  // Divide in chunks
  for (let i = 0; i < articles.length; i += chunkSize) {
    const chunk = articles.slice(i, i + chunkSize);
    logger.info(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(articles.length / chunkSize)} (${chunk.length} articles)`);

    try {
      const chunkResults = await extractTopicsInBatch(chunk);
      allResults.push(...chunkResults);
    } catch (error) {
      logger.error(`Error processing chunk ${i / chunkSize + 1}:`, error);
      // Fallback per questo chunk
      allResults.push(...chunk.map((a) => ({
        topic: a.title.substring(0, 50),
        macroTopic: 'General',
      })));
    }
  }

  logger.info(`✅ Completed topic extraction for ${allResults.length} articles`);
  return allResults;
}

export default {
  extractTopicAndMacroTopic,
  extractTopicsInBatch,
  extractTopicsInBatchChunked,
};
