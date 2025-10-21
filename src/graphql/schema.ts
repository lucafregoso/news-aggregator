import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceTypeDefs = readFileSync(
  join(__dirname, 'typeDefs', 'source.graphql'),
  'utf-8'
);
const dataTypeDefs = readFileSync(
  join(__dirname, 'typeDefs', 'data.graphql'),
  'utf-8'
);
const summaryTypeDefs = readFileSync(
  join(__dirname, 'typeDefs', 'summary.graphql'),
  'utf-8'
);

export const typeDefs = `
  ${sourceTypeDefs}
  ${dataTypeDefs}
  ${summaryTypeDefs}
`;

export default typeDefs;
