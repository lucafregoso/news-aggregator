import ollama from '../config/ollama.js';
import { ollamaConfig } from '../config/ollama.js';
import { logger } from '../utils/logger.js';

export interface SummarizeOptions {
  maxLength?: number;
  language?: string;
}

export async function summarizeArticles(
  articles: Array<{ title: string; content: string; author?: string }>,
  options: SummarizeOptions = {}
): Promise<string> {
  try {
    const { maxLength = 500, language = 'italiano' } = options;

    const articlesText = articles
      .map((article, index) => {
        return `Articolo ${index + 1}:
Titolo: ${article.title}
Autore: ${article.author || 'Sconosciuto'}
Contenuto: ${article.content.substring(0, 1000)}...
---`;
      })
      .join('\n\n');

    const prompt = `Sei un assistente che crea riepiloghi di notizie. 
Ricevi ${articles.length} articoli sullo stesso argomento da diverse fonti.

Compito:
1. Identifica le informazioni comuni e uniche
2. Elimina le ridondanze
3. Crea un riepilogo consolidato e coerente in ${language}
4. Massimo ${maxLength} parole
5. Mantieni un tono neutrale e giornalistico

Articoli:
${articlesText}

Riepilogo:`;

    const response = await ollama.chat({
      model: ollamaConfig.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    return response.message.content.trim();
  } catch (error) {
    logger.error('Error summarizing with LLM:', error);
    throw new Error('Failed to generate summary');
  }
}

export async function clusterArticlesByTopic(
  articles: Array<{ id: string; title: string; content: string; topic: string }>
): Promise<Map<string, string[]>> {
  const clusters = new Map<string, string[]>();

  articles.forEach((article) => {
    const topic = article.topic;
    if (!clusters.has(topic)) {
      clusters.set(topic, []);
    }
    clusters.get(topic)!.push(article.id);
  });

  return clusters;
}

export default {
  summarizeArticles,
  clusterArticlesByTopic,
};
