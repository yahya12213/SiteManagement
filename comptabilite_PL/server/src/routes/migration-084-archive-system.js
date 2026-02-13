/**
 * Migration 084: Archive System for Student Documents
 *
 * Purpose: Create archive structure for storing student PDFs on Railway
 *
 * Changes:
 * - Add session_id, file_path, archive_folder columns to certificates table
 * - Create archive_folders table for session folders
 * - Create student_archive_folders table for student subfolders
 * - Add necessary indexes for performance
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 084: Archive System ===\n');

    // 1. Add columns to certificates table
    console.log('Step 1: Adding columns to certificates table...');

    const checkSessionId = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'session_id'
    `);

    if (checkSessionId.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN session_id TEXT REFERENCES sessions_formation(id) ON DELETE SET NULL
      `);
      console.log('✓ Added session_id column');
    } else {
      console.log('⚠ session_id column already exists');
    }

    const checkFilePath = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'file_path'
    `);

    if (checkFilePath.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN file_path TEXT
      `);
      console.log('✓ Added file_path column');
    } else {
      console.log('⚠ file_path column already exists');
    }

    const checkArchiveFolder = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'archive_folder'
    `);

    if (checkArchiveFolder.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN archive_folder TEXT
      `);
      console.log('✓ Added archive_folder column');
    } else {
      console.log('⚠ archive_folder column already exists');
    }

    // 2. Create indexes
    console.log('\nStep 2: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_certificates_session_id ON certificates(session_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_certificates_file_path ON certificates(file_path)
    `);
    console.log('✓ Indexes created');

    // 3. Create archive_folders table
    console.log('\nStep 3: Creating archive_folders table...');

    const checkArchiveFoldersTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'archive_folders'
    `);

    if (checkArchiveFoldersTable.rows.length === 0) {
      await client.query(`
        CREATE TABLE archive_folders (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
          folder_path TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Created archive_folders table');
    } else {
      console.log('⚠ archive_folders table already exists');
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_folders_session ON archive_folders(session_id)
    `);

    // 4. Create student_archive_folders table
    console.log('\nStep 4: Creating student_archive_folders table...');

    const checkStudentArchiveFoldersTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'student_archive_folders'
    `);

    if (checkStudentArchiveFoldersTable.rows.length === 0) {
      await client.query(`
        CREATE TABLE student_archive_folders (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          folder_path TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, student_id)
        )
      `);
      console.log('✓ Created student_archive_folders table');
    } else {
      console.log('⚠ student_archive_folders table already exists');
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_archive_session ON student_archive_folders(session_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_archive_student ON student_archive_folders(student_id)
    `);

    await client.query('COMMIT');

    console.log('\n=== Migration 084 completed successfully! ===');
    console.log('\n📋 Summary:');
    console.log('  - Added columns to certificates table: session_id, file_path, archive_folder');
    console.log('  - Created archive_folders table for session folders');
    console.log('  - Created student_archive_folders table for student subfolders');
    console.log('  - Created indexes for performance');
    console.log('\n✅ Archive system ready for use!\n');

    res.json({
      success: true,
      message: 'Archive system tables and columns created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 084 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Check if tables exist
    const checkTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('archive_folders', 'student_archive_folders')
    `);

    const tablesExist = checkTables.rows.length === 2;

    // Check if columns exist
    const checkColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates'
        AND column_name IN ('session_id', 'file_path', 'archive_folder')
    `);

    const columnsExist = checkColumns.rows.length === 3;

    const applied = tablesExist && columnsExist;

    res.json({
      status: {
        migrationNeeded: !applied,
        applied: applied,
        details: {
          tablesExist,
          columnsExist
        }
      },
      message: applied
        ? 'Archive system tables and columns exist'
        : 'Archive system not fully configured - run migration to create tables and columns'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
