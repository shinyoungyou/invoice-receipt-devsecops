import { openDatabase } from '../db/database.js';

const db = openDatabase();
try {
  console.log(`SQLite ready: ${process.env.DATABASE_PATH ?? './data/invoices.db'}`);
  console.log(`Schema version: ${db.prepare('PRAGMA user_version').get().user_version}`);
} finally {
  db.close();
}
