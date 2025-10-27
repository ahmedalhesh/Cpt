-- Seed data for Air Safety Report System

-- Insert default admin user
INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) 
VALUES ('admin-user-id', 'admin@airline.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', datetime('now'), datetime('now'));

-- Insert demo user
INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) 
VALUES ('demo-user-id', 'demo@airline.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'User', 'captain', datetime('now'), datetime('now'));

-- Insert default company settings
INSERT INTO company_settings (id, company_name, logo, created_at, updated_at) 
VALUES ('company-settings-id', 'Air Safety Report System', NULL, datetime('now'), datetime('now'));
