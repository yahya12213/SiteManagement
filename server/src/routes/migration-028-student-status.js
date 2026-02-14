import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/migration-028/run
 * Add status column to students table for valid/abandoned tracking
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration 028 - Add student status...');

    await client.query('BEGIN');

    // Add status column to students table
    const addStatusColumn = await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'students' AND column_name = 'status'
        ) THEN
          ALTER TABLE students ADD COLUMN status VARCHAR(20) DEFAULT 'valide' NOT NULL;
          RAISE NOTICE 'Added status column to students table';
        ELSE
          RAISE NOTICE 'status column already exists in students table';
        END IF;
      END $$;
    `);

    // Add check constraint for valid status values
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.constraint_column_usage
          WHERE table_name = 'students' AND constraint_name = 'students_status_check'
        ) THEN
          ALTER TABLE students ADD CONSTRAINT students_status_check
            CHECK (status IN ('valide', 'abandonne'));
          RAISE NOTICE 'Added status check constraint';
        ELSE
          RAISE NOTICE 'status check constraint already exists';
        END IF;
      END $$;
    `);

    // Add status column to session_etudiants table for per-session status
    const addSessionStatusColumn = await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'session_etudiants' AND column_name = 'student_status'
        ) THEN
          ALTER TABLE session_etudiants ADD COLUMN student_status VARCHAR(20) DEFAULT 'valide' NOT NULL;
          RAISE NOTICE 'Added student_status column to session_etudiants table';
        ELSE
          RAISE NOTICE 'student_status column already exists in session_etudiants table';
        END IF;
      END $$;
    `);

    // Add check constraint for session_etudiants status
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.constraint_column_usage
          WHERE table_name = 'session_etudiants' AND constraint_name = 'session_etudiants_status_check'
        ) THEN
          ALTER TABLE session_etudiants ADD CONSTRAINT session_etudiants_status_check
            CHECK (student_status IN ('valide', 'abandonne'));
          RAISE NOTICE 'Added student_status check constraint to session_etudiants';
        ELSE
          RAISE NOTICE 'student_status check constraint already exists';
        END IF;
      END $$;
    `);

    // Create index for faster status queries
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'students' AND indexname = 'idx_students_status'
        ) THEN
          CREATE INDEX idx_students_status ON students(status);
          RAISE NOTICE 'Created index on students.status';
        ELSE
          RAISE NOTICE 'Index on students.status already exists';
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'session_etudiants' AND indexname = 'idx_session_etudiants_student_status'
        ) THEN
          CREATE INDEX idx_session_etudiants_student_status ON session_etudiants(student_status);
          RAISE NOTICE 'Created index on session_etudiants.student_status';
        ELSE
          RAISE NOTICE 'Index on session_etudiants.student_status already exists';
        END IF;
      END $$;
    `);

    await client.query('COMMIT');

    console.log('✅ Migration 028 completed successfully');

    res.json({
      success: true,
      message: 'Migration 028 completed - Student status columns added',
      changes: [
        'Added status column to students table (default: valide)',
        'Added student_status column to session_etudiants table (default: valide)',
        'Added check constraints for valid values (valide, abandonne)',
        'Created indexes for performance',
      ],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 028 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/migration-028/status
 * Check if migration has been applied
 */
router.get('/status', async (req, res) => {
  try {
    const statusColumn = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'status'
      ) as exists
    `);

    const sessionStatusColumn = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'session_etudiants' AND column_name = 'student_status'
      ) as exists
    `);

    res.json({
      success: true,
      migration_applied: statusColumn.rows[0].exists && sessionStatusColumn.rows[0].exists,
      details: {
        students_status_column: statusColumn.rows[0].exists,
        session_etudiants_status_column: sessionStatusColumn.rows[0].exists,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
