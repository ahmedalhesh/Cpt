/**
 * Export SQLite database to D1 format (SIMPLE VERSION)
 * Only export data that matches current D1 schema
 */

const Database = require('better-sqlite3');
const fs = require('fs');

const localDb = new Database('./database.sqlite');

console.log('📤 Exporting SQLite database to D1 format (SIMPLE)...\n');

try {
  let sqlOutput = '-- Exported from local SQLite database (SIMPLE VERSION)\n';
  sqlOutput += '-- Generated: ' + new Date().toISOString() + '\n\n';

  // Disable foreign key constraints
  sqlOutput += 'PRAGMA foreign_keys = OFF;\n\n';

  // Clear existing data first
  sqlOutput += '-- Clear existing data\n';
  sqlOutput += 'DELETE FROM notifications;\n';
  sqlOutput += 'DELETE FROM reports;\n';
  sqlOutput += 'DELETE FROM company_settings;\n';
  sqlOutput += 'DELETE FROM users;\n\n';

  // Export users (only basic fields)
  console.log('📊 Exporting users...');
  const users = localDb.prepare(`SELECT id, email, password, first_name, last_name, role, created_at, updated_at FROM users`).all();
  
  if (users.length > 0) {
    sqlOutput += '-- Users data\n';
    for (const user of users) {
      sqlOutput += `INSERT OR REPLACE INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES ('${user.id}', '${user.email}', '${user.password}', '${user.first_name}', '${user.last_name}', '${user.role}', '${user.created_at}', '${user.updated_at}');\n`;
    }
    console.log(`  ✅ Exported ${users.length} users`);
  }

  // Export company_settings
  console.log('📊 Exporting company_settings...');
  const settings = localDb.prepare(`SELECT * FROM company_settings`).all();
  
  if (settings.length > 0) {
    sqlOutput += '\n-- Company settings data\n';
    for (const setting of settings) {
      sqlOutput += `INSERT OR REPLACE INTO company_settings (id, company_name, logo, email, phone, address, created_at, updated_at) VALUES ('${setting.id}', '${setting.company_name}', ${setting.logo ? `'${setting.logo}'` : 'NULL'}, ${setting.email ? `'${setting.email}'` : 'NULL'}, ${setting.phone ? `'${setting.phone}'` : 'NULL'}, ${setting.address ? `'${setting.address}'` : 'NULL'}, '${setting.created_at}', '${setting.updated_at}');\n`;
    }
    console.log(`  ✅ Exported ${settings.length} settings`);
  }

  // Export reports (only basic fields)
  console.log('📊 Exporting reports...');
  const reports = localDb.prepare(`SELECT id, report_type, status, submitted_by, is_anonymous, description, flight_number, aircraft_type, route, event_date_time, contributing_factors, corrective_actions, location, phase_of_flight, risk_level, extra_data, created_at, updated_at FROM reports`).all();
  
  if (reports.length > 0) {
    sqlOutput += '\n-- Reports data\n';
    for (const report of reports) {
      sqlOutput += `INSERT OR REPLACE INTO reports (id, report_type, status, submitted_by, is_anonymous, description, flight_number, aircraft_type, route, event_date_time, contributing_factors, corrective_actions, location, phase_of_flight, risk_level, extra_data, created_at, updated_at) VALUES ('${report.id}', '${report.report_type}', '${report.status}', '${report.submitted_by}', ${report.is_anonymous}, '${report.description}', ${report.flight_number ? `'${report.flight_number}'` : 'NULL'}, ${report.aircraft_type ? `'${report.aircraft_type}'` : 'NULL'}, ${report.route ? `'${report.route}'` : 'NULL'}, ${report.event_date_time ? `'${report.event_date_time}'` : 'NULL'}, ${report.contributing_factors ? `'${report.contributing_factors}'` : 'NULL'}, ${report.corrective_actions ? `'${report.corrective_actions}'` : 'NULL'}, ${report.location ? `'${report.location}'` : 'NULL'}, ${report.phase_of_flight ? `'${report.phase_of_flight}'` : 'NULL'}, ${report.risk_level ? `'${report.risk_level}'` : 'NULL'}, ${report.extra_data ? `'${report.extra_data}'` : 'NULL'}, '${report.created_at}', '${report.updated_at}');\n`;
    }
    console.log(`  ✅ Exported ${reports.length} reports`);
  }

  // Export notifications (only basic fields)
  console.log('📊 Exporting notifications...');
  const notifications = localDb.prepare(`SELECT id, user_id, title, message, type, is_read, related_report_id, created_at FROM notifications`).all();
  
  if (notifications.length > 0) {
    sqlOutput += '\n-- Notifications data\n';
    for (const notification of notifications) {
      sqlOutput += `INSERT OR REPLACE INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at) VALUES ('${notification.id}', '${notification.user_id}', '${notification.title}', '${notification.message}', '${notification.type}', ${notification.is_read}, ${notification.related_report_id ? `'${notification.related_report_id}'` : 'NULL'}, '${notification.created_at}');\n`;
    }
    console.log(`  ✅ Exported ${notifications.length} notifications`);
  }

  // Re-enable foreign key constraints
  sqlOutput += '\nPRAGMA foreign_keys = ON;\n';

  // Save to file
  const outputFile = './migrations/export-to-d1-simple.sql';
  fs.writeFileSync(outputFile, sqlOutput);
  
  console.log(`\n✅ Export complete!`);
  console.log(`📁 Saved to: ${outputFile}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Apply to D1:`);
  console.log(`      wrangler d1 execute reportDB --remote --file=${outputFile}`);

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  localDb.close();
}

