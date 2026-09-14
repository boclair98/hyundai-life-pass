ALTER TABLE vehicle_journal ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vehicle_journal_vehicle_status_date
  ON vehicle_journal(vehicle_id, status, entry_date);
