import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const ACCEPTANCE_ROOT = path.join(REPO_ROOT, 'tools', 'acceptance');
export const FIXTURES_ROOT = path.join(ACCEPTANCE_ROOT, 'fixtures');
