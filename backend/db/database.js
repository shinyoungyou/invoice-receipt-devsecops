import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function initializeDatabase(db) {
  // Apply the initial schema atomically and preserve existing records.
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version === 0) {
      db.exec(schema);
      db.exec('PRAGMA user_version = 1');
    } else if (version !== 1) {
      throw new Error(`Unsupported database schema version: ${version}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase(filename = process.env.DATABASE_PATH ?? './data/invoices.db') {
  if (typeof filename !== 'string' || filename.trim() === '') {
    throw new Error('DATABASE_PATH must not be empty.');
  }
  const target = filename === ':memory:' ? filename : resolve(backendRoot, filename);
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA journal_mode = WAL');
    initializeDatabase(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
