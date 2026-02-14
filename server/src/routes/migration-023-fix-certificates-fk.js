import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 023: Fix certificates table foreign key
 * Changes student_id foreign key from profiles(id) to students(id)
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 023: Fix certificates foreign key...');

    // Check if certificates table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'certificates'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⏭️  certificates table does not exist, skipping migration');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 023 skipped: certificates table does not exist'
      });
    }

    // Check if the old foreign key exists
    const fkCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'certificates'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'certificates_student_id_fkey';
    `);

    if (fkCheck.rows.length > 0) {
      console.log('🔧 Dropping old foreign key constraint...');
      await client.query(`
        ALTER TABLE certificates
        DROP CONSTRAINT certificates_student_id_fkey;
      `);
      console.log('✓ Old foreign key constraint dropped');
    } else {
      console.log('⏭️  Old foreign key constraint does not exist');
    }

    // Check if the new foreign key already exists
    const newFkCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'certificates'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'certificates_student_id_students_fkey';
    `);

    if (newFkCheck.rows.length === 0) {
      console.log('🔧 Adding new foreign key constraint to students table...');
      await client.query(`
        ALTER TABLE certificates
        ADD CONSTRAINT certificates_student_id_students_fkey
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
      `);
      console.log('✓ New foreign key constraint added');
    } else {
      console.log('⏭️  New foreign key constraint already exists');
    }

    await client.query('COMMIT');
    console.log('Migration 023 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 023 completed successfully!',
      details: 'Foreign key updated to reference students table'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 023 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 023 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
