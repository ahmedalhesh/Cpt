import Database from 'better-sqlite3';

const dbPath = './database.sqlite';
const sqlite = new Database(dbPath);

function getExistingColumns(tableName) {
  const stmt = sqlite.prepare(`PRAGMA table_info(${tableName})`);
  const rows = stmt.all();
  return new Set(rows.map(r => r.name));
}

function addColumnIfMissing(tableName, columnName, type) {
  const existing = getExistingColumns(tableName);
  if (!existing.has(columnName)) {
    console.log(`Adding column ${columnName} ${type} to ${tableName}...`);
    sqlite.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${type}`).run();
  } else {
    console.log(`Column ${columnName} already exists.`);
  }
}

try {
  console.log('Migrating database to add ASR plot columns if missing...');
  const table = 'reports';

  addColumnIfMissing(table, 'plan_image', 'TEXT');
  addColumnIfMissing(table, 'elev_image', 'TEXT');
  addColumnIfMissing(table, 'plan_units', 'TEXT');
  addColumnIfMissing(table, 'plan_grid_x', 'INTEGER');
  addColumnIfMissing(table, 'plan_grid_y', 'INTEGER');
  addColumnIfMissing(table, 'plan_distance_x', 'REAL');
  addColumnIfMissing(table, 'plan_distance_y', 'REAL');
  addColumnIfMissing(table, 'elev_grid_col', 'INTEGER');
  addColumnIfMissing(table, 'elev_grid_row', 'INTEGER');
  addColumnIfMissing(table, 'elev_distance_horiz_m', 'REAL');
  addColumnIfMissing(table, 'elev_distance_vert_ft', 'REAL');
  addColumnIfMissing(table, 'extra_data', 'TEXT');

  console.log('Migration completed.');
} catch (e) {
  console.error('Migration failed:', e);
  process.exit(1);
} finally {
  sqlite.close();
}


