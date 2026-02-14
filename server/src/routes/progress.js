import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission, getUserPermissions } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// VIDEO PROGRESS ENDPOINTS
// ============================================

/**
 * POST /api/progress/videos/:videoId/complete
 * Mark a video as completed for the current user
 * Permissions: course.videos.view (students)
 */
router.post('/videos/:videoId/complete', requirePermission('training.student.course.videos.view'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Insert or update video progress
    const result = await pool.query(
      `INSERT INTO video_progress (student_id, video_id, completed_at, last_watched_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (student_id, video_id)
       DO UPDATE SET completed_at = NOW(), last_watched_at = NOW()
       RETURNING *`,
      [userId, videoId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking video complete:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la progression' });
  }
});

/**
 * POST /api/progress/videos/:videoId/watch
 * Record that a user watched a video (without marking complete)
 * Permissions: course.videos.view (students)
 */
router.post('/videos/:videoId/watch', requirePermission('training.student.course.videos.view'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Insert or update last watched timestamp
    const result = await pool.query(
      `INSERT INTO video_progress (student_id, video_id, last_watched_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (student_id, video_id)
       DO UPDATE SET last_watched_at = NOW()
       RETURNING *`,
      [userId, videoId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error recording video watch:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

/**
 * GET /api/progress/formations/:formationId/videos
 * Get video progress for a formation
 * Permissions: course.videos.view (students)
 */
router.get('/formations/:formationId/videos', requirePermission('training.student.course.videos.view'), async (req, res) => {
  try {
    const { formationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const result = await pool.query(
      `SELECT vp.*, v.module_id
       FROM video_progress vp
       JOIN module_videos v ON v.id = vp.video_id
       JOIN formation_modules m ON m.id = v.module_id
       WHERE m.formation_id = $1 AND vp.student_id = $2`,
      [formationId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching video progress:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ============================================
// TEST ATTEMPT ENDPOINTS
// ============================================

/**
 * POST /api/progress/tests/:testId/attempts
 * Submit a test attempt with answers and score
 * Permissions: course.tests.take (students)
 */
router.post('/tests/:testId/attempts', requirePermission('training.student.course.tests.take'), async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user?.id;
    const { answers, score, total_points, passed } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Validate required fields
    if (typeof score !== 'number' || typeof total_points !== 'number') {
      return res.status(400).json({ error: 'Score et total_points requis' });
    }

    // Check max attempts
    const test = await pool.query(
      'SELECT max_attempts FROM module_tests WHERE id = $1',
      [testId]
    );

    if (test.rows.length === 0) {
      return res.status(404).json({ error: 'Test introuvable' });
    }

    const maxAttempts = test.rows[0].max_attempts;

    if (maxAttempts) {
      const attemptsCount = await pool.query(
        'SELECT COUNT(*) as count FROM test_attempts WHERE student_id = $1 AND test_id = $2',
        [userId, testId]
      );

      if (parseInt(attemptsCount.rows[0].count) >= maxAttempts) {
        return res.status(400).json({
          error: `Nombre maximum de tentatives atteint (${maxAttempts})`
        });
      }
    }

    // Insert test attempt
    const result = await pool.query(
      `INSERT INTO test_attempts (student_id, test_id, score, total_points, passed, answers, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [userId, testId, score, total_points, passed, JSON.stringify(answers || {})]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error recording test attempt:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la tentative' });
  }
});

/**
 * GET /api/progress/tests/:testId/attempts
 * Get all attempts for a test by the current user
 * Permissions: course.tests.take (students)
 */
router.get('/tests/:testId/attempts', requirePermission('training.student.course.tests.take'), async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const result = await pool.query(
      `SELECT id, student_id, test_id, score, total_points, passed, completed_at,
              created_at
       FROM test_attempts
       WHERE student_id = $1 AND test_id = $2
       ORDER BY completed_at DESC`,
      [userId, testId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching test attempts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * GET /api/progress/formations/:formationId/tests
 * Get test attempts for all tests in a formation
 * Permissions: course.tests.take (students)
 */
router.get('/formations/:formationId/tests', requirePermission('training.student.course.tests.take'), async (req, res) => {
  try {
    const { formationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const result = await pool.query(
      `SELECT ta.*, t.module_id, t.title as test_title
       FROM test_attempts ta
       JOIN module_tests t ON t.id = ta.test_id
       JOIN formation_modules m ON m.id = t.module_id
       WHERE m.formation_id = $1 AND ta.student_id = $2
       ORDER BY ta.completed_at DESC`,
      [formationId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching formation test attempts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ============================================
// OVERALL PROGRESS ENDPOINTS
// ============================================

/**
 * GET /api/progress/formations/:formationId
 * Get complete progress for a formation (videos + tests)
 * Permissions: course.view (students)
 */
router.get('/formations/:formationId', requirePermission('training.student.course.view'), async (req, res) => {
  try {
    const { formationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Get formation details
    const formation = await pool.query(
      'SELECT * FROM formations WHERE id = $1',
      [formationId]
    );

    if (formation.rows.length === 0) {
      return res.status(404).json({ error: 'Formation introuvable' });
    }

    // Get video progress
    const videoProgress = await pool.query(
      `SELECT vp.*, v.module_id, v.title as video_title
       FROM video_progress vp
       JOIN module_videos v ON v.id = vp.video_id
       JOIN formation_modules m ON m.id = v.module_id
       WHERE m.formation_id = $1 AND vp.student_id = $2`,
      [formationId, userId]
    );

    // Get test attempts (best score per test)
    const testAttempts = await pool.query(
      `SELECT DISTINCT ON (ta.test_id)
              ta.*, t.module_id, t.title as test_title, t.passing_score
       FROM test_attempts ta
       JOIN module_tests t ON t.id = ta.test_id
       JOIN formation_modules m ON m.id = t.module_id
       WHERE m.formation_id = $1 AND ta.student_id = $2
       ORDER BY ta.test_id, ta.score DESC`,
      [formationId, userId]
    );

    // Get total counts
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM module_videos v
          JOIN formation_modules m ON m.id = v.module_id
          WHERE m.formation_id = $1) as total_videos,
         (SELECT COUNT(*) FROM module_tests t
          JOIN formation_modules m ON m.id = t.module_id
          WHERE m.formation_id = $1) as total_tests`,
      [formationId]
    );

    const completedVideos = videoProgress.rows.filter(v => v.completed_at).length;
    const passedTests = testAttempts.rows.filter(t => t.passed).length;
    const totalVideos = parseInt(counts.rows[0].total_videos);
    const totalTests = parseInt(counts.rows[0].total_tests);

    const overallProgress = totalVideos + totalTests > 0
      ? Math.round(((completedVideos + passedTests) / (totalVideos + totalTests)) * 100)
      : 0;

    res.json({
      formation: formation.rows[0],
      video_progress: videoProgress.rows,
      test_attempts: testAttempts.rows,
      summary: {
        total_videos: totalVideos,
        completed_videos: completedVideos,
        total_tests: totalTests,
        passed_tests: passedTests,
        overall_progress: overallProgress,
      },
    });
  } catch (error) {
    console.error('Error fetching formation progress:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la progression' });
  }
});

/**
 * GET /api/progress/student/:studentId/transcript
 * Get complete transcript for a student
 * Protected: Users with training.student_reports.view_page permission can view any student
 *            Students can view their own transcript
 * Permissions: training.student_reports.view_page (admin/staff) OR own transcript
 */
router.get('/student/:studentId/transcript', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.user;

    // Check authentication
    if (!currentUser?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Security check: Users can view their own transcript OR have the appropriate permission
    const isOwnTranscript = currentUser.id === studentId;

    if (!isOwnTranscript) {
      // Check if user has permission to view other students' transcripts
      const userPermissions = await getUserPermissions(currentUser.id);
      const hasPermission = userPermissions.includes('training.student_reports.view_page') || userPermissions.includes('*');

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own transcript or you need training.student_reports.view_page permission.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // Get all enrollments with formation info
    const enrollments = await pool.query(
      `SELECT
         se.id as enrollment_id,
         se.enrolled_at,
         s.id as session_id,
         s.start_date,
         s.end_date,
         s.status as session_status,
         f.id as formation_id,
         f.title as formation_title,
         f.level,
         f.passing_score_percentage
       FROM session_enrollments se
       JOIN sessions s ON s.id = se.session_id
       JOIN formations f ON f.id = s.formation_id
       WHERE se.student_id = $1
       ORDER BY se.enrolled_at DESC`,
      [studentId]
    );

    // For each enrollment, get progress
    const transcript = await Promise.all(
      enrollments.rows.map(async (enrollment) => {
        // Get video progress
        const videoProgress = await pool.query(
          `SELECT vp.*
           FROM video_progress vp
           JOIN module_videos v ON v.id = vp.video_id
           JOIN formation_modules m ON m.id = v.module_id
           WHERE m.formation_id = $1 AND vp.student_id = $2`,
          [enrollment.formation_id, studentId]
        );

        // Get test attempts (best scores)
        const testAttempts = await pool.query(
          `SELECT DISTINCT ON (ta.test_id)
                  ta.*, t.title as test_title, t.passing_score
           FROM test_attempts ta
           JOIN module_tests t ON t.id = ta.test_id
           JOIN formation_modules m ON m.id = t.module_id
           WHERE m.formation_id = $1 AND ta.student_id = $2
           ORDER BY ta.test_id, ta.score DESC`,
          [enrollment.formation_id, studentId]
        );

        // Get counts
        const counts = await pool.query(
          `SELECT
             (SELECT COUNT(*) FROM module_videos v
              JOIN formation_modules m ON m.id = v.module_id
              WHERE m.formation_id = $1) as total_videos,
             (SELECT COUNT(*) FROM module_tests t
              JOIN formation_modules m ON m.id = t.module_id
              WHERE m.formation_id = $1) as total_tests`,
          [enrollment.formation_id]
        );

        const completedVideos = videoProgress.rows.filter(v => v.completed_at).length;
        const passedTests = testAttempts.rows.filter(t => t.passed).length;
        const totalVideos = parseInt(counts.rows[0].total_videos);
        const totalTests = parseInt(counts.rows[0].total_tests);

        const overallProgress = totalVideos + totalTests > 0
          ? Math.round(((completedVideos + passedTests) / (totalVideos + totalTests)) * 100)
          : 0;

        return {
          ...enrollment,
          progress: {
            total_videos: totalVideos,
            completed_videos: completedVideos,
            total_tests: totalTests,
            passed_tests: passedTests,
            overall_progress: overallProgress,
          },
          test_scores: testAttempts.rows.map(t => ({
            test_id: t.test_id,
            test_title: t.test_title,
            score: t.score,
            total_points: t.total_points,
            passed: t.passed,
            completed_at: t.completed_at,
          })),
        };
      })
    );

    res.json(transcript);
  } catch (error) {
    console.error('Error fetching student transcript:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du relevé' });
  }
});

export default router;
