import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 011: Créer la table student_payments
 * Cette table enregistre tous les paiements individuels des étudiants
 * pour le calcul automatique du total payé et du reste à payer
 *
 * GET /api/migration-011/create-student-payments-table
 */
router.get('/create-student-payments-table', async (req, res) => {
  try {
    console.log('🔧 Migration 011: Creating student_payments table...');

    // Vérifier si la table existe déjà
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'student_payments'
    `);

    if (checkTable.rows.length > 0) {
      console.log('✅ Table student_payments already exists');
      return res.json({
        success: true,
        message: 'Table student_payments already exists',
        alreadyExists: true,
      });
    }

    // Créer la table student_payments
    await pool.query(`
      CREATE TABLE student_payments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        enrollment_id TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method TEXT CHECK(payment_method IN ('especes', 'virement', 'cheque', 'carte', 'autre')),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (enrollment_id) REFERENCES formation_enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Table student_payments created');

    // Créer un index sur enrollment_id pour les requêtes rapides
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_student_payments_enrollment_id
      ON student_payments(enrollment_id)
    `);
    console.log('✅ Index on enrollment_id created');

    // Créer un index sur payment_date pour les filtres temporels
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_student_payments_payment_date
      ON student_payments(payment_date)
    `);
    console.log('✅ Index on payment_date created');

    console.log('🎉 Migration 011 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 011 completed: student_payments table created',
      changes: [
        'Created student_payments table',
        'Fields: id, enrollment_id, amount, payment_date, payment_method, note, created_at, created_by',
        'Added CHECK constraint: amount > 0',
        'Added CHECK constraint: payment_method IN (especes, virement, cheque, carte, autre)',
        'Created index on enrollment_id',
        'Created index on payment_date',
      ],
    });
  } catch (error) {
    console.error('❌ Error during migration 011:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Diagnostic: vérifier la structure de la table student_payments
 * GET /api/migration-011/check-structure
 */
router.get('/check-structure', async (req, res) => {
  try {
    // Vérifier si la table existe
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'student_payments'
    `);

    if (checkTable.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        message: 'Table student_payments does not exist yet',
      });
    }

    // Obtenir les colonnes
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'student_payments'
      ORDER BY ordinal_position
    `);

    // Obtenir les contraintes
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'student_payments'
    `);

    // Compter les enregistrements et calculer le total
    const stats = await pool.query(`
      SELECT
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(DISTINCT enrollment_id) as unique_students
      FROM student_payments
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
