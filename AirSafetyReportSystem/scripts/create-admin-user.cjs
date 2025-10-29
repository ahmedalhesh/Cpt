/**
 * Create admin user in the database
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./database.sqlite');

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Check if admin user already exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@airline.com');
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Admin user details:', existingAdmin);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create admin user
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const adminId = `admin-${Date.now()}`;
    const now = new Date().toISOString();
    
    insertUser.run(
      adminId,
      'admin@airline.com',
      hashedPassword,
      'Admin',
      'User',
      'admin',
      now,
      now
    );
    
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@airline.com');
    console.log('Password: password123');
    console.log('Role: admin');
    console.log('ID:', adminId);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    db.close();
  }
}

createAdminUser();