/**
 * Export SQLite database to D1 format
 * Exports schema + data from local SQLite to SQL file for D1
 */

const Database = require('better-sqlite3');
const fs = require('fs');

const localDb = new Database('./database.sqlite');

console.log('📤 Exporting SQLite database to D1 format...\n');

try {
  let sqlOutput = '-- Exported from local SQLite database\n';
  sqlOutput += '-- Generated: ' + new Date().toISOString() + '\n\n';

  // Get all tables
  const tables = localDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('📋 Found tables:', tables.map(t => t.name).join(', '));

  // For each table, export structure and data
  for (const table of tables) {
    const tableName = table.name;
    
    // Export data for important tables
    if (['users', 'reports', 'comments', 'notifications', 'company_settings', 'attachments'].includes(tableName)) {
      console.log(`\n📊 Exporting ${tableName}...`);
      
      // Get all rows
      const rows = localDb.prepare(`SELECT * FROM ${tableName}`).all();
      
      if (rows.length > 0) {
        sqlOutput += `\n-- Data for ${tableName}\n`;
        
        // Get columns
        const columns = localDb.prepare(`PRAGMA table_info(${tableName})`).all();
        const columnNames = columns.map(c => c.name).join(', ');
        
        // Generate INSERT statements
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col.name];
            if (value === null || value === undefined) {
              return 'NULL';
            } else if (typeof value === 'string') {
              // Escape single quotes
              return `'${value.replace(/'/g, "''")}'`;
            } else {
              return String(value);
            }
          }).join(', ');
          
          sqlOutput += `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${values});\n`;
        }
        
        console.log(`  ✅ Exported ${rows.length} rows`);
      } else {
        console.log(`  ⚠️  Table ${tableName} is empty`);
      }
    }
  }

  // Save to file
  const outputFile = './migrations/export-to-d1.sql';
  fs.writeFileSync(outputFile, sqlOutput);
  
  console.log(`\n✅ Export complete!`);
  console.log(`📁 Saved to: ${outputFile}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review the exported file: ${outputFile}`);
  console.log(`   2. Apply to D1:`);
  console.log(`      wrangler d1 execute reportDB --remote --file=${outputFile}`);
  
  // Also print summary
  console.log('\n📊 Summary:');
  for (const table of tables) {
    const count = localDb.prepare(`SELECT COUNT(*) as c FROM ${table.name}`).get().c;
    if (count > 0) {
      console.log(`  ${table.name}: ${count} rows`);
    }
  }

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  localDb.close();
}

