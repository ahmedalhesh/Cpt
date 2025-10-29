/**
 * Check admin user in the database
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./database.sqlite');

async function checkAdminUser() {
  try {
    console.log('Checking admin user...');
    
    // Get admin user
    const adminUser = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@airline.com');
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('✅ Admin user found!');
    console.log('ID:', adminUser.id);
    console.log('Email:', adminUser.email);
    console.log('First Name:', adminUser.first_name);
    console.log('Last Name:', adminUser.last_name);
    console.log('Role:', adminUser.role);
    console.log('Created At:', adminUser.created_at);
    
    // Test password
    const passwordMatch = await bcrypt.compare('password123', adminUser.password);
    console.log('Password test (password123):', passwordMatch ? '✅ Correct' : '❌ Incorrect');
    
    // Get all users
    const allUsers = db.prepare('SELECT id, email, first_name, last_name, role FROM users').all();
    console.log('\nAll users in database:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking admin user:', error);
  } finally {
    db.close();
  }
}

checkAdminUser();
