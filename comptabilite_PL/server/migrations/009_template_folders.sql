-- Migration 009: Template Folders System
-- Adds hierarchical folder structure for certificate templates
-- Removes is_default concept and formations.default_certificate_template_id

-- STEP 1: Create template_folders table
CREATE TABLE IF NOT EXISTS template_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES template_folders(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent self-reference (circular dependency at direct level)
  CONSTRAINT no_self_reference CHECK (id != parent_id)
);

-- STEP 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_folders_parent ON template_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_template_folders_created_by ON template_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_template_folders_name ON template_folders(name);

-- STEP 3: Add folder_id to certificate_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_templates' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE certificate_templates
    ADD COLUMN folder_id UUID REFERENCES template_folders(id) ON DELETE RESTRICT;

    CREATE INDEX idx_certificate_templates_folder ON certificate_templates(folder_id);
  END IF;
END $$;

-- STEP 4: Create default "Général" folder for existing templates
DO $$
DECLARE
  general_folder_id UUID;
BEGIN
  -- Check if "Général" folder already exists
  SELECT id INTO general_folder_id FROM template_folders WHERE name = 'Général' AND parent_id IS NULL LIMIT 1;

  -- If not exists, create it
  IF general_folder_id IS NULL THEN
    INSERT INTO template_folders (name, parent_id, created_by)
    VALUES ('Général', NULL, NULL)
    RETURNING id INTO general_folder_id;
  END IF;

  -- Move all templates without folder to "Général"
  UPDATE certificate_templates
  SET folder_id = general_folder_id
  WHERE folder_id IS NULL;
END $$;

-- STEP 5: Remove is_default column from certificate_templates (concept supprimé)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE certificate_templates DROP COLUMN is_default;
  END IF;
END $$;

-- STEP 6: Remove default_certificate_template_id from formations (concept supprimé)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formations' AND column_name = 'default_certificate_template_id'
  ) THEN
    ALTER TABLE formations DROP COLUMN default_certificate_template_id;
  END IF;
END $$;

-- STEP 7: Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_folders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_template_folders_timestamp'
  ) THEN
    CREATE TRIGGER trigger_update_template_folders_timestamp
    BEFORE UPDATE ON template_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_template_folders_timestamp();
  END IF;
END $$;
