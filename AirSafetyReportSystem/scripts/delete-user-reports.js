import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

// Usage:
//   node scripts/delete-user-reports.js --email user@example.com
// If --email is not provided, deletes reports created by admin users (role = 'admin').

const dbFile = process.env.DATABASE_URL || './database.sqlite';
const sqlite = new Database(dbFile);
const db = drizzle(sqlite);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

async function main() {
  try {
    const email = getArgValue('--email');

    if (email) {
      console.log(`Deleting reports for user with email: ${email}`);
      const result = db.run(sql`DELETE FROM reports WHERE submitted_by IN (SELECT id FROM users WHERE email = ${email})`);
      console.log('Deleted reports count:', result.changes || 0);
    } else {
      console.log('No --email provided. Deleting reports created by admin users (role = admin)...');
      const result = db.run(sql`DELETE FROM reports WHERE submitted_by IN (SELECT id FROM users WHERE role = 'admin')`);
      console.log('Deleted reports count:', result.changes || 0);
    }
  } catch (error) {
    console.error('Error deleting user reports:', error);
    process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}

main();



