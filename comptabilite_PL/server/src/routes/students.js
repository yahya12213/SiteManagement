import express from 'express';
import pool from '../config/database.js';
import { nanoid } from 'nanoid';
import { uploadProfileImage } from '../middleware/upload.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../middleware/requireScope.js';
import { toTitleCase, formatCIN, formatEmail, formatPhone, formatAddress } from '../utils/textStandardizer.js';

const router = express.Router();

/**
 * Check if student with CIN already exists
 * GET /api/students/check-cin/:cin
 * Protected: Requires authentication and students view permission
 */
router.get('/check-cin/:cin',
  authenticateToken,
  requirePermission('training.students.view_page'),
  async (req, res) => {
  const { cin } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, cin, email, phone, whatsapp,
              date_naissance, lieu_naissance, adresse, statut_compte, profile_image_url
       FROM students
       WHERE cin = $1`,
      [cin]
    );

    if (result.rows.length > 0) {
      res.json({
        exists: true,
        student: result.rows[0],
      });
    } else {
      res.json({
        exists: false,
      });
    }
  } catch (error) {
    console.error('Error checking CIN:', error);
    res.status(500).json({ error: 'Error checking CIN', details: error.message });
  }
});

/**
 * Create a new student
 * POST /api/students
 * Accepts multipart/form-data with optional profile_image file
 * Protected: Requires authentication and students create permission
 */
router.post('/',
  authenticateToken,
  requirePermission('training.students.create'),
  uploadProfileImage,
  async (req, res) => {
  // Extract and standardize input data
  const {
    nom: rawNom,
    prenom: rawPrenom,
    cin: rawCin,
    email: rawEmail,
    phone: rawPhone,
    whatsapp: rawWhatsapp,
    date_naissance,
    lieu_naissance: rawLieuNaissance,
    adresse: rawAdresse,
    statut_compte,
  } = req.body;

  // Apply standardization rules
  const nom = toTitleCase(rawNom);                    // "DUPONT" -> "Dupont"
  const prenom = toTitleCase(rawPrenom);              // "JEAN" -> "Jean"
  const cin = formatCIN(rawCin);                      // "t 209876" -> "T209876"
  const email = formatEmail(rawEmail);                // "JOHN@GMAIL.COM" -> "john@gmail.com"
  const phone = formatPhone(rawPhone);                // "06 12 34 56 78" -> "0612345678"
  const whatsapp = formatPhone(rawWhatsapp);          // Same for whatsapp
  const lieu_naissance = toTitleCase(rawLieuNaissance); // "CASABLANCA" -> "Casablanca"
  const adresse = formatAddress(rawAdresse);          // Title case for address

  try {
    // Check if CIN already exists (use standardized CIN)
    const existingStudent = await pool.query('SELECT id FROM students WHERE cin = $1', [cin]);

    if (existingStudent.rows.length > 0) {
      return res.status(400).json({ error: 'Un étudiant avec ce CIN existe déjà' });
    }

    // Handle profile image upload
    let profile_image_url = null;
    if (req.file) {
      // Generate URL relative to server uploads directory
      profile_image_url = `/uploads/profiles/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO students (
        nom, prenom, cin, email, phone, whatsapp,
        date_naissance, lieu_naissance, adresse, statut_compte, profile_image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        nom,
        prenom,
        cin,
        email || null,
        phone,
        whatsapp || null,
        date_naissance,
        lieu_naissance,
        adresse,
        statut_compte || 'actif',
        profile_image_url,
      ]
    );

    res.status(201).json({
      success: true,
      student: result.rows[0],
      message: 'Étudiant créé avec succès',
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'étudiant', details: error.message });
  }
});

/**
 * Get all students with their session information
 * GET /api/students/with-sessions
 * Protected: Requires authentication and students view permission
 * SCOPE: Filtre les étudiants par les sessions dans les villes/segments de l'utilisateur
 */
