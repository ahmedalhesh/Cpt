-- Fix notifications table - add missing updated_at column
ALTER TABLE notifications ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
