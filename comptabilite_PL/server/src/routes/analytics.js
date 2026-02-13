import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission, getUserPermissions } from '../middleware/auth.js';

const router = express.Router();

/**
 * Statistiques générales du système
 * GET /api/analytics/overview
 * Protected: Admin/Staff only
 */
router.get('/overview',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    // Récupérer toutes les statistiques en parallèle
    const [
      totalStudents,
      totalFormations,
      totalSessions,
      activeSessions,
      totalEnrollments,
      completedEnrollments,
      totalVideoProgress,
      completedVideos,
      totalTestAttempts,
      passedTests,
    ] = await Promise.all([
      // Nombre total d'étudiants (role = 'student')
      pool.query(`
        SELECT COUNT(*) as count
        FROM profiles
        WHERE role = 'student'
      `),

      // Nombre total de formations
      pool.query(`
        SELECT COUNT(*) as count
        FROM formations
      `),

      // Nombre total de sessions
      pool.query(`
        SELECT COUNT(*) as count
        FROM formation_sessions
      `),

      // Sessions actives (status = 'active' ET dans la période)
      pool.query(`
        SELECT COUNT(*) as count
        FROM formation_sessions
        WHERE status = 'active'
        AND start_date::date <= CURRENT_DATE
        AND end_date::date >= CURRENT_DATE
      `),

      // Nombre total d'inscriptions
      pool.query(`
        SELECT COUNT(*) as count
        FROM enrollments
      `),

      // Inscriptions complétées (completed_at NOT NULL)
      pool.query(`
        SELECT COUNT(*) as count
        FROM enrollments
        WHERE completed_at IS NOT NULL
      `),

      // Nombre total de vidéos visionnées
      pool.query(`
        SELECT COUNT(*) as count
        FROM video_progress
      `),

      // Vidéos terminées (completed_at NOT NULL)
      pool.query(`
        SELECT COUNT(*) as count
        FROM video_progress
        WHERE completed_at IS NOT NULL
      `),

      // Nombre total de tentatives de test
      pool.query(`
        SELECT COUNT(*) as count
        FROM test_attempts
      `),

      // Tests réussis (passed = true)
      pool.query(`
        SELECT COUNT(*) as count
        FROM test_attempts
        WHERE passed = true
      `),
    ]);

    // Calculer les taux
    const enrollmentCount = parseInt(totalEnrollments.rows[0].count);
    const completedCount = parseInt(completedEnrollments.rows[0].count);
    const completionRate = enrollmentCount > 0
      ? ((completedCount / enrollmentCount) * 100).toFixed(2)
      : 0;

    const videoCount = parseInt(totalVideoProgress.rows[0].count);
    const videoCompletedCount = parseInt(completedVideos.rows[0].count);
    const videoCompletionRate = videoCount > 0
      ? ((videoCompletedCount / videoCount) * 100).toFixed(2)
      : 0;

    const testCount = parseInt(totalTestAttempts.rows[0].count);
    const testPassedCount = parseInt(passedTests.rows[0].count);
    const testSuccessRate = testCount > 0
      ? ((testPassedCount / testCount) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      overview: {
        students: {
          total: parseInt(totalStudents.rows[0].count),
        },
        formations: {
          total: parseInt(totalFormations.rows[0].count),
        },
        sessions: {
          total: parseInt(totalSessions.rows[0].count),
          active: parseInt(activeSessions.rows[0].count),
        },
        enrollments: {
          total: enrollmentCount,
          completed: completedCount,
          completion_rate: parseFloat(completionRate),
        },
        videos: {
          total: videoCount,
          completed: videoCompletedCount,
          completion_rate: parseFloat(videoCompletionRate),
        },
        tests: {
          total: testCount,
          passed: testPassedCount,
          success_rate: parseFloat(testSuccessRate),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Formations les plus populaires (par nombre d'inscriptions)
 * GET /api/analytics/popular-formations
 * Protected: Admin/Staff only
 */
router.get('/popular-formations',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const result = await pool.query(`
      SELECT
        f.id,
        f.title,
        f.description,
        f.price,
        COUNT(e.id) as enrollment_count,
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completed_count,
        CASE
          WHEN COUNT(e.id) > 0 THEN
            ROUND((COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::numeric / COUNT(e.id)::numeric * 100), 2)
          ELSE 0
        END as completion_rate
      FROM formations f
      LEFT JOIN enrollments e ON e.formation_id = f.id
      GROUP BY f.id, f.title, f.description, f.price
      ORDER BY enrollment_count DESC, completed_count DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      formations: result.rows,
    });
  } catch (error) {
    console.error('Error fetching popular formations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Tendances d'inscriptions par mois (6 derniers mois)
 * GET /api/analytics/enrollment-trends
 * Protected: Admin/Staff only
 */
router.get('/enrollment-trends',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;

    const result = await pool.query(`
      SELECT
        TO_CHAR(enrolled_at, 'YYYY-MM') as month,
        COUNT(*) as enrollment_count,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_count
      FROM enrollments
      WHERE enrolled_at >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(enrolled_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    res.json({
      success: true,
      trends: result.rows,
    });
  } catch (error) {
    console.error('Error fetching enrollment trends:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Performance des tests par formation
 * GET /api/analytics/test-performance
 * Protected: Admin/Staff only
 */
router.get('/test-performance',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.id as formation_id,
        f.title as formation_title,
        t.id as test_id,
        t.title as test_title,
        COUNT(ta.id) as total_attempts,
        COUNT(CASE WHEN ta.passed = true THEN 1 END) as passed_attempts,
        CASE
          WHEN COUNT(ta.id) > 0 THEN
            ROUND((COUNT(CASE WHEN ta.passed = true THEN 1 END)::numeric / COUNT(ta.id)::numeric * 100), 2)
          ELSE 0
        END as success_rate,
        ROUND(AVG(ta.score)::numeric, 2) as avg_score,
        ROUND(AVG(ta.total_points)::numeric, 2) as avg_total_points
      FROM formations f
      INNER JOIN tests t ON t.formation_id = f.id
      LEFT JOIN test_attempts ta ON ta.test_id = t.id
      GROUP BY f.id, f.title, t.id, t.title
      ORDER BY f.title, t.title
    `);

    res.json({
      success: true,
      test_performance: result.rows,
    });
  } catch (error) {
    console.error('Error fetching test performance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Étudiants les plus actifs
 * GET /api/analytics/active-students
 * Protected: Admin/Staff only
 */
router.get('/active-students',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const result = await pool.query(`
      SELECT
        p.id,
        p.full_name,
        COUNT(DISTINCT e.id) as enrollments_count,
        COUNT(DISTINCT vp.id) as videos_watched,
        COUNT(DISTINCT CASE WHEN vp.completed_at IS NOT NULL THEN vp.id END) as videos_completed,
        COUNT(DISTINCT ta.id) as tests_taken,
        COUNT(DISTINCT CASE WHEN ta.passed = true THEN ta.id END) as tests_passed
      FROM profiles p
      LEFT JOIN enrollments e ON e.student_id = p.id
      LEFT JOIN video_progress vp ON vp.student_id = p.id
      LEFT JOIN test_attempts ta ON ta.student_id = p.id
      WHERE p.role = 'student'
      GROUP BY p.id, p.full_name
      HAVING COUNT(DISTINCT e.id) > 0
      ORDER BY enrollments_count DESC, videos_completed DESC, tests_passed DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      students: result.rows,
    });
  } catch (error) {
    console.error('Error fetching active students:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Progression détaillée d'un étudiant spécifique
 * GET /api/analytics/student-progress/:studentId
 * Protected: Students can view their own progress, users with training.analytics.view_page can view any student
 */
router.get('/student-progress/:studentId',
  authenticateToken,
  async (req, res) => {
  try {
    const { studentId } = req.params;

    // Security check: Users can view their own progress OR have the appropriate permission
    const isOwnProgress = req.user.id === studentId;

    if (!isOwnProgress) {
      // Check if user has permission to view other students' progress
      const userPermissions = await getUserPermissions(req.user.id);
      const hasPermission = userPermissions.includes('training.analytics.view_page') || userPermissions.includes('*');

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own progress or you need training.analytics.view_page permission.',
          code: 'ACCESS_DENIED',
        });
      }
    }

    // Informations de l'étudiant
    const studentInfo = await pool.query(`
      SELECT id, full_name, email, created_at
      FROM profiles
      WHERE id = $1 AND role = 'student'
    `, [studentId]);

    if (studentInfo.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Étudiant non trouvé',
      });
    }

    // Formations inscrites avec progression
    const enrollments = await pool.query(`
      SELECT
        f.id as formation_id,
        f.title as formation_title,
        e.enrolled_at,
        e.completed_at,
        e.status,
        (
          SELECT COUNT(*)
          FROM videos v
          WHERE v.formation_id = f.id
        ) as total_videos,
        (
          SELECT COUNT(*)
          FROM video_progress vp
          WHERE vp.formation_id = f.id
          AND vp.student_id = $1
          AND vp.completed_at IS NOT NULL
        ) as completed_videos,
        (
          SELECT COUNT(*)
          FROM tests t
          WHERE t.formation_id = f.id
        ) as total_tests,
        (
          SELECT COUNT(*)
          FROM test_attempts ta
          INNER JOIN tests t ON t.id = ta.test_id
          WHERE t.formation_id = f.id
          AND ta.student_id = $1
          AND ta.passed = true
        ) as passed_tests
      FROM enrollments e
      INNER JOIN formations f ON f.id = e.formation_id
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `, [studentId]);

    // Historique des tests avec scores
    const testHistory = await pool.query(`
      SELECT
        ta.id,
        ta.test_id,
        t.title as test_title,
        f.title as formation_title,
        ta.score,
        ta.total_points,
        ta.passed,
        ta.completed_at
      FROM test_attempts ta
      INNER JOIN tests t ON t.id = ta.test_id
      INNER JOIN formations f ON f.id = t.formation_id
      WHERE ta.student_id = $1
      ORDER BY ta.completed_at DESC
    `, [studentId]);

    res.json({
      success: true,
      student: studentInfo.rows[0],
      enrollments: enrollments.rows,
      test_history: testHistory.rows,
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Taux de complétion par formation (pour graphiques)
 * GET /api/analytics/formation-completion-rates
 * Protected: Admin/Staff only
 */
router.get('/formation-completion-rates',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.id,
        f.title,
        COUNT(e.id) as total_enrollments,
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completed_enrollments,
        CASE
          WHEN COUNT(e.id) > 0 THEN
            ROUND((COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::numeric / COUNT(e.id)::numeric * 100), 2)
          ELSE 0
        END as completion_rate
      FROM formations f
      LEFT JOIN enrollments e ON e.formation_id = f.id
      GROUP BY f.id, f.title
      HAVING COUNT(e.id) > 0
      ORDER BY completion_rate DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching formation completion rates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Statistiques par période (dashboard principal)
 * GET /api/analytics/period-stats
 * Protected: Admin/Staff only
 */
router.get('/period-stats',
  authenticateToken,
  requirePermission('training.analytics.view_page'),
  async (req, res) => {
  try {
    const period = req.query.period || '30'; // 7, 30, 90 jours
    const days = parseInt(period);

    const [
      newEnrollments,
      completedFormations,
      videoProgress,
      testAttempts,
    ] = await Promise.all([
      // Nouvelles inscriptions dans la période
      pool.query(`
        SELECT COUNT(*) as count
        FROM enrollments
        WHERE enrolled_at >= CURRENT_DATE - INTERVAL '${days} days'
      `),

      // Formations complétées dans la période
      pool.query(`
        SELECT COUNT(*) as count
        FROM enrollments
        WHERE completed_at >= CURRENT_DATE - INTERVAL '${days} days'
      `),

      // Vidéos complétées dans la période
      pool.query(`
        SELECT COUNT(*) as count
        FROM video_progress
        WHERE completed_at >= CURRENT_DATE - INTERVAL '${days} days'
      `),

      // Tests passés dans la période
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN passed = true THEN 1 END) as passed
        FROM test_attempts
        WHERE completed_at >= CURRENT_DATE - INTERVAL '${days} days'
      `),
    ]);

    res.json({
      success: true,
      period_days: days,
      stats: {
        new_enrollments: parseInt(newEnrollments.rows[0].count),
        completed_formations: parseInt(completedFormations.rows[0].count),
        videos_completed: parseInt(videoProgress.rows[0].count),
        tests_total: parseInt(testAttempts.rows[0].total),
        tests_passed: parseInt(testAttempts.rows[0].passed),
      },
    });
  } catch (error) {
    console.error('Error fetching period stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
