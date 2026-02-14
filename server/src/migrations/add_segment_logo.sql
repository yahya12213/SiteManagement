-- Migration: Add logo_url column to segments table
-- Date: 2026-02-05

ALTER TABLE segments ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Commentaire explicatif
COMMENT ON COLUMN segments.logo_url IS 'URL du logo du segment, affiché sur les bulletins de paie PDF';
