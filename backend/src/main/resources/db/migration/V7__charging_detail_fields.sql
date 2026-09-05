ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS charging_target_soc INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS charging_remaining_minutes INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS charging_plug_type VARCHAR(24);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS data_timestamp VARCHAR(14);
