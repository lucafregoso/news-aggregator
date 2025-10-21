import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { logger } from '../../utils/logger.js';
import { IMAPConfig } from '../../config/sources.js';

export interface EmailItem {
  title: string;
  content: string;
  author?: string;
  publishedAt: Date;
  url?: string;
}

export async function fetchIMAPEmails(config: IMAPConfig): Promise<EmailItem[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls ?? true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails: EmailItem[] = [];

    imap.once('ready', () => {
      logger.info(`IMAP connection ready for ${config.host}`);

      const processFolder = async (folderIndex: number) => {
        if (folderIndex >= config.folders.length) {
          imap.end();
          return;
        }

        const folder = config.folders[folderIndex];

        imap.openBox(folder, true, (err, box) => {
          if (err) {
            logger.error(`Error opening folder ${folder}:`, err);
            processFolder(folderIndex + 1);
            return;
          }

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const searchCriteria = ['UNSEEN', ['SINCE', sevenDaysAgo]];

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              logger.error(`Error searching emails in ${folder}:`, err);
              processFolder(folderIndex + 1);
              return;
            }

            if (!results || results.length === 0) {
              logger.info(`No new emails in ${folder}`);
              processFolder(folderIndex + 1);
              return;
            }

            const fetch = imap.fetch(results, { 
              bodies: '',
              markSeen: false
            });

            let processed = 0;
            const total = results.length;

            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream, info) => {
                simpleParser(stream, async (err, parsed: ParsedMail) => {
                  if (err) {
                    logger.error('Error parsing email:', err);
                    return;
                  }

                  emails.push({
                    title: parsed.subject || 'No Subject',
                    content: parsed.text || parsed.html?.replace(/<[^>]*>/g, '') || '',
                    author: parsed.from?.text || undefined,
                    publishedAt: parsed.date || new Date(),
                    url: undefined,
                  });

                  processed++;
                });
              });

              msg.once('end', () => {
                if (processed >= total) {
                  logger.info(`Processed ${total} emails from ${folder}`);
                  processFolder(folderIndex + 1);
                }
              });
            });

            fetch.once('error', (err) => {
              logger.error('Fetch error:', err);
              processFolder(folderIndex + 1);
            });

            fetch.once('end', () => {
              logger.info(`Fetch completed for ${folder}`);
            });
          });
        });
      };

      processFolder(0);
    });

    imap.once('error', (err) => {
      logger.error('IMAP connection error:', err);
      reject(err);
    });

    imap.once('end', () => {
      logger.info('IMAP connection ended');
      resolve(emails);
    });

    imap.connect();
  });
}

export default { fetchIMAPEmails };
