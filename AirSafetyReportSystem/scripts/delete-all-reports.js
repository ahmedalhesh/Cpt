import Database from 'better-sqlite3';

const dbPath = './database.sqlite';
const sqlite = new Database(dbPath);

try {
  console.log('Deleting all reports from database...');
  
  // Count reports before deletion
  const countBefore = sqlite.prepare('SELECT COUNT(*) as count FROM reports').get();
  console.log(`Found ${countBefore.count} reports in database.`);
  
  if (countBefore.count === 0) {
    console.log('No reports to delete.');
    sqlite.close();
    process.exit(0);
  }
  
  // Delete all reports (comments and attachments will be deleted automatically due to cascade)
  sqlite.prepare('DELETE FROM reports').run();
  
  // Verify deletion
  const countAfter = sqlite.prepare('SELECT COUNT(*) as count FROM reports').get();
  console.log(`✅ Successfully deleted all reports. Remaining reports: ${countAfter.count}`);
  
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error deleting reports:', error);
  sqlite.close();
  process.exit(1);
}