router.get('/with-sessions',
  authenticateToken,
  requirePermission('training.students.view_page'),
  injectUserScope,
  async (req, res) => {
  try {
    // Build SBAC scope filter for session's segment and city
    const scopeFilter = buildScopeFilter(req, 'sf.segment_id', 'sf.ville_id');

    let whereClause = '';
    let params = [];

    if (scopeFilter.hasScope) {
      // User has scope restrictions - only show students in sessions within their scope
      whereClause = `WHERE (${scopeFilter.conditions.join(' OR ')})`;
      params = scopeFilter.params;
    }
    // If no scope (admin), show all students

    const result = await pool.query(`
      SELECT
        s.id,
        s.nom,
        s.prenom,
        s.cin,
        s.phone,
        s.email,
        s.statut_compte,
        s.profile_image_url,
        s.created_at,
        se.id as enrollment_id,
        se.session_id,
        se.statut_paiement,
        se.montant_total,
        se.montant_paye,
        se.montant_du,
        sf.titre as session_titre,
        sf.session_type,
        sf.statut as session_statut,
        c.name as ville,
        cf.name as formation_titre,
        CASE WHEN se.id IS NOT NULL THEN true ELSE false END as has_session
      FROM students s
      LEFT JOIN session_etudiants se ON s.id = se.student_id
      LEFT JOIN sessions_formation sf ON se.session_id = sf.id
      LEFT JOIN cities c ON sf.ville_id = c.id
      LEFT JOIN corps_formation cf ON sf.corps_formation_id = cf.id
      ${whereClause}
      ORDER BY
        CASE WHEN se.id IS NULL THEN 0 ELSE 1 END,
        s.nom,
        s.prenom
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students with sessions:', error);
    res.status(500).json({ error: 'Error fetching students with sessions', details: error.message });
  }
});

/**
 * Get all students
 * GET /api/students
 * Protected: Requires authentication and students view permission
 */
router.get('/',
  authenticateToken,
  requirePermission('training.students.view_page'),
  async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, cin, email, phone, whatsapp,
              date_naissance, lieu_naissance, adresse, statut_compte, profile_image_url,
              created_at, updated_at
       FROM students
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Error fetching students', details: error.message });
  }
});

/**
 * Get current student's data (for external apps like Diray Centre)
 * GET /api/students/me/profile
 * Protected: Requires authentication (student role)
 * Returns: Student profile with enrolled formations and schedule
 */
router.get('/me/profile',
  authenticateToken,
  async (req, res) => {
    try {
      // Get student_id from JWT token (set during external-login)
      const studentId = req.user.student_id;

      if (!studentId) {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is only available for student accounts'
        });
      }

      // Get student profile
      const studentResult = await pool.query(
        `SELECT id, nom, prenom, cin, email, phone, whatsapp,
                date_naissance, lieu_naissance, adresse, statut_compte, profile_image_url,
                created_at
         FROM students
         WHERE id = $1`,
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Student not found'
        });
      }

      const student = studentResult.rows[0];

      // Get enrolled formations with session details
      const formationsResult = await pool.query(
        `SELECT
          f.id as formation_id,
          f.nom as formation_name,
          f.code as formation_code,
          f.description as formation_description,
          f.duree_heures,
          sf.id as session_id,
          sf.titre as session_name,
          sf.date_debut,
          sf.date_fin,
          sf.session_type,
          sf.statut as session_status,
          c.name as ville,
          se.statut_paiement,
          se.montant_total,
          se.montant_paye,
          se.montant_du,
          se.student_status
         FROM session_etudiants se
         JOIN sessions_formation sf ON se.session_id = sf.id
         JOIN formations f ON sf.formation_id = f.id
         LEFT JOIN cities c ON sf.ville_id = c.id
         WHERE se.student_id = $1
         AND se.student_status != 'abandonne'
         ORDER BY sf.date_debut DESC`,
        [studentId]
      );

      // Get upcoming schedule (next 30 days)
      const scheduleResult = await pool.query(
        `SELECT
          sch.id,
          sch.date_seance,
          sch.heure_debut,
          sch.heure_fin,
          sch.type_seance,
          sch.salle,
          sch.formateur,
          sf.titre as session_name,
          f.nom as formation_name
         FROM session_schedules sch
         JOIN sessions_formation sf ON sch.session_id = sf.id
         JOIN formations f ON sf.formation_id = f.id
         JOIN session_etudiants se ON se.session_id = sf.id
         WHERE se.student_id = $1
         AND se.student_status != 'abandonne'
         AND sch.date_seance >= CURRENT_DATE
         AND sch.date_seance <= CURRENT_DATE + INTERVAL '30 days'
         ORDER BY sch.date_seance, sch.heure_debut`,
        [studentId]
      );

      res.json({
        success: true,
        student: {
          id: student.id,
          full_name: `${student.prenom} ${student.nom}`,
          first_name: student.prenom,
          last_name: student.nom,
          cin: student.cin,
          email: student.email,
          phone: student.phone,
          whatsapp: student.whatsapp,
          birth_date: student.date_naissance,
          birth_place: student.lieu_naissance,
          address: student.adresse,
          account_status: student.statut_compte,
          profile_image: student.profile_image_url,
          created_at: student.created_at
        },
        formations: formationsResult.rows,
        schedule: scheduleResult.rows
      });

    } catch (error) {
      console.error('Error fetching student profile:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching student profile'
      });
    }
  }
);

/**
 * Get student by ID
 * GET /api/students/:id
 * Protected: Requires authentication and students view permission
 */
router.get('/:id',
  authenticateToken,
  requirePermission('training.students.view_page'),
  async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, cin, email, phone, whatsapp,
              date_naissance, lieu_naissance, adresse, statut_compte, profile_image_url,
              created_at, updated_at
       FROM students
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Error fetching student', details: error.message });
  }
});

/**
 * Update student by ID
 * PUT /api/students/:id
 * Accepts multipart/form-data with optional profile_image file
 * Protected: Requires authentication and students update permission
 */
router.put('/:id',
  authenticateToken,
  requirePermission('training.students.update'),
  uploadProfileImage,
  async (req, res) => {
  const { id } = req.params;
  // Extract raw input data
  const {
    nom: rawNom,
    prenom: rawPrenom,
    cin: rawCin,
    email: rawEmail,
    phone: rawPhone,
    whatsapp: rawWhatsapp,
    date_naissance,
    lieu_naissance: rawLieuNaissance,
    adresse: rawAdresse,
    statut_compte,
  } = req.body;

  // Apply standardization rules (only if values are provided)
  const nom = rawNom ? toTitleCase(rawNom) : null;
  const prenom = rawPrenom ? toTitleCase(rawPrenom) : null;
  const cin = rawCin ? formatCIN(rawCin) : null;
  const email = rawEmail ? formatEmail(rawEmail) : null;
  const phone = rawPhone ? formatPhone(rawPhone) : null;
  const whatsapp = rawWhatsapp ? formatPhone(rawWhatsapp) : null;
  const lieu_naissance = rawLieuNaissance ? toTitleCase(rawLieuNaissance) : null;
  const adresse = rawAdresse ? formatAddress(rawAdresse) : null;

  try {
    // Check if student exists
    const existingStudent = await pool.query('SELECT id, profile_image_url FROM students WHERE id = $1', [id]);

    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }

    // Handle profile image upload
    let profile_image_url = existingStudent.rows[0].profile_image_url;
    if (req.file) {
      // Generate URL relative to server uploads directory
      profile_image_url = `/uploads/profiles/${req.file.filename}`;

      // TODO: Delete old profile image if exists
    }

    const result = await pool.query(
      `UPDATE students SET
        nom = COALESCE($1, nom),
        prenom = COALESCE($2, prenom),
        cin = COALESCE($3, cin),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        whatsapp = COALESCE($6, whatsapp),
        date_naissance = COALESCE($7, date_naissance),
        lieu_naissance = COALESCE($8, lieu_naissance),
        adresse = COALESCE($9, adresse),
        statut_compte = COALESCE($10, statut_compte),
        profile_image_url = COALESCE($11, profile_image_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *`,
      [
        nom,
        prenom,
        cin,
        email,
        phone,
        whatsapp,
        date_naissance || null,
        lieu_naissance,
        adresse,
        statut_compte || null,
        req.file ? profile_image_url : null,
        id,
      ]
    );

    res.json({
      success: true,
      student: result.rows[0],
      message: 'Étudiant mis à jour avec succès',
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'étudiant', details: error.message });
  }
});

export default router;
