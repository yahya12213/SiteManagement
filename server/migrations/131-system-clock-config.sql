-- Migration 131: Initialize system_clock configuration
-- Creates the system_clock setting in hr_settings table for the configurable clock feature

-- Insert system_clock setting if it doesn't exist
INSERT INTO hr_settings (setting_key, setting_value, description, category, created_at)
VALUES (
  'system_clock',
  '{"enabled": false, "offset_minutes": 0}',
  'Configuration de l''horloge système pour le pointage. Permet de définir un décalage horaire personnalisé.',
  'attendance',
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN hr_settings.setting_value IS 'JSON value for the setting. For system_clock: {enabled: boolean, offset_minutes: number, updated_at: string, updated_by: string}';
