import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 012: Créer la table formation_templates
 * Cette table mappe chaque formation aux templates Canvas appropriés
 * pour la génération automatique de documents (certificats, attestations, etc.)
 *
 * GET /api/migration-012/create-formation-templates-table
 */
router.get('/create-formation-templates-table', async (req, res) => {
  try {
    console.log('🔧 Migration 012: Creating formation_templates table...');

    // Vérifier si la table existe déjà
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'formation_templates'
    `);

    if (checkTable.rows.length > 0) {
      console.log('✅ Table formation_templates already exists');
      return res.json({
        success: true,
        message: 'Table formation_templates already exists',
        alreadyExists: true,
      });
    }

    // Créer la table formation_templates
    await pool.query(`
      CREATE TABLE formation_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        formation_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'certificat' CHECK(document_type IN ('certificat', 'attestation', 'diplome', 'autre')),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE CASCADE,
        UNIQUE(formation_id, template_id, document_type)
      )
    `);
    console.log('✅ Table formation_templates created');

    // Créer un index sur formation_id pour les requêtes rapides
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_templates_formation_id
      ON formation_templates(formation_id)
    `);
    console.log('✅ Index on formation_id created');

    // Créer un index sur template_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_templates_template_id
      ON formation_templates(template_id)
    `);
    console.log('✅ Index on template_id created');

    // Créer un index sur document_type pour les filtres
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_templates_document_type
      ON formation_templates(document_type)
    `);
    console.log('✅ Index on document_type created');

    // Créer un index sur is_default pour trouver rapidement le template par défaut
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_templates_is_default
      ON formation_templates(is_default)
      WHERE is_default = true
    `);
    console.log('✅ Partial index on is_default created');

    console.log('🎉 Migration 012 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 012 completed: formation_templates table created',
      changes: [
        'Created formation_templates table',
        'Fields: id, formation_id, template_id, document_type, is_default, created_at, updated_at',
        'Added CHECK constraint: document_type IN (certificat, attestation, diplome, autre)',
        'Added UNIQUE constraint on (formation_id, template_id, document_type)',
        'Created index on formation_id',
        'Created index on template_id',
        'Created index on document_type',
        'Created partial index on is_default (WHERE is_default = true)',
      ],
    });
  } catch (error) {
    console.error('❌ Error during migration 012:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Diagnostic: vérifier la structure de la table formation_templates
 * GET /api/migration-012/check-structure
 */
router.get('/check-structure', async (req, res) => {
  try {
    // Vérifier si la table existe
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'formation_templates'
    `);

    if (checkTable.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        message: 'Table formation_templates does not exist yet',
      });
    }

    // Obtenir les colonnes
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'formation_templates'
      ORDER BY ordinal_position
    `);

    // Obtenir les contraintes
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'formation_templates'
    `);

    // Obtenir les statistiques
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_mappings,
        COUNT(DISTINCT formation_id) as formations_with_templates,
        COUNT(DISTINCT template_id) as unique_templates_used,
        COUNT(*) FILTER (WHERE is_default = true) as default_templates_count
      FROM formation_templates
    `);

    res.json({
      success: true,
      exists: true,
      columns: columns.rows,
      constraints: constraints.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error('Error checking structure:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
