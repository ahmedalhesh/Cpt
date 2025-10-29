-- Add missing image columns to reports table
ALTER TABLE reports ADD COLUMN plan_image TEXT;
ALTER TABLE reports ADD COLUMN elev_image TEXT;
