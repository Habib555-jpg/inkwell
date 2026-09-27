import { loadEnv } from '../env';
import { createDb } from './connect';

createDb({ ...loadEnv(), DB_AUTO_MIGRATE: 'true' })
  .then(() => { console.log('migrations applied'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
