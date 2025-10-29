-- Add all missing columns to reports table
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
