import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 013: Étendre la table formation_enrollments
 * Ajoute les champs pour les remises individuelles et la validation des étudiants
 *
 * GET /api/migration-013/extend-formation-enrollments
 */
router.get('/extend-formation-enrollments', async (req, res) => {
  try {
    console.log('🔧 Migration 013: Extending formation_enrollments table...');

    const columnsToAdd = [
      {
        name: 'discount_amount',
        definition: 'DECIMAL(10, 2) DEFAULT 0 CHECK (discount_amount >= 0)',
        description: 'Montant de la remise individuelle',
      },
      {
        name: 'validation_status',
        definition: "TEXT DEFAULT 'non_valide' CHECK(validation_status IN ('valide', 'non_valide'))",
        description: 'Statut de validation de l\'étudiant',
      },
      {
        name: 'validated_by',
        definition: 'TEXT REFERENCES profiles(id) ON DELETE SET NULL',
        description: 'ID de l\'utilisateur qui a validé',
      },
      {
        name: 'validated_at',
        definition: 'TIMESTAMP',
        description: 'Date et heure de validation',
      },
    ];

    const results = [];

    for (const column of columnsToAdd) {
      // Vérifier si la colonne existe déjà
      const checkColumn = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'formation_enrollments'
        AND column_name = $1
      `, [column.name]);

      if (checkColumn.rows.length > 0) {
        console.log(`✅ Column ${column.name} already exists`);
        results.push({
          column: column.name,
          status: 'already_exists',
          message: `Column ${column.name} already exists`,
        });
      } else {
        // Ajouter la colonne
        await pool.query(`
          ALTER TABLE formation_enrollments
          ADD COLUMN ${column.name} ${column.definition}
        `);
        console.log(`✅ Column ${column.name} added successfully`);
        results.push({
          column: column.name,
          status: 'added',
          message: `Column ${column.name} added: ${column.description}`,
        });
      }
    }

    // Créer un index sur validation_status pour les filtres
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_enrollments_validation_status
      ON formation_enrollments(validation_status)
    `);
    console.log('✅ Index on validation_status created');

    // Créer un index sur validated_by
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_enrollments_validated_by
      ON formation_enrollments(validated_by)
    `);
    console.log('✅ Index on validated_by created');

    console.log('🎉 Migration 013 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 013 completed: formation_enrollments table extended',
      columns: results,
      indexes: [
        'Created index on validation_status',
        'Created index on validated_by',
      ],
    });
  } catch (error) {
    console.error('❌ Error during migration 013:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Diagnostic: vérifier la structure de la table formation_enrollments
 * GET /api/migration-013/check-structure
 */
router.get('/check-structure', async (req, res) => {
  try {
    // Obtenir toutes les colonnes de la table
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'formation_enrollments'
      ORDER BY ordinal_position
    `);

    // Vérifier quelles colonnes de migration existent
    const migrationColumns = ['discount_amount', 'validation_status', 'validated_by', 'validated_at'];
    const existingMigrationColumns = columns.rows
      .filter(col => migrationColumns.includes(col.column_name))
      .map(col => col.column_name);

    const missingMigrationColumns = migrationColumns.filter(
      col => !existingMigrationColumns.includes(col)
    );

    // Obtenir les statistiques de validation
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(*) FILTER (WHERE validation_status = 'valide') as validated_count,
        COUNT(*) FILTER (WHERE validation_status = 'non_valide') as not_validated_count,
        COALESCE(AVG(discount_amount), 0) as avg_discount,
        COALESCE(SUM(discount_amount), 0) as total_discount
      FROM formation_enrollments
    `);

    res.json({
      success: true,
      all_columns: columns.rows,
      migration_status: {
        existing: existingMigrationColumns,
        missing: missingMigrationColumns,
        is_complete: missingMigrationColumns.length === 0,
      },
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
