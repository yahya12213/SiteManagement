/**
 * Migration 150: Add PDF storage fields to hr_payslips table
 * Adds pdf_path and pdf_generated_at columns for bulletin PDF archiving
 */

import pool from '../config/database.js';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding pdf_path column to hr_payslips table...');

    // Add PDF storage columns
    await client.query(`
      ALTER TABLE hr_payslips
      ADD COLUMN IF NOT EXISTS pdf_path TEXT,
      ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP
    `);

    console.log('✓ Payslips pdf_path columns added successfully');

    // Create uploads directory structure comment
    console.log('Note: Ensure /uploads/payslips/ directory exists with proper permissions');

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 150 failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Removing pdf_path columns from hr_payslips table...');

    await client.query(`
      ALTER TABLE hr_payslips
      DROP COLUMN IF EXISTS pdf_path,
      DROP COLUMN IF EXISTS pdf_generated_at
    `);

    console.log('✓ Payslips pdf_path columns removed');

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 150 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const info = {
  number: 150,
  name: 'payslips-pdf-path',
  description: 'Add pdf_path and pdf_generated_at fields to hr_payslips for bulletin archiving',
  section: 'hr'
};
