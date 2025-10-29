-- Fix users table - add missing profile_image_url column
ALTER TABLE users ADD COLUMN profile_image_url TEXT;
