/**
 * Check local database structure and data
 */

const Database = require('better-sqlite3');

const db = new Database('./database.sqlite');

console.log('🔍 Checking Local Database...\n');

// Check if database file exists and is accessible
try {
  // Check tables
  console.log('📋 Tables in database:');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  tables.forEach(table => {
    console.log(`  ✓ ${table.name}`);
  });
  
  console.log('\n📊 Data Summary:');
  
  // Check users
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`  Users: ${usersCount.count}`);
  
  if (usersCount.count > 0) {
    const users = db.prepare('SELECT id, email, first_name, last_name, role FROM users').all();
    users.forEach(user => {
      console.log(`    - ${user.email} (${user.first_name} ${user.last_name}) - ${user.role}`);
    });
  }
  
  // Check reports
  const reportsCount = db.prepare('SELECT COUNT(*) as count FROM reports').get();
  console.log(`\n  Reports: ${reportsCount.count}`);
  
  if (reportsCount.count > 0) {
    const reportsByType = db.prepare(`
      SELECT report_type, COUNT(*) as count 
      FROM reports 
      GROUP BY report_type
    `).all();
    
    reportsByType.forEach(row => {
      console.log(`    - ${row.report_type}: ${row.count}`);
    });
  }
  
  // Check notifications
  const notificationsCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
  console.log(`\n  Notifications: ${notificationsCount.count}`);
  
  // Check comments
  const commentsCount = db.prepare('SELECT COUNT(*) as count FROM comments').get();
  console.log(`  Comments: ${commentsCount.count}`);
  
  // Check company settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM company_settings').get();
  console.log(`  Company Settings: ${settingsCount.count}`);
  
  if (settingsCount.count > 0) {
    const settings = db.prepare('SELECT company_name, email, phone FROM company_settings LIMIT 1').get();
    console.log(`    - Company: ${settings.company_name}`);
    console.log(`    - Email: ${settings.email || 'Not set'}`);
    console.log(`    - Phone: ${settings.phone || 'Not set'}`);
  }
  
  // Check reports table structure
  console.log('\n📐 Reports Table Structure:');
  const columns = db.prepare('PRAGMA table_info(reports)').all();
  console.log(`  Total columns: ${columns.length}`);
  
  // Check for important fields
  const importantFields = [
    'id', 'report_type', 'status', 'submitted_by', 'description',
    'plan_image', 'elev_image', 'extra_data',
    'created_at', 'updated_at'
  ];
  
  importantFields.forEach(field => {
    const exists = columns.find(col => col.name === field);
    console.log(`  ${exists ? '✓' : '✗'} ${field}`);
  });
  
  console.log('\n✅ Database check complete!\n');
  
} catch (error) {
  console.error('❌ Error checking database:', error);
} finally {
  db.close();
}

