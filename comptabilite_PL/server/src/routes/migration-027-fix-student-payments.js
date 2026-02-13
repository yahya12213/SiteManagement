import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 027: Fix student_payments table structure
 * Drops and recreates the table with correct structure
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 027: Fix student_payments table...');

    // Drop existing table if it exists
    await client.query(`DROP TABLE IF EXISTS student_payments CASCADE;`);
    console.log('✓ Dropped existing student_payments table');

    // Recreate table with correct structure
    await client.query(`
      CREATE TABLE student_payments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_etudiant_id TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('especes', 'virement', 'cheque', 'carte', 'autre')),
        reference_number TEXT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_etudiant_id) REFERENCES session_etudiants(id) ON DELETE CASCADE
      );
    `);

    console.log('✓ Created student_payments table with correct structure');

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX idx_student_payments_session_etudiant_id ON student_payments(session_etudiant_id);
    `);

    await client.query(`
      CREATE INDEX idx_student_payments_payment_date ON student_payments(payment_date);
    `);

    console.log('✓ Created indexes on student_payments');

    await client.query('COMMIT');

    console.log('Migration 027 completed successfully!');

    res.status(200).json({
      success: true,
      message: 'Migration 027: student_payments table fixed successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 027 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 027 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
