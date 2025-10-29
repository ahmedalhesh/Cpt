-- Add missing columns to reports table for ASR plots and other fields

-- ASR plot columns
ALTER TABLE reports ADD COLUMN plan_image TEXT;
ALTER TABLE reports ADD COLUMN elev_image TEXT;
ALTER TABLE reports ADD COLUMN plan_units TEXT;
ALTER TABLE reports ADD COLUMN plan_grid_x INTEGER;
ALTER TABLE reports ADD COLUMN plan_grid_y INTEGER;
ALTER TABLE reports ADD COLUMN plan_distance_x REAL;
ALTER TABLE reports ADD COLUMN plan_distance_y REAL;
ALTER TABLE reports ADD COLUMN elev_grid_col INTEGER;
ALTER TABLE reports ADD COLUMN elev_grid_row INTEGER;
ALTER TABLE reports ADD COLUMN elev_distance_horiz_m REAL;
ALTER TABLE reports ADD COLUMN elev_distance_vert_ft REAL;

-- Other missing columns
ALTER TABLE reports ADD COLUMN follow_up_actions TEXT;
ALTER TABLE reports ADD COLUMN ground_crew_names TEXT;
ALTER TABLE reports ADD COLUMN vehicle_involved TEXT;
ALTER TABLE reports ADD COLUMN damage_type TEXT;
ALTER TABLE reports ADD COLUMN corrective_steps TEXT;
ALTER TABLE reports ADD COLUMN department TEXT;
ALTER TABLE reports ADD COLUMN nonconformity_type TEXT;
ALTER TABLE reports ADD COLUMN root_cause TEXT;
ALTER TABLE reports ADD COLUMN responsible_person TEXT;
ALTER TABLE reports ADD COLUMN preventive_actions TEXT;
ALTER TABLE reports ADD COLUMN discretion_reason TEXT;
ALTER TABLE reports ADD COLUMN time_extension TEXT;
ALTER TABLE reports ADD COLUMN crew_fatigue_details TEXT;
ALTER TABLE reports ADD COLUMN final_decision TEXT;
ALTER TABLE reports ADD COLUMN potential_impact TEXT;
ALTER TABLE reports ADD COLUMN prevention_suggestions TEXT;
