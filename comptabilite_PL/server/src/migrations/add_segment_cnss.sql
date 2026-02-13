-- Add cnss_number column to segments table
-- This stores the employer CNSS number for each segment
ALTER TABLE segments ADD COLUMN IF NOT EXISTS cnss_number VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN segments.cnss_number IS 'Employer CNSS number for this segment (appears on payslips)';
