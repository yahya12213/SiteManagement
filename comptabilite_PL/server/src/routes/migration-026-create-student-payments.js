import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 026: Create student_payments table
 * Creates table to track individual payment transactions for students in sessions
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 026: Create student_payments table...');

    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'student_payments'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('Table student_payments already exists. Skipping migration.');
      await client.query('ROLLBACK');
      return res.status(200).json({
        success: true,
        message: 'Migration 026: Table already exists'
      });
    }

    // Create student_payments table
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

    console.log('✓ Created student_payments table');

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX idx_student_payments_session_etudiant_id ON student_payments(session_etudiant_id);
    `);

    await client.query(`
      CREATE INDEX idx_student_payments_payment_date ON student_payments(payment_date);
    `);

    console.log('✓ Created indexes on student_payments');

    await client.query('COMMIT');

    console.log('Migration 026 completed successfully!');

    res.status(200).json({
      success: true,
      message: 'Migration 026: student_payments table created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 026 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 026 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
