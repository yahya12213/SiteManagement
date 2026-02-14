import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Setup endpoint to create progress tracking tables
 * GET /api/setup-progress/run-setup
 */
router.get('/run-setup', async (req, res) => {
  try {
    console.log('🔧 Starting progress tracking tables setup...');

    // Create enrollments table (online LMS course enrollments)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        last_accessed_at TIMESTAMP,
        progress_percentage INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'dropped')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, formation_id)
      )
    `);
    console.log('✅ enrollments table created');

    // Create video_progress table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_progress (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        video_id TEXT NOT NULL REFERENCES module_videos(id) ON DELETE CASCADE,
        last_watched_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, video_id)
      )
    `);
    console.log('✅ video_progress table created');

    // Create test_attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_attempts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        test_id TEXT NOT NULL REFERENCES module_tests(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        total_points INTEGER NOT NULL,
        passed BOOLEAN DEFAULT FALSE,
        answers JSONB DEFAULT '{}'::jsonb,
        completed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ test_attempts table created');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_student
      ON enrollments(student_id);

      CREATE INDEX IF NOT EXISTS idx_enrollments_formation
      ON enrollments(formation_id);

      CREATE INDEX IF NOT EXISTS idx_enrollments_status
      ON enrollments(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_progress_student
      ON video_progress(student_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_progress_video
      ON video_progress(video_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_attempts_student
      ON test_attempts(student_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_attempts_test
      ON test_attempts(test_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_attempts_completed
      ON test_attempts(completed_at DESC)
    `);

    console.log('✅ Indexes created');

    console.log('🎉 Progress tracking setup complete!');

    res.json({
      success: true,
      message: 'Progress tracking tables created successfully',
      tables: ['enrollments', 'video_progress', 'test_attempts'],
    });
  } catch (error) {
    console.error('❌ Error during progress setup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

export default router;
