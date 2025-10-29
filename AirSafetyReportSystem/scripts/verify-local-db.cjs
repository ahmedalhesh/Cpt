/**
 * Verify local database is ready for Cloudflare migration
 */

const Database = require('better-sqlite3');
const fs = require('fs');

// Check if database exists
if (!fs.existsSync('./database.sqlite')) {
  console.log('❌ Database file not found: ./database.sqlite');
  console.log('ℹ️  You need to run the local server first to create the database');
  process.exit(1);
}

const db = new Database('./database.sqlite');

console.log('🔍 Verifying Local Database Structure...\n');

try {
  // Get all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log('📋 Tables Found:');
  tables.forEach(t => console.log(`  ✓ ${t.name}`));
  
  // Required tables
  const requiredTables = ['users', 'reports', 'comments', 'notifications', 'company_settings'];
  const missingTables = requiredTables.filter(rt => !tables.find(t => t.name === rt));
  
  if (missingTables.length > 0) {
    console.log('\n❌ Missing required tables:', missingTables.join(', '));
  } else {
    console.log('\n✅ All required tables exist');
  }
  
  // Check reports table columns
  console.log('\n📐 Reports Table Columns:');
  const reportsCols = db.prepare('PRAGMA table_info(reports)').all();
  
  const criticalCols = [
    'id', 'report_type', 'status', 'submitted_by', 'description',
    'flight_number', 'aircraft_type', 'route', 'event_date_time',
    'contributing_factors', 'corrective_actions',
    'plan_image', 'elev_image', 'plan_units',
    'plan_grid_x', 'plan_grid_y', 'plan_distance_x', 'plan_distance_y',
    'elev_grid_col', 'elev_grid_row', 'elev_distance_horiz_m', 'elev_distance_vert_ft',
    'extra_data', 'created_at', 'updated_at'
  ];
  
  criticalCols.forEach(col => {
    const exists = reportsCols.find(c => c.name === col);
    console.log(`  ${exists ? '✓' : '✗'} ${col}`);
  });
  
  // Count data
  console.log('\n📊 Data Summary:');
  const counts = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    reports: db.prepare('SELECT COUNT(*) as c FROM reports').get().c,
    comments: db.prepare('SELECT COUNT(*) as c FROM comments').get().c,
    notifications: db.prepare('SELECT COUNT(*) as c FROM notifications').get().c,
    settings: db.prepare('SELECT COUNT(*) as c FROM company_settings').get().c,
  };
  
  Object.entries(counts).forEach(([table, count]) => {
    console.log(`  ${table}: ${count}`);
  });
  
  // Show users
  if (counts.users > 0) {
    console.log('\n👥 Users:');
    const users = db.prepare('SELECT email, first_name, last_name, role FROM users').all();
    users.forEach(u => {
      console.log(`  - ${u.email} (${u.first_name || ''} ${u.last_name || ''}) [${u.role}]`);
    });
  }
  
  // Check for admin user
  const admin = db.prepare("SELECT * FROM users WHERE email = 'admin@airline.com'").get();
  if (!admin) {
    console.log('\n⚠️  WARNING: No admin user found (admin@airline.com)');
    console.log('   Run: node scripts/create-admin-user.cjs');
  } else {
    console.log('\n✅ Admin user exists: admin@airline.com');
  }
  
  console.log('\n✅ Database verification complete!');
  console.log('\n📤 Ready to push schema to Cloudflare D1:');
  console.log('   wrangler d1 execute reportDB --file=./migrations/d1-schema.sql --remote');
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}

