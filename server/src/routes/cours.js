import express from 'express';
import pool from '../config/database.js';
import { nanoid } from 'nanoid';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// FORMATIONS CRUD
// ============================================

// GET /api/cours - Liste formations filtrées par corps_id (query param)
// Permissions: view_page (admin), course.view (students), add_student (session staff)
router.get('/', requirePermission(
  'training.formations.view_page',
  'training.student.course.view',
  'training.sessions.add_student'
), async (req, res) => {
  try {
    const { corps_id } = req.query;

    let query = `
      SELECT
        f.*,
        COUNT(DISTINCT fm.id) as module_count
      FROM formations f
      LEFT JOIN formation_modules fm ON f.id = fm.formation_id
    `;

    const params = [];
    if (corps_id) {
      query += ` WHERE f.corps_formation_id = $1`;
      params.push(corps_id);
    }

    query += ` GROUP BY f.id ORDER BY f.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cours:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cours/formations - Liste toutes les formations
// Permissions: view_page (admin), course.view (students), add_student (session staff)
router.get('/formations', requirePermission(
  'training.formations.view_page',
  'training.student.course.view',
  'training.sessions.add_student'
), async (req, res) => {
  try {
    const query = `
      SELECT
        f.*,
        COUNT(DISTINCT fm.id) as module_count
      FROM formations f
      LEFT JOIN formation_modules fm ON f.id = fm.formation_id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching formations:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cours/formations/:id - Détail d'une formation
// Permissions: view_page (admin), course.view (students)
router.get('/formations/:id', requirePermission(
  'training.formations.view_page',
  'training.student.course.view'
), async (req, res) => {
  try {
    const { id } = req.params;

    const formationQuery = `
      SELECT * FROM formations WHERE id = $1
    `;
    const formationResult = await pool.query(formationQuery, [id]);

    if (formationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Formation non trouvée' });
    }

    const formation = formationResult.rows[0];

    // Récupérer les modules avec leurs contenus
    const modulesQuery = `
      SELECT
        fm.*,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', mv.id,
              'title', mv.title,
              'youtube_url', mv.youtube_url,
              'duration_seconds', mv.duration_seconds,
              'description', mv.description,
              'order_index', mv.order_index
            )
          ) FILTER (WHERE mv.id IS NOT NULL),
          '[]'
        ) as videos,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'id', mt.id,
              'title', mt.title,
              'description', mt.description,
              'passing_score', mt.passing_score,
              'time_limit_minutes', mt.time_limit_minutes,
              'max_attempts', mt.max_attempts,
              'show_correct_answers', mt.show_correct_answers
            )
          ) FILTER (WHERE mt.id IS NOT NULL),
          '[]'
        ) as tests
      FROM formation_modules fm
      LEFT JOIN module_videos mv ON fm.id = mv.module_id
      LEFT JOIN module_tests mt ON fm.id = mt.module_id
      WHERE fm.formation_id = $1
      GROUP BY fm.id
      ORDER BY fm.order_index
    `;
    const modulesResult = await pool.query(modulesQuery, [id]);

    formation.modules = modulesResult.rows;

    res.json(formation);
  } catch (error) {
    console.error('Error fetching formation:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cours/formations/:id/check-online-access - Vérifier l'accès en ligne pour un étudiant
// Permissions: course.view (students) - Already has authenticateToken, students can check their own access
router.get('/formations/:id/check-online-access', authenticateToken, requirePermission(
  'training.student.course.view',
  'training.formations.view_page'
), async (req, res) => {
  try {
    const { id: formation_id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        hasOnlineAccess: false,
        error: 'Non authentifié'
      });
    }

    // Find student record by profile username (CIN or username)
    const studentQuery = `
      SELECT s.id as student_id
      FROM students s
      LEFT JOIN profiles p ON s.cin = p.username
      WHERE p.id = $1 OR s.cin = $2
      LIMIT 1
    `;
    const studentResult = await pool.query(studentQuery, [user.id, user.username]);

    if (studentResult.rows.length === 0) {
      // User is not a student, might be admin/professor
      // Allow access (only students enrolled in présentielle sessions are restricted)
      return res.json({
        success: true,
        hasOnlineAccess: true,
        message: 'Accès autorisé'
      });
    }

    const student_id = studentResult.rows[0].student_id;

    // Check if student is enrolled in any en_ligne session for this formation
    const enrollmentQuery = `
      SELECT COUNT(*) as count
      FROM session_etudiants se
      JOIN sessions_formation sf ON se.session_id = sf.id
      WHERE se.student_id = $1
      AND se.formation_id = $2
      AND sf.session_type = 'en_ligne'
      AND se.student_status != 'abandonne'
    `;
    const enrollmentResult = await pool.query(enrollmentQuery, [student_id, formation_id]);

    const onlineEnrollmentCount = parseInt(enrollmentResult.rows[0]?.count || 0);
    const hasOnlineAccess = onlineEnrollmentCount > 0;

    res.json({
      success: true,
      hasOnlineAccess,
      message: hasOnlineAccess
        ? 'Accès en ligne autorisé'
        : 'Accès en ligne non autorisé. Cette formation est uniquement disponible en session présentielle.'
    });
  } catch (error) {
    console.error('Error checking online access:', error);
    res.status(500).json({
      success: false,
      hasOnlineAccess: false,
      error: error.message
    });
  }
});

// POST /api/cours/formations - Créer une formation
// Permissions: create (admin)
router.post('/formations', requirePermission('training.formations.create'), async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      duration_hours,
      level,
      thumbnail_url,
      status,
      passing_score_percentage,
      corps_formation_id,
      certificate_template_id,
      prime_assistante
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est obligatoire' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO formations (
        id, title, description, price, duration_hours, level,
        thumbnail_url, status, passing_score_percentage,
        corps_formation_id, certificate_template_id, prime_assistante,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      id, title, description, price, duration_hours, level,
      thumbnail_url, status || 'draft', passing_score_percentage || 80,
      corps_formation_id || null, certificate_template_id || null,
      prime_assistante || 0,
      now, now
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating formation:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/formations/:id - Modifier une formation
// Permissions: update (admin)
router.put('/formations/:id', requirePermission('training.formations.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      duration_hours,
      level,
      thumbnail_url,
      status,
      passing_score_percentage,
      corps_formation_id,
      certificate_template_id,
      prime_assistante
    } = req.body;

    const now = new Date().toISOString();

    const query = `
      UPDATE formations
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        duration_hours = COALESCE($4, duration_hours),
        level = COALESCE($5, level),
        thumbnail_url = COALESCE($6, thumbnail_url),
        status = COALESCE($7, status),
        passing_score_percentage = COALESCE($8, passing_score_percentage),
        corps_formation_id = COALESCE($9, corps_formation_id),
        certificate_template_id = COALESCE($10, certificate_template_id),
        prime_assistante = COALESCE($11, prime_assistante),
        updated_at = $12
      WHERE id = $13
      RETURNING *
    `;

    const values = [
      title, description, price, duration_hours, level,
      thumbnail_url, status, passing_score_percentage,
      corps_formation_id, certificate_template_id, prime_assistante,
      now, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Formation non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating formation:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/formations/:id - Supprimer une formation
// Permissions: delete (admin)
router.delete('/formations/:id', requirePermission('training.formations.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM formations WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Formation non trouvée' });
    }

    res.json({ message: 'Formation supprimée avec succès', formation: result.rows[0] });
  } catch (error) {
    console.error('Error deleting formation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MODULES CRUD
// ============================================

// GET /api/cours/formations/:formationId/modules - Liste modules d'une formation
// Permissions: view_page (admin), course.view (students)
router.get('/formations/:formationId/modules', requirePermission(
  'training.formations.view_page',
  'training.student.course.view'
), async (req, res) => {
  try {
    const { formationId } = req.params;

    const query = `
      SELECT * FROM formation_modules
      WHERE formation_id = $1
      ORDER BY order_index
    `;

    const result = await pool.query(query, [formationId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cours/formations/:formationId/modules - Ajouter un module
// Permissions: edit_content (admin)
router.post('/formations/:formationId/modules', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { formationId } = req.params;
    const {
      title,
      description,
      order_index,
      prerequisite_module_id,
      module_type
    } = req.body;

    if (!title || !module_type) {
      return res.status(400).json({ error: 'Titre et type de module obligatoires' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO formation_modules (
        id, formation_id, title, description, order_index,
        prerequisite_module_id, module_type, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id, formationId, title, description, order_index || 0,
      prerequisite_module_id || null, module_type, now
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/modules/:id - Modifier un module
// Permissions: edit_content (admin)
router.put('/modules/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      order_index,
      prerequisite_module_id,
      module_type
    } = req.body;

    const query = `
      UPDATE formation_modules
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        order_index = COALESCE($3, order_index),
        prerequisite_module_id = $4,
        module_type = COALESCE($5, module_type)
      WHERE id = $6
      RETURNING *
    `;

    const values = [title, description, order_index, prerequisite_module_id, module_type, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Module non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/modules/:id - Supprimer un module
// Permissions: edit_content (admin)
router.delete('/modules/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM formation_modules WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Module non trouvé' });
    }

    res.json({ message: 'Module supprimé avec succès', module: result.rows[0] });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/modules/:id/reorder - Réorganiser l'ordre d'un module
// Permissions: edit_content (admin)
router.put('/modules/:id/reorder', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_order_index } = req.body;

    if (new_order_index === undefined) {
      return res.status(400).json({ error: 'new_order_index requis' });
    }

    const query = `
      UPDATE formation_modules
      SET order_index = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [new_order_index, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Module non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error reordering module:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VIDÉOS CRUD
// ============================================

// POST /api/cours/modules/:moduleId/videos - Ajouter une vidéo
// Permissions: edit_content (admin)
router.post('/modules/:moduleId/videos', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      title,
      youtube_url,
      duration_seconds,
      description,
      order_index
    } = req.body;

    if (!title || !youtube_url) {
      return res.status(400).json({ error: 'Titre et URL YouTube obligatoires' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO module_videos (
        id, module_id, title, youtube_url, duration_seconds,
        description, order_index, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id, moduleId, title, youtube_url, duration_seconds,
      description, order_index || 0, now
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/videos/:id - Modifier une vidéo
// Permissions: edit_content (admin)
router.put('/videos/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      youtube_url,
      duration_seconds,
      description,
      order_index
    } = req.body;

    const query = `
      UPDATE module_videos
      SET
        title = COALESCE($1, title),
        youtube_url = COALESCE($2, youtube_url),
        duration_seconds = COALESCE($3, duration_seconds),
        description = COALESCE($4, description),
        order_index = COALESCE($5, order_index)
      WHERE id = $6
      RETURNING *
    `;

    const values = [title, youtube_url, duration_seconds, description, order_index, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/videos/:id - Supprimer une vidéo
// Permissions: edit_content (admin)
router.delete('/videos/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM module_videos WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }

    res.json({ message: 'Vidéo supprimée avec succès', video: result.rows[0] });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TESTS CRUD
// ============================================

// POST /api/cours/modules/:moduleId/tests - Créer un test
// Permissions: edit_content (admin)
router.post('/modules/:moduleId/tests', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      title,
      description,
      passing_score,
      time_limit_minutes,
      max_attempts,
      show_correct_answers
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Titre obligatoire' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO module_tests (
        id, module_id, title, description, passing_score,
        time_limit_minutes, max_attempts, show_correct_answers, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id, moduleId, title, description, passing_score || 80,
      time_limit_minutes, max_attempts, show_correct_answers !== false, now
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cours/tests/:id - Détail d'un test avec questions
// Permissions: view_page (admin), course.view + tests.take (students)
router.get('/tests/:id', requirePermission(
  'training.formations.view_page',
  'training.student.course.tests.take',
  'training.formations.edit_content'
), async (req, res) => {
  try {
    const { id } = req.params;

    const testQuery = 'SELECT * FROM module_tests WHERE id = $1';
    const testResult = await pool.query(testQuery, [id]);

    if (testResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test non trouvé' });
    }

    const test = testResult.rows[0];

    // Récupérer les questions avec leurs choix
    const questionsQuery = `
      SELECT
        tq.*,
        COALESCE(
          JSON_AGG(
            jsonb_build_object(
              'id', qc.id,
              'choice_text', qc.choice_text,
              'is_correct', qc.is_correct,
              'order_index', qc.order_index
            ) ORDER BY qc.order_index
          ) FILTER (WHERE qc.id IS NOT NULL),
          '[]'
        ) as choices
      FROM test_questions tq
      LEFT JOIN question_choices qc ON tq.id = qc.question_id
      WHERE tq.test_id = $1
      GROUP BY tq.id
      ORDER BY tq.order_index
    `;

    const questionsResult = await pool.query(questionsQuery, [id]);
    test.questions = questionsResult.rows;

    res.json(test);
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/tests/:id - Modifier un test
// Permissions: edit_content (admin)
router.put('/tests/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      passing_score,
      time_limit_minutes,
      max_attempts,
      show_correct_answers
    } = req.body;

    const query = `
      UPDATE module_tests
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        passing_score = COALESCE($3, passing_score),
        time_limit_minutes = $4,
        max_attempts = $5,
        show_correct_answers = COALESCE($6, show_correct_answers)
      WHERE id = $7
      RETURNING *
    `;

    const values = [
      title, description, passing_score, time_limit_minutes,
      max_attempts, show_correct_answers, id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/tests/:id - Supprimer un test
// Permissions: edit_content (admin)
router.delete('/tests/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM module_tests WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test non trouvé' });
    }

    res.json({ message: 'Test supprimé avec succès', test: result.rows[0] });
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// QUESTIONS CRUD
// ============================================

// POST /api/cours/tests/:testId/questions - Ajouter une question
// Permissions: edit_content (admin)
router.post('/tests/:testId/questions', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { testId } = req.params;
    const {
      question_text,
      question_type,
      points,
      order_index
    } = req.body;

    if (!question_text) {
      return res.status(400).json({ error: 'Texte de la question obligatoire' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO test_questions (
        id, test_id, question_text, question_type, points, order_index, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id, testId, question_text, question_type || 'multiple_choice',
      points || 1, order_index || 0, now
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/questions/:id - Modifier une question
// Permissions: edit_content (admin)
router.put('/questions/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question_text,
      question_type,
      points,
      order_index
    } = req.body;

    const query = `
      UPDATE test_questions
      SET
        question_text = COALESCE($1, question_text),
        question_type = COALESCE($2, question_type),
        points = COALESCE($3, points),
        order_index = COALESCE($4, order_index)
      WHERE id = $5
      RETURNING *
    `;

    const values = [question_text, question_type, points, order_index, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/questions/:id - Supprimer une question
// Permissions: edit_content (admin)
router.delete('/questions/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM test_questions WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    res.json({ message: 'Question supprimée avec succès', question: result.rows[0] });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CHOIX DE RÉPONSE CRUD
// ============================================

// POST /api/cours/questions/:questionId/choices - Ajouter un choix
// Permissions: edit_content (admin)
router.post('/questions/:questionId/choices', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { questionId } = req.params;
    const {
      choice_text,
      is_correct,
      order_index
    } = req.body;

    if (!choice_text) {
      return res.status(400).json({ error: 'Texte du choix obligatoire' });
    }

    const id = nanoid();

    const query = `
      INSERT INTO question_choices (
        id, question_id, choice_text, is_correct, order_index
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      id, questionId, choice_text, is_correct || false, order_index || 0
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating choice:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/choices/:id - Modifier un choix
// Permissions: edit_content (admin)
router.put('/choices/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      choice_text,
      is_correct,
      order_index
    } = req.body;

    const query = `
      UPDATE question_choices
      SET
        choice_text = COALESCE($1, choice_text),
        is_correct = COALESCE($2, is_correct),
        order_index = COALESCE($3, order_index)
      WHERE id = $4
      RETURNING *
    `;

    const values = [choice_text, is_correct, order_index, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Choix non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating choice:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cours/choices/:id - Supprimer un choix
// Permissions: edit_content (admin)
router.delete('/choices/:id', requirePermission('training.formations.edit_content'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM question_choices WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Choix non trouvé' });
    }

    res.json({ message: 'Choix supprimé avec succès', choice: result.rows[0] });
  } catch (error) {
    console.error('Error deleting choice:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATISTIQUES
// ============================================

// GET /api/cours/stats - Statistiques globales
// Permissions: view_page (admin)
router.get('/stats', requirePermission('training.formations.view_page'), async (req, res) => {
  try {
    const stats = {};

    // Nombre de formations par statut
    const formationsQuery = `
      SELECT status, COUNT(*) as count
      FROM formations
      GROUP BY status
    `;
    const formationsResult = await pool.query(formationsQuery);

    stats.formations = {
      total: 0,
      draft: 0,
      published: 0
    };

    formationsResult.rows.forEach(row => {
      stats.formations[row.status] = parseInt(row.count);
      stats.formations.total += parseInt(row.count);
    });

    // Nombre total de modules
    const modulesQuery = 'SELECT COUNT(*) as count FROM formation_modules';
    const modulesResult = await pool.query(modulesQuery);
    stats.total_modules = parseInt(modulesResult.rows[0].count);

    // Nombre total de vidéos
    const videosQuery = 'SELECT COUNT(*) as count FROM module_videos';
    const videosResult = await pool.query(videosQuery);
    stats.total_videos = parseInt(videosResult.rows[0].count);

    // Nombre total de tests
    const testsQuery = 'SELECT COUNT(*) as count FROM module_tests';
    const testsResult = await pool.query(testsQuery);
    stats.total_tests = parseInt(testsResult.rows[0].count);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching cours stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PACKS DE FORMATIONS
// ============================================

// POST /api/cours/packs - Créer un pack de formations
// Permissions: create_pack (admin)
router.post('/packs', requirePermission('training.formations.create_pack'), async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,
      corps_formation_id,
      price,
      certificate_template_id,
      formation_ids,
      level,
      thumbnail_url
    } = req.body;

    // Validation
    if (!title || !corps_formation_id || !price || !formation_ids || formation_ids.length === 0) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants',
        required: ['title', 'corps_formation_id', 'price', 'formation_ids']
      });
    }

    // Vérifier que toutes les formations appartiennent au même corps
    const formationsCheck = await client.query(
      `SELECT id, corps_formation_id, title
       FROM formations
       WHERE id = ANY($1::text[])
       AND is_pack = FALSE`,
      [formation_ids]
    );

    if (formationsCheck.rows.length !== formation_ids.length) {
      return res.status(400).json({
        error: 'Certaines formations sont invalides ou sont déjà des packs'
      });
    }

    const invalidFormations = formationsCheck.rows.filter(
      f => f.corps_formation_id !== corps_formation_id
    );

    if (invalidFormations.length > 0) {
      return res.status(400).json({
        error: 'Toutes les formations doivent appartenir au même corps de formation',
        invalid_formations: invalidFormations.map(f => f.title)
      });
    }

    await client.query('BEGIN');

    // Calculer la durée totale
    const durationQuery = await client.query(
      'SELECT COALESCE(SUM(duration_hours), 0) as total_duration FROM formations WHERE id = ANY($1::text[])',
      [formation_ids]
    );
    const totalDuration = parseInt(durationQuery.rows[0].total_duration);

    // Créer le pack
    const packId = nanoid();
    const insertPackQuery = `
      INSERT INTO formations (
        id, title, description, corps_formation_id, price, duration_hours,
        level, thumbnail_url, is_pack, certificate_template_id,
        status, passing_score_percentage, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, 'published', 80, NOW(), NOW())
      RETURNING *
    `;

    const packResult = await client.query(insertPackQuery, [
      packId,
      title,
      description || null,
      corps_formation_id,
      price,
      totalDuration,
      level || 'intermediaire',
      thumbnail_url || null,
      certificate_template_id || null
    ]);

    // Ajouter les formations au pack
    for (let i = 0; i < formation_ids.length; i++) {
      const itemId = nanoid();
      await client.query(
        `INSERT INTO formation_pack_items (id, pack_id, formation_id, order_index)
         VALUES ($1, $2, $3, $4)`,
        [itemId, packId, formation_ids[i], i]
      );
    }

    // Auto-assigner les templates des formations membres (sans doublons)
    // Récupérer tous les templates des formations du pack
    const memberTemplatesResult = await client.query(
      `SELECT DISTINCT ft.template_id, ft.document_type, ct.name as template_name
       FROM formation_templates ft
       INNER JOIN certificate_templates ct ON ct.id = ft.template_id
       WHERE ft.formation_id = ANY($1::text[])
       ORDER BY ct.name`,
      [formation_ids]
    );

    console.log(`📋 Found ${memberTemplatesResult.rows.length} unique templates from pack members`);

    // Assigner chaque template unique au pack
    let firstTemplate = true;
    for (const tmpl of memberTemplatesResult.rows) {
      const ftId = nanoid();
      await client.query(
        `INSERT INTO formation_templates (id, formation_id, template_id, document_type, is_default)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (formation_id, template_id, document_type) DO NOTHING`,
        [ftId, packId, tmpl.template_id, tmpl.document_type, firstTemplate]
      );
      console.log(`  ✓ Assigned template "${tmpl.template_name}" (${tmpl.document_type}) to pack`);
      firstTemplate = false;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      pack: packResult.rows[0],
      formations_count: formation_ids.length,
      templates_inherited: memberTemplatesResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating pack:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET /api/cours/packs/:id - Détail d'un pack avec ses formations
// Permissions: view_page (admin), course.view (students)
router.get('/packs/:id', requirePermission(
  'training.formations.view_page',
  'training.student.course.view'
), async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le pack
    const packQuery = `
      SELECT f.*, cf.name as corps_formation_name
      FROM formations f
      LEFT JOIN corps_formation cf ON f.corps_formation_id = cf.id
      WHERE f.id = $1 AND f.is_pack = TRUE
    `;
    const packResult = await pool.query(packQuery, [id]);

    if (packResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pack non trouvé' });
    }

    const pack = packResult.rows[0];

    // Récupérer les formations incluses
    const formationsQuery = `
      SELECT
        f.id, f.title, f.description, f.price, f.duration_hours,
        f.level, f.thumbnail_url, fpi.order_index
      FROM formation_pack_items fpi
      JOIN formations f ON f.id = fpi.formation_id
      WHERE fpi.pack_id = $1
      ORDER BY fpi.order_index
    `;
    const formationsResult = await pool.query(formationsQuery, [id]);

    pack.formations = formationsResult.rows;

    res.json({
      success: true,
      pack
    });

  } catch (error) {
    console.error('Error fetching pack:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/cours/packs/:id - Modifier un pack
// Permissions: create_pack (admin)
router.put('/packs/:id', requirePermission('training.formations.create_pack'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      certificate_template_id,
      formation_ids,
      level,
      thumbnail_url
    } = req.body;

    // Vérifier que le pack existe
    const packCheck = await client.query(
      'SELECT * FROM formations WHERE id = $1 AND is_pack = TRUE',
      [id]
    );

    if (packCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pack non trouvé' });
    }

    const pack = packCheck.rows[0];

    await client.query('BEGIN');

    // Mettre à jour le pack
    let totalDuration = pack.duration_hours;

    if (formation_ids && formation_ids.length > 0) {
      // Recalculer la durée
      const durationQuery = await client.query(
        'SELECT COALESCE(SUM(duration_hours), 0) as total_duration FROM formations WHERE id = ANY($1::text[])',
        [formation_ids]
      );
      totalDuration = parseInt(durationQuery.rows[0].total_duration);

      // Supprimer les anciennes associations
      await client.query('DELETE FROM formation_pack_items WHERE pack_id = $1', [id]);

      // Ajouter les nouvelles associations
      for (let i = 0; i < formation_ids.length; i++) {
        const itemId = nanoid();
        await client.query(
          `INSERT INTO formation_pack_items (id, pack_id, formation_id, order_index)
           VALUES ($1, $2, $3, $4)`,
          [itemId, id, formation_ids[i], i]
        );
      }
    }

    const updateQuery = `
      UPDATE formations
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        duration_hours = $4,
        level = COALESCE($5, level),
        thumbnail_url = COALESCE($6, thumbnail_url),
        certificate_template_id = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      title,
      description,
      price,
      totalDuration,
      level,
      thumbnail_url,
      certificate_template_id,
      id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      pack: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating pack:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /api/cours/packs/:id - Supprimer un pack
// Permissions: delete (admin)
router.delete('/packs/:id', requirePermission('training.formations.delete'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    // Vérifier que le pack existe
    const packCheck = await client.query(
      'SELECT * FROM formations WHERE id = $1 AND is_pack = TRUE',
      [id]
    );

    if (packCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pack non trouvé' });
    }

    await client.query('BEGIN');

    // Supprimer les associations (CASCADE devrait le faire automatiquement)
    await client.query('DELETE FROM formation_pack_items WHERE pack_id = $1', [id]);

    // Supprimer le pack
    await client.query('DELETE FROM formations WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Pack supprimé avec succès'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting pack:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============================================
// DUPLICATION ENDPOINT
// ============================================

/**
 * POST /api/cours/formations/:id/duplicate
 * Dupliquer une formation (avec option d'inclure les modules)
 * Permissions: duplicate (admin)
 */
router.post('/formations/:id/duplicate', requirePermission('training.formations.duplicate'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { include_modules = false } = req.body;

    await client.query('BEGIN');

    // Récupérer la formation originale
    const formationResult = await client.query(
      'SELECT * FROM formations WHERE id = $1 AND is_pack = FALSE',
      [id]
    );

    if (formationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Formation non trouvée ou c\'est un pack (les packs ne peuvent pas être dupliqués directement)'
      });
    }

    const originalFormation = formationResult.rows[0];

    // Créer la nouvelle formation avec (Copie)
    const newFormationId = nanoid();
    const newFormationTitle = `${originalFormation.title} (Copie)`;
    const now = new Date().toISOString();

    const insertFormationQuery = `
      INSERT INTO formations (
        id, title, description, price, duration_hours, level,
        thumbnail_url, status, passing_score_percentage,
        corps_formation_id, certificate_template_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const newFormationResult = await client.query(insertFormationQuery, [
      newFormationId,
      newFormationTitle,
      originalFormation.description,
      originalFormation.price,
      originalFormation.duration_hours,
      originalFormation.level,
      originalFormation.thumbnail_url,
      'draft', // Toujours en brouillon pour la copie
      originalFormation.passing_score_percentage,
      originalFormation.corps_formation_id,
      originalFormation.certificate_template_id,
      now,
      now
    ]);

    const newFormation = newFormationResult.rows[0];
    let duplicatedModulesCount = 0;

    // Dupliquer les modules si demandé
    if (include_modules) {
      // Récupérer les modules de la formation originale
      const modulesResult = await client.query(
        `SELECT * FROM formation_modules
         WHERE formation_id = $1
         ORDER BY order_index ASC`,
        [id]
      );

      // Map pour stocker les correspondances ancien ID -> nouveau ID
      const moduleIdMap = new Map();

      // Première passe: dupliquer les modules
      for (const module of modulesResult.rows) {
        const newModuleId = nanoid();
        moduleIdMap.set(module.id, newModuleId);

        const insertModuleQuery = `
          INSERT INTO formation_modules (
            id, formation_id, title, description, order_index,
            prerequisite_module_id, module_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        // Pour l'instant, prerequisite_module_id sera null, on le mettra à jour après
        await client.query(insertModuleQuery, [
          newModuleId,
          newFormationId,
          module.title,
          module.description,
          module.order_index,
          null, // Sera mis à jour dans la deuxième passe
          module.module_type,
          now
        ]);

        // Dupliquer les vidéos du module
        const videosResult = await client.query(
          'SELECT * FROM module_videos WHERE module_id = $1 ORDER BY order_index ASC',
          [module.id]
        );

        for (const video of videosResult.rows) {
          const newVideoId = nanoid();
          await client.query(
            `INSERT INTO module_videos (
              id, module_id, title, youtube_url, duration_seconds,
              description, order_index, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              newVideoId,
              newModuleId,
              video.title,
              video.youtube_url,
              video.duration_seconds,
              video.description,
              video.order_index,
              now
            ]
          );
        }

        // Dupliquer les tests du module (sans dupliquer les questions pour l'instant)
        const testsResult = await client.query(
          'SELECT * FROM module_tests WHERE module_id = $1',
          [module.id]
        );

        for (const test of testsResult.rows) {
          const newTestId = nanoid();
          await client.query(
            `INSERT INTO module_tests (
              id, module_id, title, description, passing_score,
              time_limit_minutes, max_attempts, show_correct_answers, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              newTestId,
              newModuleId,
              test.title,
              test.description,
              test.passing_score,
              test.time_limit_minutes,
              test.max_attempts,
              test.show_correct_answers,
              now
            ]
          );
        }

        duplicatedModulesCount++;
      }

      // Deuxième passe: mettre à jour les prerequisite_module_id
      for (const module of modulesResult.rows) {
        if (module.prerequisite_module_id && moduleIdMap.has(module.prerequisite_module_id)) {
          const newModuleId = moduleIdMap.get(module.id);
          const newPrerequisiteId = moduleIdMap.get(module.prerequisite_module_id);

          await client.query(
            'UPDATE formation_modules SET prerequisite_module_id = $1 WHERE id = $2',
            [newPrerequisiteId, newModuleId]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      formation: newFormation,
      duplicated_modules_count: duplicatedModulesCount,
      message: `Formation dupliquée avec succès${include_modules ? ` (${duplicatedModulesCount} module(s) copié(s))` : ''}`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur duplication formation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
