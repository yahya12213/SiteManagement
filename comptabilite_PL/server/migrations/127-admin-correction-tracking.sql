-- Migration 127: Admin Correction Tracking
-- Adds columns to track when admin cancels correction requests via direct correction

-- Add columns to hr_attendance_correction_requests table
ALTER TABLE hr_attendance_correction_requests
  ADD COLUMN IF NOT EXISTS admin_cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_cancelled_by TEXT REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_cancellation_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN hr_attendance_correction_requests.admin_cancelled_at IS 'Timestamp when admin cancelled this request via direct correction';
COMMENT ON COLUMN hr_attendance_correction_requests.admin_cancelled_by IS 'Profile ID of admin who cancelled this request';
COMMENT ON COLUMN hr_attendance_correction_requests.admin_cancellation_reason IS 'Reason why admin cancelled (usually: Remplacée par correction admin directe)';

-- Create index for queries filtering by admin cancellations
CREATE INDEX IF NOT EXISTS idx_correction_requests_admin_cancelled
  ON hr_attendance_correction_requests(admin_cancelled_by, admin_cancelled_at)
  WHERE admin_cancelled_by IS NOT NULL;

-- Rollback instructions (if needed):
-- ALTER TABLE hr_attendance_correction_requests DROP COLUMN IF EXISTS admin_cancelled_at;
-- ALTER TABLE hr_attendance_correction_requests DROP COLUMN IF EXISTS admin_cancelled_by;
-- ALTER TABLE hr_attendance_correction_requests DROP COLUMN IF EXISTS admin_cancellation_reason;
-- DROP INDEX IF EXISTS idx_correction_requests_admin_cancelled;
