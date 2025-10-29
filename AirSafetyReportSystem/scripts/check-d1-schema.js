/**
 * Check D1 database schema via wrangler
 */

import { execSync } from 'child_process';

console.log('🔍 Checking D1 Database Schema...\n');

try {
  // Check tables
  console.log('📋 Checking tables...');
  const tablesResult = execSync(
    'wrangler d1 execute reportDB --remote --command "SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' ORDER BY name"',
    { encoding: 'utf-8' }
  );
  console.log(tablesResult);

  // Check reports table structure
  console.log('\n📐 Checking reports table structure...');
  const reportsSchema = execSync(
    'wrangler d1 execute reportDB --remote --command "PRAGMA table_info(reports)"',
    { encoding: 'utf-8' }
  );
  console.log(reportsSchema);

  // Count records
  console.log('\n📊 Checking data counts...');
  const counts = execSync(
    'wrangler d1 execute reportDB --remote --command "SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM reports) as reports, (SELECT COUNT(*) FROM company_settings) as settings"',
    { encoding: 'utf-8' }
  );
  console.log(counts);

  // Check users
  console.log('\n👥 Checking users...');
  const users = execSync(
    'wrangler d1 execute reportDB --remote --command "SELECT email, first_name, last_name, role FROM users"',
    { encoding: 'utf-8' }
  );
  console.log(users);

  console.log('\n✅ D1 schema check complete!');

} catch (error) {
  console.error('❌ Error checking D1:', error.message);
  process.exit(1);
}

