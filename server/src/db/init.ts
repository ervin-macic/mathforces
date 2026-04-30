/**
 * Run as a standalone script to initialise the database:
 *   ts-node src/db/init.ts
 */
import { getDb } from './database';

const db = getDb();
console.log('Database initialised at:', db.name);
db.close();
