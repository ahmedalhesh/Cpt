-- Cloudflare D1 Database Schema
-- Complete schema matching local database structure

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    profile_image_url TEXT,
    role TEXT DEFAULT 'captain' NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Reports table (COMPLETE with all fields)
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY NOT NULL,
    report_type TEXT NOT NULL,
    status TEXT DEFAULT 'submitted' NOT NULL,
    submitted_by TEXT NOT NULL,
    is_anonymous INTEGER DEFAULT 0 NOT NULL,
    description TEXT NOT NULL,
    flight_number TEXT,
    aircraft_type TEXT,
    route TEXT,
    event_date_time TEXT,
    contributing_factors TEXT,
    corrective_actions TEXT,
    plan_image TEXT,
    elev_image TEXT,
    plan_units TEXT,
    plan_grid_x INTEGER,
    plan_grid_y INTEGER,
    plan_distance_x REAL,
    plan_distance_y REAL,
    elev_grid_col INTEGER,
    elev_grid_row INTEGER,
    elev_distance_horiz_m REAL,
    elev_distance_vert_ft REAL,
    location TEXT,
    phase_of_flight TEXT,
    risk_level TEXT,
    follow_up_actions TEXT,
    ground_crew_names TEXT,
    vehicle_involved TEXT,
    damage_type TEXT,
    corrective_steps TEXT,
    department TEXT,
    nonconformity_type TEXT,
    root_cause TEXT,
    responsible_person TEXT,
    preventive_actions TEXT,
    extra_data TEXT,
    discretion_reason TEXT,
    time_extension TEXT,
    crew_fatigue_details TEXT,
    final_decision TEXT,
    potential_impact TEXT,
    prevention_suggestions TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY NOT NULL,
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    report_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' NOT NULL,
    is_read INTEGER DEFAULT 0 NOT NULL,
    related_report_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

-- Company settings table
CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY NOT NULL,
    company_name TEXT DEFAULT 'Report Sys' NOT NULL,
    logo TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions table (for compatibility)
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY NOT NULL,
    sess TEXT NOT NULL,
    expire TEXT NOT NULL
);

-- Create index for sessions
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

-- Insert default company settings
INSERT OR IGNORE INTO company_settings (id, company_name) 
VALUES ('default', 'Report Sys');

-- Insert demo user (password: password123)
INSERT OR IGNORE INTO users (id, email, password, first_name, last_name, role) 
VALUES (
    'demo-user-id',
    'demo@airline.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Demo',
    'User',
    'captain'
);

-- Insert admin user (password: password123)
INSERT OR IGNORE INTO users (id, email, password, first_name, last_name, role) 
VALUES (
    'admin-user-id',
    'admin@airline.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Admin',
    'User',
    'admin'
);
