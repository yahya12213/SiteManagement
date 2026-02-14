-- Migration: Ajouter support pour image d'arrière-plan dans les templates
-- Date: 2025-11-03

-- Ajouter colonnes pour l'image d'arrière-plan
ALTER TABLE certificate_templates
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS background_image_type VARCHAR(10) DEFAULT 'url';

-- Commentaires
COMMENT ON COLUMN certificate_templates.background_image_url IS 'URL ou chemin vers l''image d''arrière-plan du certificat';
COMMENT ON COLUMN certificate_templates.background_image_type IS 'Type de source: url (lien externe) ou upload (fichier uploadé)';
