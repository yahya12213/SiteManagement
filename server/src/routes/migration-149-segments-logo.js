/**
 * Migration 149: Add logo support to segments table
 * Adds logo_url and logo_uploaded_at columns for payslip PDF generation
 */

import pool from '../config/database.js';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding logo_url column to segments table...');

    // Add logo_url column
    await client.query(`
      ALTER TABLE segments
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS logo_uploaded_at TIMESTAMP
    `);

    console.log('✓ Segments logo columns added successfully');

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 149 failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Removing logo columns from segments table...');

    await client.query(`
      ALTER TABLE segments
      DROP COLUMN IF EXISTS logo_url,
      DROP COLUMN IF EXISTS logo_uploaded_at
    `);

    console.log('✓ Segments logo columns removed');

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 149 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const info = {
  number: 149,
  name: 'segments-logo',
  description: 'Add logo_url field to segments for payslip PDFs',
  section: 'hr'
};
