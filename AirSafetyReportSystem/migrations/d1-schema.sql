-- Cloudflare D1 Database Schema
-- This file contains the SQL schema for D1 database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'captain', 'first_officer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL CHECK (report_type IN ('asr', 'or', 'rir', 'ncr', 'cdf', 'chr')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'closed')),
    submitted_by TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    flight_number TEXT,
    aircraft_type TEXT,
    route TEXT,
    event_date_time TEXT,
    contributing_factors TEXT,
    corrective_actions TEXT,
    phase_of_flight TEXT,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
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
    extra_data TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read INTEGER NOT NULL DEFAULT 0,
    related_report_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (related_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'Report Sys',
    company_logo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO settings (id, company_name) VALUES ('default', 'Report Sys');

-- Insert demo user
INSERT OR IGNORE INTO users (id, email, password, first_name, last_name, role) 
VALUES (
    'demo-user-id',
    'demo@airline.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'Demo',
    'User',
    'captain'
);
