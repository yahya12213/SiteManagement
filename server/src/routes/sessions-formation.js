import express from 'express';
import pool from '../config/database.js';
import { nanoid } from 'nanoid';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter, requireRecordScope } from '../middleware/requireScope.js';
import * as archiveManager from '../utils/archiveManager.js';

/**
 * Generate a unique certificate number for a student enrollment
 * Format: CERT_{2 letters segment}_{2 letters ville}_{6 digits starting at 103009}
 * Example: CERT_PR_KH_103009 (Prolean + Khemisset)
 */
async function generateCertificateNumber(sessionId) {
  // Get the segment name and city name for this session
  const sessionResult = await pool.query(`
    SELECT s.name as segment_name, c.name as city_name
    FROM sessions_formation sf
    JOIN segments s ON sf.segment_id = s.id
    JOIN cities c ON sf.ville_id = c.id
    WHERE sf.id = $1
  `, [sessionId]);

  let segmentCode = 'GE'; // Default if no segment (2 chars)
  let cityCode = 'VI'; // Default if no city (2 chars)

  if (sessionResult.rows.length > 0) {
    const row = sessionResult.rows[0];

    // Get segment code (first 2 letters, uppercase)
    if (row.segment_name) {
      segmentCode = row.segment_name
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 2)
        .padEnd(2, 'X');
    }

    // Get city code (first 2 letters, uppercase)
    if (row.city_name) {
      cityCode = row.city_name
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 2)
        .padEnd(2, 'X');
    }
  }

  // Get the next sequence number for this segment+city combination
  // Base number is 103008, so first certificate will be 103009
  const countResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM session_etudiants
    WHERE certificate_number LIKE $1
  `, [`CERT_${segmentCode}_${cityCode}_%`]);

  const baseNumber = 103008;
  const nextNumber = baseNumber + (parseInt(countResult.rows[0].count) || 0) + 1;

  return `CERT_${segmentCode}_${cityCode}_${nextNumber}`;
}

const router = express.Router();
let sessionsSchemaReadyPromise = null;

async function ensureSessionsFormationSchema() {
  if (!sessionsSchemaReadyPromise) {
    sessionsSchemaReadyPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions_formation (
            id TEXT PRIMARY KEY,
            titre VARCHAR(255) NOT NULL,
            description TEXT,
            date_debut DATE,
            date_fin DATE,
            ville_id TEXT,
            segment_id TEXT,
            statut VARCHAR(50) DEFAULT 'planifiee',
            prix_total DECIMAL(10, 2) DEFAULT 0,
            nombre_places INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS session_etudiants (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            statut_paiement VARCHAR(50) DEFAULT 'impaye',
            montant_total DECIMAL(10, 2) DEFAULT 0,
            montant_paye DECIMAL(10, 2) DEFAULT 0,
            montant_du DECIMAL(10, 2) DEFAULT 0,
            date_inscription TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(session_id, student_id)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS session_professeurs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            professeur_id TEXT NOT NULL,
            date_affectation TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(session_id, professeur_id)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS session_fichiers (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            type VARCHAR(50) NOT NULL,
            titre VARCHAR(255) NOT NULL,
            file_url VARCHAR(500),
            file_name VARCHAR(255),
            file_size INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);

        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS corps_formation_id TEXT
        `);
        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'presentielle'
        `);
        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS meeting_platform VARCHAR(100)
        `);
        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS meeting_link VARCHAR(500)
        `);
        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS prix_total DECIMAL(10, 2) DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE sessions_formation
          ADD COLUMN IF NOT EXISTS nombre_places INTEGER DEFAULT 0
        `);

        const formationIdColumn = await client.query(`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sessions_formation'
            AND column_name = 'formation_id'
          LIMIT 1
        `);

        if (formationIdColumn.rows.length > 0) {
          await client.query(`
            UPDATE sessions_formation
            SET corps_formation_id = formation_id
            WHERE corps_formation_id IS NULL
              AND formation_id IS NOT NULL
          `);
        }

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_sessions_formation_corps
          ON sessions_formation(corps_formation_id)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_sessions_formation_type
          ON sessions_formation(session_type)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_session_etudiants_session
          ON session_etudiants(session_id)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_session_professeurs_session
          ON session_professeurs(session_id)
        `);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  return sessionsSchemaReadyPromise;
}

router.use(async (req, res, next) => {
  try {
    await ensureSessionsFormationSchema();
    next();
  } catch (error) {
    console.error('Erreur initialisation schéma sessions_formation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

// ============================================
// SESSIONS DE FORMATION (CLASSES)
// ============================================

/**
 * GET /api/sessions-formation/auto-assignment-preview
 * Prévisualise l'auto-affectation (professeur et fiche de calcul)
 * pour un segment et une ville donnés
 */
router.get('/auto-assignment-preview',
  authenticateToken,
  async (req, res) => {
    try {
      const { segment_id, city_id } = req.query;

      if (!segment_id || !city_id) {
        return res.status(400).json({
          success: false,
          error: 'segment_id et city_id sont requis'
        });
      }

      // 1. Trouver le professeur assigné à cette ville ET ce segment
      const professorQuery = `
        SELECT p.id, p.full_name
        FROM profiles p
        INNER JOIN professor_cities pc ON pc.professor_id = p.id
        INNER JOIN professor_segments ps ON ps.professor_id = p.id
        WHERE pc.city_id = $1
        AND ps.segment_id = $2
        AND p.role = 'professor'
        LIMIT 1
      `;
      const professorResult = await pool.query(professorQuery, [city_id, segment_id]);

      // 2. Trouver la fiche de calcul assignée à ce segment ET cette ville (et publiée)
      const sheetQuery = `
        SELECT cs.id, cs.title
        FROM calculation_sheets cs
        INNER JOIN calculation_sheet_segments css ON css.sheet_id = cs.id
        INNER JOIN calculation_sheet_cities csc ON csc.sheet_id = cs.id
        WHERE css.segment_id = $1
        AND csc.city_id = $2
        AND cs.status = 'published'
        LIMIT 1
      `;
      const sheetResult = await pool.query(sheetQuery, [segment_id, city_id]);

      res.json({
        success: true,
        professor: professorResult.rows.length > 0 ? {
          id: professorResult.rows[0].id,
          full_name: professorResult.rows[0].full_name
        } : null,
        calculationSheet: sheetResult.rows.length > 0 ? {
          id: sheetResult.rows[0].id,
          title: sheetResult.rows[0].title
        } : null
      });

    } catch (error) {
      console.error('Error fetching auto-assignment preview:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/sessions-formation
 * Liste toutes les sessions de formation avec leurs statistiques
 * SCOPE: Filtre automatiquement par segment ET ville assignés à l'utilisateur
 */
router.get('/',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  injectUserScope,
  async (req, res) => {
    try {
      const { ville_id, segment_id, corps_formation_id, statut, annee } = req.query;

      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // SCOPE FILTERING: Filtre automatique par segment ET ville (sauf admin)
      const scopeFilter = buildScopeFilter(req, 'sf.segment_id', 'sf.ville_id');
      if (scopeFilter.hasScope) {
        whereConditions.push(...scopeFilter.conditions);
        params.push(...scopeFilter.params);
        paramIndex = scopeFilter.paramIndex;
      }

      // Filtres additionnels (optionnels)
      if (ville_id) {
        whereConditions.push(`sf.ville_id = $${paramIndex++}`);
        params.push(ville_id);
      }

      if (segment_id) {
        whereConditions.push(`sf.segment_id = $${paramIndex++}`);
        params.push(segment_id);
      }

      if (corps_formation_id) {
        whereConditions.push(`sf.corps_formation_id = $${paramIndex++}`);
        params.push(corps_formation_id);
      }

      if (statut) {
        whereConditions.push(`sf.statut = $${paramIndex++}`);
        params.push(statut);
      }

      if (annee) {
        whereConditions.push(`EXTRACT(YEAR FROM sf.date_debut) = $${paramIndex++}`);
        params.push(annee);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const query = `
        SELECT
          sf.id,
          sf.titre,
          sf.description,
          sf.date_debut,
          sf.date_fin,
          sf.session_type,
          sf.meeting_platform,
          sf.meeting_link,
          sf.ville_id,
          sf.segment_id,
          sf.corps_formation_id,
          sf.statut,
          sf.prix_total,
          sf.nombre_places,
          sf.created_at,
          sf.updated_at,
          c.name as ville_name,
          s.name as segment_name,
          s.color as segment_color,
          cf.name as corps_formation_name,
          cf.description as corps_formation_description,
          COUNT(DISTINCT se.id) as nombre_etudiants,
          COUNT(DISTINCT sp.id) as nombre_professeurs,
          COALESCE(SUM(se.montant_paye), 0) as total_paye,
          COALESCE(SUM(se.montant_du), 0) as total_du
        FROM sessions_formation sf
        LEFT JOIN cities c ON c.id = sf.ville_id
        LEFT JOIN segments s ON s.id = sf.segment_id
        LEFT JOIN corps_formation cf ON cf.id = sf.corps_formation_id
        LEFT JOIN session_etudiants se ON se.session_id = sf.id
        LEFT JOIN session_professeurs sp ON sp.session_id = sf.id
        ${whereClause}
        GROUP BY sf.id, sf.titre, sf.description, sf.date_debut, sf.date_fin, sf.session_type,
                 sf.meeting_platform, sf.meeting_link, sf.ville_id, sf.segment_id, sf.corps_formation_id,
                 sf.statut, sf.prix_total, sf.nombre_places, sf.created_at, sf.updated_at,
                 c.name, s.name, s.color, cf.name, cf.description
        ORDER BY sf.date_debut DESC NULLS LAST, sf.created_at DESC
      `;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        sessions: result.rows
      });

    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/sessions-formation/:id
 * Récupère une session avec tous ses détails
 * SCOPE: Vérifie que la session est dans le segment/ville de l'utilisateur
 */
router.get('/:id',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Session principale
      const sessionQuery = `
        SELECT
          sf.id,
          sf.titre,
          sf.description,
          sf.date_debut,
          sf.date_fin,
          sf.session_type,
          sf.meeting_platform,
          sf.meeting_link,
          sf.ville_id,
          sf.segment_id,
          sf.corps_formation_id,
          sf.statut,
          sf.prix_total,
          sf.nombre_places,
          sf.created_at,
          sf.updated_at,
          c.name as ville_name,
          s.name as segment_name,
          s.color as segment_color,
          cf.name as corps_formation_name,
          cf.description as corps_formation_description,
          COUNT(DISTINCT se.id) as nombre_etudiants,
          COUNT(DISTINCT sp.id) as nombre_professeurs,
          COALESCE(SUM(se.montant_paye), 0) as total_paye,
          COALESCE(SUM(se.montant_du), 0) as total_du
        FROM sessions_formation sf
        LEFT JOIN cities c ON c.id = sf.ville_id
        LEFT JOIN segments s ON s.id = sf.segment_id
        LEFT JOIN corps_formation cf ON cf.id = sf.corps_formation_id
        LEFT JOIN session_etudiants se ON se.session_id = sf.id
        LEFT JOIN session_professeurs sp ON sp.session_id = sf.id
        WHERE sf.id = $1
        GROUP BY sf.id, sf.titre, sf.description, sf.date_debut, sf.date_fin, sf.session_type,
                 sf.meeting_platform, sf.meeting_link, sf.ville_id, sf.segment_id, sf.corps_formation_id,
                 sf.statut, sf.prix_total, sf.nombre_places, sf.created_at, sf.updated_at,
                 c.name, s.name, s.color, cf.name, cf.description
      `;

      const sessionResult = await pool.query(sessionQuery, [id]);

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      const session = sessionResult.rows[0];

    // Étudiants (avec info sur les documents générés)
    const etudiantsQuery = `
      SELECT
        se.*,
        CONCAT(s.nom, ' ', s.prenom) as student_name,
        s.nom as student_first_name,
        s.prenom as student_last_name,
        s.email as student_email,
        s.phone as student_phone,
        s.cin as student_cin,
        s.whatsapp as student_whatsapp,
        s.date_naissance as student_birth_date,
        s.lieu_naissance as student_birth_place,
        s.adresse as student_address,
        s.profile_image_url as profile_image_url,
        f.title as formation_title,
        f.is_pack as formation_is_pack,
        CASE WHEN EXISTS (
          SELECT 1 FROM certificates c
          WHERE c.student_id = se.student_id
          AND c.session_id = se.session_id
        ) THEN true ELSE false END as has_documents
      FROM session_etudiants se
      LEFT JOIN students s ON s.id = se.student_id
      LEFT JOIN formations f ON f.id = se.formation_id
      WHERE se.session_id = $1
      ORDER BY se.date_inscription DESC
    `;
    const etudiantsResult = await pool.query(etudiantsQuery, [id]);

    // Professeurs
    const professeursQuery = `
      SELECT
        sp.*
      FROM session_professeurs sp
      WHERE sp.session_id = $1
      ORDER BY sp.date_affectation DESC
    `;
    const professeursResult = await pool.query(professeursQuery, [id]);

    // Fichiers
    const fichiersQuery = `
      SELECT * FROM session_fichiers
      WHERE session_id = $1
      ORDER BY created_at DESC
    `;
    const fichiersResult = await pool.query(fichiersQuery, [id]);

    // Statistiques détaillées
    const statsQuery = `
      SELECT
        COUNT(*) as nombre_etudiants,
        sf.prix_total,
        COALESCE(SUM(se.montant_paye), 0) as total_paye,
        COALESCE(SUM(CASE WHEN se.statut_paiement = 'partiellement_paye' THEN se.montant_paye ELSE 0 END), 0) as total_partiellement_paye,
        COALESCE(SUM(se.montant_du), 0) as total_impaye,
        COUNT(CASE WHEN se.statut_paiement = 'paye' THEN 1 END) as nombre_payes,
        COUNT(CASE WHEN se.statut_paiement = 'partiellement_paye' THEN 1 END) as nombre_partiellement_payes,
        COUNT(CASE WHEN se.statut_paiement = 'impaye' THEN 1 END) as nombre_impayes
      FROM sessions_formation sf
      LEFT JOIN session_etudiants se ON se.session_id = sf.id
      WHERE sf.id = $1
      GROUP BY sf.id, sf.prix_total
    `;
    const statsResult = await pool.query(statsQuery, [id]);
    const stats = statsResult.rows[0] || {};

    // Calcul du pourcentage payé
    const totalAttendu = parseFloat(session.prix_total) * parseInt(stats.nombre_etudiants || 0);
    stats.pourcentage_paye = totalAttendu > 0
      ? (parseFloat(stats.total_paye) / totalAttendu) * 100
      : 0;

    res.json({
      success: true,
      session: {
        ...session,
        etudiants: etudiantsResult.rows,
        professeurs: professeursResult.rows,
        fichiers: fichiersResult.rows,
        statistiques: stats
      }
    });

  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions-formation
 * Créer une nouvelle session
 * SCOPE: Vérifie que segment_id et ville_id sont dans le scope de l'utilisateur
 */
router.post('/',
  authenticateToken,
  requirePermission('training.sessions.create'),
  injectUserScope,
  async (req, res) => {
    try {
      const {
        titre,
        description,
        date_debut,
        date_fin,
        ville_id,
        segment_id,
        corps_formation_id,
        statut = 'planifiee',
        prix_total = 0,
        nombre_places = 0,
        session_type = 'presentielle',
        meeting_platform,
        meeting_link
      } = req.body;

      // Validation
      if (!titre || titre.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Le titre est obligatoire'
        });
      }

      // SCOPE VALIDATION: Vérifier que le segment et la ville sont dans le scope de l'utilisateur
      if (!req.userScope.isAdmin) {
        if (segment_id && !req.userScope.segmentIds.includes(segment_id)) {
          return res.status(403).json({
            success: false,
            error: 'Cannot create session in a segment outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
        if (ville_id && !req.userScope.cityIds.includes(ville_id)) {
          return res.status(403).json({
            success: false,
            error: 'Cannot create session in a city outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
      }

      const id = nanoid();
      const now = new Date().toISOString();

      const query = `
        INSERT INTO sessions_formation (
          id, titre, description, date_debut, date_fin,
          ville_id, segment_id, corps_formation_id, statut,
          prix_total, nombre_places,
          session_type, meeting_platform, meeting_link,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const values = [
        id, titre, description, date_debut, date_fin,
        ville_id, segment_id, corps_formation_id, statut,
        prix_total, nombre_places,
        session_type, meeting_platform || null, meeting_link || null,
        now, now
      ];

      const result = await pool.query(query, values);
      const newSession = result.rows[0];

      // NOUVEAU : Créer dossier d'archive pour la session
      try {
        const folderPath = await archiveManager.createSessionFolder(
          newSession.id,
          newSession.titre
        );

        // Enregistrer le chemin du dossier en base de données
        await pool.query(
          'INSERT INTO archive_folders (id, session_id, folder_path, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [nanoid(), newSession.id, folderPath, now, now]
        );

        console.log(`✓ Dossier archive créé pour la session: ${folderPath}`);
      } catch (folderError) {
        console.error('Erreur création dossier archive:', folderError);
        // Non-bloquant : la session est créée même si le dossier échoue
        newSession.archive_folder_error = true;
      }

      // NOUVEAU : Créer automatiquement une déclaration pour les sessions présentielles
      let autoDeclaration = null;
      let debugInfo = { ville_id, segment_id, professorFound: false, sheetFound: false };

      console.log(`📋 Session créée: ville_id=${ville_id}, segment_id=${segment_id}, session_id=${newSession.id}`);

      if (ville_id && segment_id) {
        try {
          console.log(`🔍 Recherche auto-affectation pour ville_id=${ville_id}, segment_id=${segment_id}`);

          // 1. Trouver le professeur assigné à cette ville ET ce segment
          const professorQuery = `
            SELECT p.id, p.full_name
            FROM profiles p
            INNER JOIN professor_cities pc ON pc.professor_id = p.id
            INNER JOIN professor_segments ps ON ps.professor_id = p.id
            WHERE pc.city_id = $1
            AND ps.segment_id = $2
            AND p.role = 'professor'
            LIMIT 1
          `;
          const professorResult = await pool.query(professorQuery, [ville_id, segment_id]);
          debugInfo.professorFound = professorResult.rows.length > 0;
          if (professorResult.rows.length > 0) {
            debugInfo.professorName = professorResult.rows[0].full_name;
          }

          // 2. Trouver la fiche de calcul assignée à ce segment ET cette ville (et publiée)
          const sheetQuery = `
            SELECT cs.id, cs.title
            FROM calculation_sheets cs
            INNER JOIN calculation_sheet_segments css ON css.sheet_id = cs.id
            INNER JOIN calculation_sheet_cities csc ON csc.sheet_id = cs.id
            WHERE css.segment_id = $1
            AND csc.city_id = $2
            AND cs.status = 'published'
            LIMIT 1
          `;
          const sheetResult = await pool.query(sheetQuery, [segment_id, ville_id]);
          debugInfo.sheetFound = sheetResult.rows.length > 0;
          if (sheetResult.rows.length > 0) {
            debugInfo.sheetName = sheetResult.rows[0].title;
          }

          console.log(`🔍 Debug auto-déclaration:`, JSON.stringify(debugInfo));

          // 3. Si on a trouvé un professeur, l'affecter à la session
          if (professorResult.rows.length > 0) {
            const professor = professorResult.rows[0];

            // Affecter le professeur à la session (table session_professeurs)
            const sessionProfId = nanoid();
            console.log(`📝 Insertion session_professeurs: id=${sessionProfId}, session_id=${newSession.id}, professeur_id=${professor.id}`);
            const insertResult = await pool.query(
              `INSERT INTO session_professeurs (id, session_id, professeur_id, date_affectation, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
              [sessionProfId, newSession.id, professor.id, now, now, now]
            );
            console.log(`✓ Professeur ${professor.full_name} affecté à la session (rows: ${insertResult.rowCount})`);
            debugInfo.professorAssigned = true;
            debugInfo.insertedRow = insertResult.rows[0];

            // 4. Si on a aussi une fiche de calcul, créer la déclaration
            if (sheetResult.rows.length > 0) {
              const sheet = sheetResult.rows[0];
              const declarationId = nanoid();

              await pool.query(
                `INSERT INTO professor_declarations
                 (id, professor_id, calculation_sheet_id, segment_id, city_id, start_date, end_date, form_data, status, session_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                  declarationId,
                  professor.id,
                  sheet.id,
                  segment_id,
                  ville_id,
                  date_debut,
                  date_fin,
                  '{}',
                  'a_declarer',
                  titre
                ]
              );

              autoDeclaration = {
                id: declarationId,
                professor_name: professor.full_name,
                sheet_name: sheet.title
              };

              console.log(`✓ Déclaration auto-créée: Prof ${professor.full_name}, Fiche: ${sheet.title}`);
            } else {
              console.log(`⚠ Pas de fiche de calcul publiée trouvée pour segment_id=${segment_id} et ville_id=${ville_id}`);
            }
          } else {
            console.log(`⚠ Pas de professeur trouvé pour ville_id=${ville_id} et segment_id=${segment_id}`);
          }
        } catch (declarationError) {
          console.error('Erreur création déclaration auto:', declarationError);
          // Non-bloquant : la session est créée même si la déclaration échoue
        }
      }

      res.status(201).json({
        success: true,
        session: newSession,
        autoDeclaration: autoDeclaration,
        debugInfo: debugInfo,
        message: autoDeclaration
          ? `Session créée avec succès. Déclaration auto-créée pour ${autoDeclaration.professor_name}`
          : 'Session créée avec succès'
      });

    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/sessions-formation/:id
 * Modifier une session
 * SCOPE: Vérifie que la session est dans le scope et que les nouvelles valeurs restent dans le scope
 */
router.put('/:id',
  authenticateToken,
  requirePermission('training.sessions.update'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        titre,
        description,
        date_debut,
        date_fin,
        ville_id,
        segment_id,
        corps_formation_id,
        statut,
        prix_total,
        nombre_places,
        session_type,
        meeting_platform,
        meeting_link
      } = req.body;

      // SCOPE VALIDATION: Si l'utilisateur modifie segment_id ou ville_id, vérifier qu'ils sont dans son scope
      if (!req.userScope.isAdmin) {
        if (segment_id !== undefined && !req.userScope.segmentIds.includes(segment_id)) {
          return res.status(403).json({
            success: false,
            error: 'Cannot move session to a segment outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
        if (ville_id !== undefined && !req.userScope.cityIds.includes(ville_id)) {
          return res.status(403).json({
            success: false,
            error: 'Cannot move session to a city outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
      }

      const now = new Date().toISOString();

      const query = `
        UPDATE sessions_formation
        SET
          titre = COALESCE($1, titre),
          description = COALESCE($2, description),
          date_debut = COALESCE($3, date_debut),
          date_fin = COALESCE($4, date_fin),
          ville_id = COALESCE($5, ville_id),
          segment_id = COALESCE($6, segment_id),
          corps_formation_id = COALESCE($7, corps_formation_id),
          statut = COALESCE($8, statut),
          prix_total = COALESCE($9, prix_total),
          nombre_places = COALESCE($10, nombre_places),
          session_type = COALESCE($11, session_type),
          meeting_platform = COALESCE($12, meeting_platform),
          meeting_link = COALESCE($13, meeting_link),
          updated_at = $14
        WHERE id = $15
        RETURNING *
      `;

      const values = [
        titre, description, date_debut, date_fin,
        ville_id, segment_id, corps_formation_id, statut,
        prix_total, nombre_places,
        session_type, meeting_platform, meeting_link,
        now, id
      ];

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      res.json({
        success: true,
        session: result.rows[0],
        message: 'Session modifiée avec succès'
      });

    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/sessions-formation/:id
 * Supprimer une session
 * SCOPE: Vérifie que la session est dans le segment/ville de l'utilisateur
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('training.sessions.delete'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Récupérer les infos de la session avant suppression
      const sessionInfo = await pool.query(
        'SELECT titre, segment_id, ville_id FROM sessions_formation WHERE id = $1',
        [id]
      );

      if (sessionInfo.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      const session = sessionInfo.rows[0];

      // 2. Supprimer les déclarations associées à cette session (par session_name)
      const deletedDeclarations = await pool.query(
        `DELETE FROM professor_declarations
         WHERE session_name = $1
         AND segment_id = $2
         AND city_id = $3
         RETURNING id, professor_id`,
        [session.titre, session.segment_id, session.ville_id]
      );

      if (deletedDeclarations.rowCount > 0) {
        console.log(`🗑️ ${deletedDeclarations.rowCount} déclaration(s) supprimée(s) pour la session "${session.titre}"`);
      }

      // 3. Supprimer la session
      const result = await pool.query(
        'DELETE FROM sessions_formation WHERE id = $1 RETURNING *',
        [id]
      );

      res.json({
        success: true,
        message: 'Session supprimée avec succès',
        declarations_deleted: deletedDeclarations.rowCount
      });

    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================
// GESTION DES ÉTUDIANTS DANS UNE SESSION
// ============================================

/**
 * POST /api/sessions-formation/:id/etudiants
 * Ajouter un étudiant à une session
 */
/**
 * POST /:id/etudiants
 * Inscrire un étudiant à une session
 * Protected: Requires training.sessions.add_student permission
 */
router.post('/:id/etudiants',
  authenticateToken,
  requirePermission('training.sessions.add_student'),
  async (req, res) => {
  try {
    const { id: session_id } = req.params;
    const {
      student_id,
      formation_id,
      montant_total,
      montant_paye = 0,
      numero_bon,
      centre_id,
      classe_id,
      statut_paiement = 'impaye',
      discount_percentage = 0
    } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'student_id est obligatoire'
      });
    }

    if (!formation_id) {
      return res.status(400).json({
        success: false,
        error: 'formation_id est obligatoire - veuillez choisir une formation'
      });
    }

    // Vérifier que la session existe et récupérer son corps_formation_id
    const sessionResult = await pool.query(
      'SELECT corps_formation_id FROM sessions_formation WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const { corps_formation_id } = sessionResult.rows[0];

    // Vérifier que la formation appartient au corps de formation de la session
    // ET récupérer le prix de la formation
    let formationPrice = 0;
    if (corps_formation_id) {
      const formationResult = await pool.query(
        'SELECT id, price FROM formations WHERE id = $1 AND corps_formation_id = $2',
        [formation_id, corps_formation_id]
      );

      if (formationResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'La formation sélectionnée n\'appartient pas au corps de formation de cette session'
        });
      }

      formationPrice = parseFloat(formationResult.rows[0].price) || 0;
    } else {
      // Si pas de corps_formation_id, récupérer quand même le prix
      const formationResult = await pool.query(
        'SELECT price FROM formations WHERE id = $1',
        [formation_id]
      );

      if (formationResult.rows.length > 0) {
        formationPrice = parseFloat(formationResult.rows[0].price) || 0;
      }
    }

    // Vérifier que l'étudiant n'est pas déjà inscrit
    const checkExisting = await pool.query(
      'SELECT id FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
      [session_id, student_id]
    );

    if (checkExisting.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'L\'étudiant est déjà inscrit à cette session'
      });
    }

    const inscriptionId = nanoid();
    const now = new Date().toISOString();

    // Calculer remise et prix final
    const formation_original_price = montant_total || formationPrice;
    const discount_pct = parseFloat(discount_percentage) || 0;
    const discount_amount = (formation_original_price * discount_pct) / 100;
    const final_montant_total = formation_original_price - discount_amount;
    const montant_du = final_montant_total - (montant_paye || 0);

    // Generate unique certificate number for this enrollment
    const certificateNumber = await generateCertificateNumber(session_id);

    const query = `
      INSERT INTO session_etudiants (
        id, session_id, student_id, formation_id, statut_paiement,
        montant_total, montant_paye, montant_du,
        discount_percentage, discount_amount, formation_original_price,
        centre_id, classe_id, numero_bon,
        certificate_number,
        date_inscription, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      inscriptionId, session_id, student_id, formation_id, statut_paiement,
      final_montant_total, montant_paye || 0, montant_du,
      discount_pct, discount_amount, formation_original_price,
      centre_id || null, classe_id || null, numero_bon || null,
      certificateNumber,
      now, now, now
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      inscription: result.rows[0],
      message: 'Étudiant ajouté à la session avec succès'
    });

  } catch (error) {
    console.error('Error adding student to session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions-formation/:sessionId/etudiants/bulk-status
 * Mettre à jour le statut de plusieurs étudiants en une seule requête
 * IMPORTANT: Cette route DOIT être définie AVANT /:sessionId/etudiants/:etudiantId
 * Protected: Requires training.sessions.edit_student permission
 */
router.put('/:sessionId/etudiants/bulk-status',
  authenticateToken,
  requirePermission('training.sessions.edit_student'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { student_ids, status } = req.body;

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'student_ids doit être un tableau non vide'
      });
    }

    if (!status || !['valide', 'abandonne'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status doit être "valide" ou "abandonne"'
      });
    }

    // Vérifier que la session existe
    const sessionCheck = await pool.query(
      'SELECT id FROM sessions_formation WHERE id = $1',
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // RÈGLE MÉTIER: Si le statut est "abandonne" et l'utilisateur n'est PAS admin,
    // vérifier qu'aucun étudiant n'a de documents générés
    if (status === 'abandonne' && !req.userScope.isAdmin) {
      const studentsWithDocs = await pool.query(
        `SELECT DISTINCT se.student_id, s.nom, s.prenom
         FROM session_etudiants se
         JOIN students s ON s.id = se.student_id
         WHERE se.session_id = $1
         AND se.student_id = ANY($2)
         AND EXISTS (
           SELECT 1 FROM certificates c
           WHERE c.student_id = se.student_id
           AND c.session_id = se.session_id
         )`,
        [sessionId, student_ids]
      );

      if (studentsWithDocs.rows.length > 0) {
        const studentNames = studentsWithDocs.rows
          .map(s => `${s.nom} ${s.prenom}`)
          .join(', ');

        return res.status(403).json({
          success: false,
          error: `Impossible de mettre le statut "abandonné" pour les étudiants ayant des documents générés. Seul un administrateur peut effectuer cette action.`,
          students_with_documents: studentsWithDocs.rows.map(s => ({
            id: s.student_id,
            name: `${s.nom} ${s.prenom}`
          })),
          code: 'HAS_DOCUMENTS'
        });
      }
    }

    // Mettre à jour le statut pour tous les étudiants sélectionnés
    const result = await pool.query(
      `UPDATE session_etudiants
       SET student_status = $1, updated_at = NOW()
       WHERE session_id = $2 AND student_id = ANY($3)
       RETURNING student_id`,
      [status, sessionId, student_ids]
    );

    const updatedCount = result.rows.length;

    res.json({
      success: true,
      updated_count: updatedCount,
      message: `${updatedCount} étudiant(s) mis à jour avec le statut "${status}"`,
      updated_ids: result.rows.map(r => r.student_id)
    });

  } catch (error) {
    console.error('Error updating bulk student status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions-formation/:sessionId/etudiants/:studentId/available-documents
 * Récupérer les templates de documents disponibles pour un étudiant
 */
router.get('/:sessionId/etudiants/:studentId/available-documents',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;

    // Récupérer la formation de l'étudiant dans cette session
    const enrollmentResult = await pool.query(
      `SELECT se.formation_id, se.student_status, f.title as formation_title
       FROM session_etudiants se
       LEFT JOIN formations f ON f.id = se.formation_id
       WHERE se.session_id = $1 AND se.student_id = $2`,
      [sessionId, studentId]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Étudiant non trouvé dans cette session'
      });
    }

    const { formation_id, student_status, formation_title } = enrollmentResult.rows[0];

    if (!formation_id) {
      return res.json({
        success: true,
        templates: [],
        message: 'Aucune formation assignée à cet étudiant'
      });
    }

    // Récupérer les templates liés à cette formation
    const templatesResult = await pool.query(
      `SELECT
         ft.id as link_id,
         ft.document_type,
         ft.is_default,
         ct.id as template_id,
         ct.name as template_name,
         ct.description as template_description,
         ct.template_config,
         ct.background_image_url,
         ct.preview_image_url
       FROM formation_templates ft
       JOIN certificate_templates ct ON ct.id = ft.template_id
       WHERE ft.formation_id = $1
       ORDER BY ft.document_type, ft.is_default DESC, ct.name ASC`,
      [formation_id]
    );

    res.json({
      success: true,
      formation_id,
      formation_title,
      student_status,
      templates: templatesResult.rows
    });

  } catch (error) {
    console.error('Error fetching available documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions-formation/:sessionId/etudiants/:etudiantId
 * Modifier l'inscription d'un étudiant (paiement, formation, numero_bon)
 * Protected: Requires training.sessions.edit_student permission
 */
router.put('/:sessionId/etudiants/:etudiantId',
  authenticateToken,
  requirePermission('training.sessions.edit_student'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
  try {
    const { sessionId, etudiantId } = req.params;
    const { statut_paiement, montant_paye, discount_percentage, discount_reason, formation_id, numero_bon, new_session_id, delivery_status, date_inscription } = req.body;

    const now = new Date().toISOString();

    // Vérifier si l'utilisateur est admin pour la modification de date_inscription
    const isAdmin = req.user.role === 'admin';

    // Validation: seuls les admins peuvent modifier date_inscription
    if (date_inscription && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Seuls les administrateurs peuvent modifier la date d\'inscription'
      });
    }

    // Si transfert vers une autre session
    if (new_session_id && new_session_id !== sessionId) {
      // D'abord récupérer l'inscription pour avoir le vrai student_id
      let inscriptionForTransfer = await pool.query(
        'SELECT id, student_id FROM session_etudiants WHERE id = $1 AND session_id = $2',
        [etudiantId, sessionId]
      );

      // Si pas trouvé par ID, essayer par student_id (compatibilité)
      if (inscriptionForTransfer.rows.length === 0) {
        inscriptionForTransfer = await pool.query(
          'SELECT id, student_id FROM session_etudiants WHERE student_id = $1 AND session_id = $2',
          [etudiantId, sessionId]
        );
      }

      if (inscriptionForTransfer.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Inscription not found'
        });
      }

      const inscriptionIdForTransfer = inscriptionForTransfer.rows[0].id;
      const studentIdForTransfer = inscriptionForTransfer.rows[0].student_id;

      // Vérifier que la nouvelle session existe
      const newSessionCheck = await pool.query(
        'SELECT id FROM sessions_formation WHERE id = $1',
        [new_session_id]
      );
      if (newSessionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'La session de destination n\'existe pas'
        });
      }

      // Vérifier que l'étudiant n'est pas déjà dans la nouvelle session
      const existingCheck = await pool.query(
        'SELECT id FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
        [new_session_id, studentIdForTransfer]
      );
      if (existingCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'L\'étudiant est déjà inscrit dans la session de destination'
        });
      }

      // Transférer l'étudiant : mettre à jour la session_id
      const transferResult = await pool.query(
        `UPDATE session_etudiants
         SET session_id = $1, updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [new_session_id, now, inscriptionIdForTransfer]
      );

      if (transferResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Inscription not found'
        });
      }

      return res.json({
        success: true,
        inscription: transferResult.rows[0],
        message: 'Étudiant transféré vers la nouvelle session avec succès',
        transferred: true
      });
    }

    // Récupérer les données actuelles incluant formation_original_price
    // Note: etudiantId peut être soit l'ID de l'inscription (session_etudiants.id) soit le student_id
    // On cherche d'abord par ID d'inscription, sinon par student_id pour compatibilité
    let currentResult = await pool.query(
      'SELECT id, student_id, montant_total, discount_amount, discount_percentage, formation_original_price, montant_paye, delivery_status, date_inscription, original_date_inscription FROM session_etudiants WHERE id = $1 AND session_id = $2',
      [etudiantId, sessionId]
    );

    // Si pas trouvé par ID, essayer par student_id (compatibilité)
    if (currentResult.rows.length === 0) {
      currentResult = await pool.query(
        'SELECT id, student_id, montant_total, discount_amount, discount_percentage, formation_original_price, montant_paye, delivery_status, date_inscription, original_date_inscription FROM session_etudiants WHERE student_id = $1 AND session_id = $2',
        [etudiantId, sessionId]
      );
    }

    // Récupérer l'ID de l'inscription et le student_id pour les requêtes suivantes
    const inscriptionId = currentResult.rows[0]?.id;
    const studentId = currentResult.rows[0]?.student_id;

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inscription not found'
      });
    }

    let montant_total = parseFloat(currentResult.rows[0].montant_total);
    const current_discount_amount = parseFloat(currentResult.rows[0].discount_amount) || 0;
    const current_discount_percentage = parseFloat(currentResult.rows[0].discount_percentage) || 0;
    const current_montant_paye = parseFloat(currentResult.rows[0].montant_paye) || 0;
    const formation_original_price = parseFloat(currentResult.rows[0].formation_original_price) || (montant_total + current_discount_amount);

    // Si un nouveau pourcentage de remise est fourni, recalculer
    let new_discount_percentage = discount_percentage !== undefined ? parseFloat(discount_percentage) : null;
    let new_discount_amount = null;

    if (new_discount_percentage !== null) {
      // Calculer le nouveau montant de remise depuis le pourcentage
      new_discount_amount = (formation_original_price * new_discount_percentage) / 100;
      // Recalculer le montant_total
      montant_total = formation_original_price - new_discount_amount;
    }

    const new_montant_paye = montant_paye !== undefined ? parseFloat(montant_paye) : null;
    // Recalculer montant_du si on change le discount OU si on change le montant_paye
    let montant_du = null;
    if (new_montant_paye !== null) {
      montant_du = montant_total - new_montant_paye;
    } else if (new_discount_percentage !== null) {
      // Si on change le discount mais pas le montant_paye, recalculer montant_du avec le montant_paye actuel
      montant_du = montant_total - current_montant_paye;
    }

    // Déterminer automatiquement le statut si montant_paye fourni ou si discount change
    let new_statut = statut_paiement;
    if (new_montant_paye !== null) {
      if (new_montant_paye >= montant_total) {
        new_statut = 'paye';
      } else if (new_montant_paye > 0) {
        new_statut = 'partiellement_paye';
      } else {
        new_statut = 'impaye';
      }
    } else if (new_discount_percentage !== null) {
      // Recalculer le statut basé sur le montant_paye actuel et le nouveau total
      if (current_montant_paye >= montant_total) {
        new_statut = 'paye';
      } else if (current_montant_paye > 0) {
        new_statut = 'partiellement_paye';
      } else {
        new_statut = 'impaye';
      }
    }

    // ============================================
    // GESTION AUTOMATIQUE DE LA DATE D'INSCRIPTION
    // Pour les sessions en ligne uniquement
    // ============================================
    let updated_date_inscription = date_inscription || null;
    let updated_original_date_inscription = null;

    // Si delivery_status est fourni, gérer la mise à jour automatique de la date
    if (delivery_status !== undefined) {
      const current_delivery_status = currentResult.rows[0].delivery_status;
      const current_date_inscription = currentResult.rows[0].date_inscription;
      const current_original_date_inscription = currentResult.rows[0].original_date_inscription;

      // Récupérer le type de session
      const sessionTypeResult = await pool.query(
        'SELECT session_type FROM sessions_formation WHERE id = $1',
        [sessionId]
      );

      if (sessionTypeResult.rows.length > 0) {
        const session_type = sessionTypeResult.rows[0].session_type;

        // Logique uniquement pour les sessions en ligne
        if (session_type === 'en_ligne') {
          // Transition: non_livree → livree
          if (current_delivery_status === 'non_livree' && delivery_status === 'livree') {
            // Sauvegarder la date d'inscription originale si pas déjà sauvegardée
            if (!current_original_date_inscription) {
              updated_original_date_inscription = current_date_inscription;
            }
            // Mettre date_inscription à la date actuelle (date de livraison)
            updated_date_inscription = now;
          }
          // Transition: livree → non_livree
          else if (current_delivery_status === 'livree' && delivery_status === 'non_livree') {
            // Restaurer la date d'inscription originale
            if (current_original_date_inscription) {
              updated_date_inscription = current_original_date_inscription;
            }
          }
        }
      }
    }

    const query = `
      UPDATE session_etudiants
      SET
        statut_paiement = COALESCE($1, statut_paiement),
        montant_paye = COALESCE($2, montant_paye),
        montant_du = COALESCE($3, montant_du),
        discount_percentage = COALESCE($4, discount_percentage),
        discount_amount = COALESCE($5, discount_amount),
        discount_reason = COALESCE($6, discount_reason),
        montant_total = COALESCE($7, montant_total),
        formation_id = COALESCE($8, formation_id),
        numero_bon = COALESCE($9, numero_bon),
        delivery_status = COALESCE($10, delivery_status),
        date_inscription = COALESCE($11, date_inscription),
        original_date_inscription = COALESCE($12, original_date_inscription),
        updated_at = $13
      WHERE id = $14
      RETURNING *
    `;

    const values = [
      new_statut,
      new_montant_paye,
      montant_du,
      new_discount_percentage,
      new_discount_amount,
      discount_reason,
      new_discount_percentage !== null ? montant_total : null,
      formation_id || null,
      numero_bon || null,
      delivery_status || null,
      (isAdmin && date_inscription) ? date_inscription : updated_date_inscription,
      updated_original_date_inscription,
      now,
      inscriptionId
    ];
    const result = await pool.query(query, values);

    res.json({
      success: true,
      inscription: result.rows[0],
      message: 'Inscription mise à jour avec succès'
    });

  } catch (error) {
    console.error('Error updating student inscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions-formation/:sessionId/etudiants/:etudiantId
 * Retirer un étudiant d'une session
 * Protected: Requires training.sessions.remove_student permission
 */
router.delete('/:sessionId/etudiants/:etudiantId',
  authenticateToken,
  requirePermission('training.sessions.remove_student'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
  try {
    const { sessionId, etudiantId } = req.params;

    // D'abord essayer de supprimer par ID d'inscription
    let result = await pool.query(
      'DELETE FROM session_etudiants WHERE id = $1 AND session_id = $2 RETURNING *',
      [etudiantId, sessionId]
    );

    // Si pas trouvé par ID, essayer par student_id (compatibilité)
    if (result.rows.length === 0) {
      result = await pool.query(
        'DELETE FROM session_etudiants WHERE student_id = $1 AND session_id = $2 RETURNING *',
        [etudiantId, sessionId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inscription not found'
      });
    }

    res.json({
      success: true,
      message: 'Étudiant retiré de la session avec succès'
    });

  } catch (error) {
    console.error('Error removing student from session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GESTION DES PROFESSEURS DANS UNE SESSION
// ============================================

/**
 * POST /api/sessions-formation/:id/professeurs
 * Affecter un professeur à une session
 * Protected: Requires training.sessions.update permission
 */
router.post('/:id/professeurs',
  authenticateToken,
  requirePermission('training.sessions.update'),
  async (req, res) => {
  try {
    const { id: session_id } = req.params;
    const { professeur_id } = req.body;

    if (!professeur_id) {
      return res.status(400).json({
        success: false,
        error: 'professeur_id est obligatoire'
      });
    }

    // Vérifier que le professeur n'est pas déjà affecté
    const checkExisting = await pool.query(
      'SELECT id FROM session_professeurs WHERE session_id = $1 AND professeur_id = $2',
      [session_id, professeur_id]
    );

    if (checkExisting.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Le professeur est déjà affecté à cette session'
      });
    }

    const affectationId = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO session_professeurs (
        id, session_id, professeur_id, date_affectation,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [affectationId, session_id, professeur_id, now, now, now];
    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      affectation: result.rows[0],
      message: 'Professeur affecté à la session avec succès'
    });

  } catch (error) {
    console.error('Error adding professor to session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions-formation/:sessionId/professeurs/:professeurId
 * Retirer un professeur d'une session
 * Protected: Requires training.sessions.update permission
 */
router.delete('/:sessionId/professeurs/:professeurId',
  authenticateToken,
  requirePermission('training.sessions.update'),
  async (req, res) => {
  try {
    const { sessionId, professeurId } = req.params;

    const result = await pool.query(
      'DELETE FROM session_professeurs WHERE session_id = $1 AND professeur_id = $2 RETURNING *',
      [sessionId, professeurId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Affectation not found'
      });
    }

    res.json({
      success: true,
      message: 'Professeur retiré de la session avec succès'
    });

  } catch (error) {
    console.error('Error removing professor from session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GESTION DES FICHIERS (TESTS ET PRÉSENCES)
// ============================================

/**
 * POST /api/sessions-formation/:id/fichiers
 * Ajouter un fichier (test ou présence)
 * Protected: Requires training.sessions.update permission
 */
router.post('/:id/fichiers',
  authenticateToken,
  requirePermission('training.sessions.update'),
  async (req, res) => {
  try {
    const { id: session_id } = req.params;
    const { type, titre, file_url, file_name, file_size } = req.body;

    if (!type || !titre) {
      return res.status(400).json({
        success: false,
        error: 'type et titre sont obligatoires'
      });
    }

    if (!['test', 'presence'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type doit être "test" ou "presence"'
      });
    }

    const fichierId = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO session_fichiers (
        id, session_id, type, titre, file_url,
        file_name, file_size, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      fichierId, session_id, type, titre, file_url,
      file_name, file_size, now, now
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      fichier: result.rows[0],
      message: 'Fichier ajouté avec succès'
    });

  } catch (error) {
    console.error('Error adding file to session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions-formation/fichiers/:fichierId
 * Supprimer un fichier
 * Protected: Requires training.sessions.delete permission
 */
router.delete('/fichiers/:fichierId',
  authenticateToken,
  requirePermission('training.sessions.delete'),
  async (req, res) => {
  try {
    const { fichierId } = req.params;

    const result = await pool.query(
      'DELETE FROM session_fichiers WHERE id = $1 RETURNING *',
      [fichierId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fichier not found'
      });
    }

    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ROUTES DE PAIEMENTS DES ÉTUDIANTS
// ============================================

/**
 * POST /api/sessions-formation/:sessionId/etudiants/:studentId/paiements
 * Enregistrer un nouveau paiement pour un étudiant
 */
router.post('/:sessionId/etudiants/:studentId/paiements',
  authenticateToken,
  requirePermission('training.sessions.edit_student'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;
    const { amount, payment_date, payment_method, reference_number, note } = req.body;

    // Validation des données
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le montant du paiement doit être supérieur à zéro'
      });
    }

    const validMethods = ['especes', 'virement', 'cheque', 'carte', 'autre'];
    if (!payment_method || !validMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        error: 'Méthode de paiement invalide'
      });
    }

    // Récupérer l'enregistrement session_etudiant
    const sessionEtudiantResult = await pool.query(
      'SELECT * FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
      [sessionId, studentId]
    );

    if (sessionEtudiantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Étudiant non trouvé dans cette session'
      });
    }

    const sessionEtudiant = sessionEtudiantResult.rows[0];

    // Vérifier que le paiement ne dépasse pas le montant restant dû
    const montantDu = parseFloat(sessionEtudiant.montant_du || 0);
    if (parseFloat(amount) > montantDu) {
      return res.status(400).json({
        success: false,
        error: `Le montant du paiement (${amount} DH) dépasse le montant restant dû (${montantDu.toFixed(2)} DH)`
      });
    }

    // Créer le paiement
    const paymentResult = await pool.query(
      `INSERT INTO student_payments (
        session_etudiant_id,
        amount,
        payment_date,
        payment_method,
        reference_number,
        note
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        sessionEtudiant.id,
        amount,
        payment_date || new Date().toISOString().split('T')[0],
        payment_method,
        reference_number || null,
        note || null
      ]
    );

    const payment = paymentResult.rows[0];

    // Mettre à jour montant_paye et statut_paiement dans session_etudiants
    const newMontantPaye = parseFloat(sessionEtudiant.montant_paye || 0) + parseFloat(amount);
    const newMontantDu = parseFloat(sessionEtudiant.montant_total || 0) - newMontantPaye;

    let newStatutPaiement = 'impaye';
    if (newMontantPaye >= parseFloat(sessionEtudiant.montant_total || 0)) {
      newStatutPaiement = 'paye';
    } else if (newMontantPaye > 0) {
      newStatutPaiement = 'partiellement_paye';
    }

    await pool.query(
      `UPDATE session_etudiants
       SET montant_paye = $1,
           montant_du = $2,
           statut_paiement = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newMontantPaye, newMontantDu, newStatutPaiement, sessionEtudiant.id]
    );

    res.status(201).json({
      success: true,
      payment,
      updated_totals: {
        montant_paye: newMontantPaye,
        montant_du: newMontantDu,
        statut_paiement: newStatutPaiement
      }
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions-formation/:sessionId/etudiants/:studentId/paiements
 * Récupérer l'historique des paiements d'un étudiant
 */
router.get('/:sessionId/etudiants/:studentId/paiements',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;

    // Récupérer l'enregistrement session_etudiant
    const sessionEtudiantResult = await pool.query(
      'SELECT * FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
      [sessionId, studentId]
    );

    if (sessionEtudiantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Étudiant non trouvé dans cette session'
      });
    }

    const sessionEtudiant = sessionEtudiantResult.rows[0];

    // Récupérer tous les paiements
    const paymentsResult = await pool.query(
      `SELECT * FROM student_payments
       WHERE session_etudiant_id = $1
       ORDER BY payment_date DESC, created_at DESC`,
      [sessionEtudiant.id]
    );

    res.json({
      success: true,
      payments: paymentsResult.rows,
      totals: {
        montant_total: parseFloat(sessionEtudiant.montant_total || 0),
        montant_paye: parseFloat(sessionEtudiant.montant_paye || 0),
        montant_du: parseFloat(sessionEtudiant.montant_du || 0),
        statut_paiement: sessionEtudiant.statut_paiement
      }
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions-formation/:sessionId/etudiants/:studentId/paiements/:paymentId
 * Annuler/Supprimer un paiement
 */
router.delete('/:sessionId/etudiants/:studentId/paiements/:paymentId',
  authenticateToken,
  requirePermission('training.sessions.delete_payment'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
  try {
    const { sessionId, studentId, paymentId } = req.params;

    // Récupérer l'enregistrement session_etudiant
    const sessionEtudiantResult = await pool.query(
      'SELECT * FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
      [sessionId, studentId]
    );

    if (sessionEtudiantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Étudiant non trouvé dans cette session'
      });
    }

    const sessionEtudiant = sessionEtudiantResult.rows[0];

    // Récupérer le paiement à supprimer
    const paymentResult = await pool.query(
      'SELECT * FROM student_payments WHERE id = $1 AND session_etudiant_id = $2',
      [paymentId, sessionEtudiant.id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paiement non trouvé'
      });
    }

    const payment = paymentResult.rows[0];
    const paymentAmount = parseFloat(payment.amount);

    // Supprimer le paiement
    await pool.query('DELETE FROM student_payments WHERE id = $1', [paymentId]);

    // Mettre à jour montant_paye et statut_paiement dans session_etudiants
    const newMontantPaye = parseFloat(sessionEtudiant.montant_paye || 0) - paymentAmount;
    const newMontantDu = parseFloat(sessionEtudiant.montant_total || 0) - newMontantPaye;

    let newStatutPaiement = 'impaye';
    if (newMontantPaye >= parseFloat(sessionEtudiant.montant_total || 0)) {
      newStatutPaiement = 'paye';
    } else if (newMontantPaye > 0) {
      newStatutPaiement = 'partiellement_paye';
    }

    await pool.query(
      `UPDATE session_etudiants
       SET montant_paye = $1,
           montant_du = $2,
           statut_paiement = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newMontantPaye, newMontantDu, newStatutPaiement, sessionEtudiant.id]
    );

    res.json({
      success: true,
      message: 'Paiement annulé avec succès',
      updated_totals: {
        montant_paye: newMontantPaye,
        montant_du: newMontantDu,
        statut_paiement: newStatutPaiement
      }
    });

  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions-formation/:sessionId/students/:studentId/transfer
 * Transférer un étudiant d'une session à une autre
 * Body: { new_session_id, preserve_payments?, transfer_documents? }
 * SCOPE: Vérifie que les deux sessions sont dans le scope de l'utilisateur
 */
router.post('/:sessionId/students/:studentId/transfer',
  authenticateToken,
  requirePermission('training.sessions.transfer_student'),
  injectUserScope,
  async (req, res) => {
    const { sessionId, studentId } = req.params;
    const { new_session_id, preserve_payments = true, transfer_documents = true, reason } = req.body;

    if (!new_session_id) {
      return res.status(400).json({
        success: false,
        error: 'new_session_id is required'
      });
    }

    if (sessionId === new_session_id) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination sessions cannot be the same'
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Vérifier que les deux sessions existent et sont dans le scope
      const sessionsCheck = await client.query(
        'SELECT id, titre FROM sessions_formation WHERE id = ANY($1)',
        [[sessionId, new_session_id]]
      );

      if (sessionsCheck.rows.length !== 2) {
        throw new Error('One or both sessions not found');
      }

      // SCOPE: Vérifier que les sessions sont dans le scope
      if (!req.userScope.isAdmin) {
        for (const session of sessionsCheck.rows) {
          // Récupérer segment_id et ville_id de la session
          const scopeCheck = await client.query(
            'SELECT segment_id, ville_id FROM sessions_formation WHERE id = $1',
            [session.id]
          );

          const sess = scopeCheck.rows[0];
          if (sess.segment_id && !req.userScope.segmentIds.includes(sess.segment_id)) {
            return res.status(403).json({
              success: false,
              error: `Session ${session.titre} is outside your scope`,
              code: 'OUTSIDE_SCOPE'
            });
          }
          if (sess.ville_id && !req.userScope.cityIds.includes(sess.ville_id)) {
            return res.status(403).json({
              success: false,
              error: `Session ${session.titre} is outside your scope`,
              code: 'OUTSIDE_SCOPE'
            });
          }
        }
      }

      // 1. Récupérer l'enrollment actuel
      const enrollmentResult = await client.query(
        'SELECT * FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );

      if (enrollmentResult.rows.length === 0) {
        throw new Error('Student enrollment not found in source session');
      }

      const enrollment = enrollmentResult.rows[0];

      // 2. Vérifier que l'étudiant n'est pas déjà inscrit dans la session cible
      const existingCheck = await client.query(
        'SELECT id FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
        [new_session_id, studentId]
      );

      if (existingCheck.rows.length > 0) {
        throw new Error('Student is already enrolled in the target session');
      }

      // 3. Déplacer le dossier de documents si demandé
      let moveResult = { filesCount: 0, old_path: null, new_path: null };
      if (transfer_documents) {
        try {
          moveResult = await archiveManager.moveStudentFolder(
            sessionId,
            studentId,
            new_session_id
          );
          console.log(`✓ Dossier déplacé: ${moveResult.filesCount} fichiers`);
        } catch (moveError) {
          console.warn('Warning: Could not move student folder:', moveError.message);
          // Non-bloquant : continuer même si le déplacement échoue
        }
      }

      // 4. Supprimer l'ancien enrollment
      await client.query(
        'DELETE FROM session_etudiants WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );

      // 5. Créer le nouvel enrollment
      const now = new Date().toISOString();
      const newEnrollment = {
        id: nanoid(),
        session_id: new_session_id,
        student_id: studentId,
        formation_id: enrollment.formation_id,
        montant_total: preserve_payments ? enrollment.montant_total : 0,
        montant_paye: preserve_payments ? enrollment.montant_paye : 0,
        montant_du: preserve_payments ? enrollment.montant_du : 0,
        statut_paiement: preserve_payments ? enrollment.statut_paiement : 'impaye',
        discount_percentage: preserve_payments ? enrollment.discount_percentage : 0,
        discount_amount: preserve_payments ? enrollment.discount_amount : 0,
        discount_reason: preserve_payments ? enrollment.discount_reason : null,
        formation_original_price: enrollment.formation_original_price,
        centre_id: enrollment.centre_id,
        classe_id: enrollment.classe_id,
        numero_bon: enrollment.numero_bon,
        student_status: enrollment.student_status || 'valide',
        date_inscription: now,
        created_at: now,
        updated_at: now
      };

      await client.query(
        `INSERT INTO session_etudiants (
          id, session_id, student_id, formation_id,
          montant_total, montant_paye, montant_du, statut_paiement,
          discount_percentage, discount_amount, discount_reason, formation_original_price,
          centre_id, classe_id, numero_bon, student_status,
          date_inscription, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          newEnrollment.id, newEnrollment.session_id, newEnrollment.student_id,
          newEnrollment.formation_id, newEnrollment.montant_total, newEnrollment.montant_paye,
          newEnrollment.montant_du, newEnrollment.statut_paiement,
          newEnrollment.discount_percentage, newEnrollment.discount_amount,
          newEnrollment.discount_reason, newEnrollment.formation_original_price,
          newEnrollment.centre_id, newEnrollment.classe_id, newEnrollment.numero_bon,
          newEnrollment.student_status, newEnrollment.date_inscription,
          newEnrollment.created_at, newEnrollment.updated_at
        ]
      );

      // 6. Mettre à jour les certificats pour pointer vers la nouvelle session
      const certUpdateResult = await client.query(
        'UPDATE certificates SET session_id = $1 WHERE student_id = $2 AND session_id = $3 RETURNING id',
        [new_session_id, studentId, sessionId]
      );

      // 7. Log du transfert (optionnel - pour audit)
      console.log(`✓ Étudiant ${studentId} transféré de ${sessionId} vers ${new_session_id}`);
      if (reason) {
        console.log(`  Raison: ${reason}`);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Étudiant transféré avec succès',
        transfer_details: {
          from_session: sessionId,
          to_session: new_session_id,
          student_id: studentId,
          documents_moved: moveResult.filesCount,
          certificates_updated: certUpdateResult.rows.length,
          payments_preserved: preserve_payments,
          old_folder: moveResult.old_path,
          new_folder: moveResult.new_path
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error transferring student:', error);

      // Tentative de rollback du déplacement de dossier si nécessaire
      // (dans la pratique, c'est complexe, donc on log juste l'erreur)

      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }
);

// GET /api/sessions-formation/:sessionId/students/:studentId/documents
// Liste tous les documents générés pour un étudiant dans une session
router.get('/:sessionId/students/:studentId/documents',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  async (req, res) => {
    try {
      const { sessionId, studentId } = req.params;

      console.log('📄 Fetching documents for student:', studentId, 'in session:', sessionId);

      const documents = await pool.query(`
        SELECT
          c.id,
          c.certificate_number,
          c.document_type,
          c.template_name,
          c.issued_at,
          c.file_path,
          c.archive_folder,
          c.grade,
          c.printed_at,
          c.printer_name,
          c.print_status,
          ct.name as template_display_name,
          ct.preview_image_url
        FROM certificates c
        LEFT JOIN certificate_templates ct ON c.template_id = ct.id
        WHERE c.student_id = $1 AND c.session_id = $2
        ORDER BY c.issued_at DESC
      `, [studentId, sessionId]);

      console.log(`✓ Found ${documents.rows.length} document(s)`);

      // Debug: Check if there are certificates for this student but with NULL session_id
      const allCerts = await pool.query(`
        SELECT id, certificate_number, session_id
        FROM certificates
        WHERE student_id = $1
        ORDER BY issued_at DESC
      `, [studentId]);

      if (allCerts.rows.length > 0 && documents.rows.length === 0) {
        console.warn('⚠️  Student has certificates but none match session_id:', sessionId);
        console.warn('All certificates for student:', allCerts.rows.map(c => ({
          id: c.id,
          number: c.certificate_number,
          session_id: c.session_id || 'NULL'
        })));
      }

      res.json({
        success: true,
        documents: documents.rows
      });
    } catch (error) {
      console.error('Error fetching student documents:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================
// DOCUMENTS DE SESSION - RÉSUMÉ ET TÉLÉCHARGEMENT
// ============================================

const VALID_DOCUMENT_TYPES = ['certificat', 'attestation', 'badge'];

/**
 * GET /api/sessions-formation/:sessionId/documents-summary
 * Retourne un résumé des documents générés pour une session, groupés par type
 * SCOPE: Vérifie que l'utilisateur a accès à cette session
 */
router.get('/:sessionId/documents-summary',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      console.log(`📊 Fetching documents summary for session: ${sessionId}`);

      // Récupérer les infos de la session (segment inclus)
      const sessionInfo = await pool.query(`
        SELECT sf.titre, s.name as segment_name
        FROM sessions_formation sf
        LEFT JOIN segments s ON s.id = sf.segment_id
        WHERE sf.id = $1
      `, [sessionId]);

      const session = sessionInfo.rows[0] || {};

      // Récupérer le résumé des documents par type
      const summary = await pool.query(`
        SELECT
          c.document_type,
          COUNT(c.id) as count,
          MAX(c.issued_at) as latest_date,
          MIN(c.issued_at) as first_date,
          COUNT(CASE WHEN c.print_status = 'printed' THEN 1 END) as printed_count
        FROM certificates c
        WHERE c.session_id = $1
        GROUP BY c.document_type
        ORDER BY c.document_type
      `, [sessionId]);

      // Calculer le total
      const totalDocuments = summary.rows.reduce(
        (sum, doc) => sum + parseInt(doc.count), 0
      );

      console.log(`✓ Found ${totalDocuments} document(s) in ${summary.rows.length} type(s)`);

      res.json({
        success: true,
        documents: summary.rows,
        total_documents: totalDocuments,
        session_title: session.titre || '',
        segment_name: session.segment_name || ''
      });

    } catch (error) {
      console.error('Error fetching documents summary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/sessions-formation/:sessionId/documents/:documentType/download
 * Télécharge un ZIP contenant tous les PDFs d'un type de document pour une session
 * SCOPE: Vérifie que l'utilisateur a accès à cette session
 */
router.get('/:sessionId/documents/:documentType/download',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { sessionId, documentType } = req.params;

      console.log(`📥 Download request: session=${sessionId}, type=${documentType}`);

      // Validation du type de document
      if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document type',
          allowed_types: VALID_DOCUMENT_TYPES
        });
      }

      // Récupérer les informations de la session pour le nom du fichier
      const sessionResult = await pool.query(
        'SELECT titre FROM sessions_formation WHERE id = $1',
        [sessionId]
      );

      const sessionTitle = sessionResult.rows[0]?.titre || 'session';

      // Récupérer tous les certificats avec leurs chemins de fichiers
      const certs = await pool.query(`
        SELECT
          c.file_path,
          c.certificate_number,
          c.document_type,
          c.issued_at,
          s.nom,
          s.prenom
        FROM certificates c
        LEFT JOIN students s ON s.id = c.student_id
        WHERE c.session_id = $1 AND c.document_type = $2
        ORDER BY s.nom, s.prenom
      `, [sessionId, documentType]);

      if (certs.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Aucun document trouvé pour ce type'
        });
      }

      console.log(`📦 Creating ZIP with ${certs.rows.length} document(s)`);

      // Vérifier si archiver est disponible
      const archiver = (await import('archiver')).default;
      const fs = await import('fs');
      const path = await import('path');

      // Créer le ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });

      // Nettoyer le titre pour le nom de fichier
      const cleanTitle = sessionTitle.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
      const fileName = `${documentType}_${cleanTitle}_${new Date().toISOString().split('T')[0]}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      archive.pipe(res);

      // Compteur de fichiers ajoutés
      let addedCount = 0;
      let missingCount = 0;

      for (const cert of certs.rows) {
        if (cert.file_path) {
          // Construire le chemin absolu
          let filePath = cert.file_path;

          // Si c'est un chemin relatif, le rendre absolu
          if (!path.default.isAbsolute(filePath)) {
            filePath = path.default.join(process.cwd(), filePath);
          }

          // Vérifier si le fichier existe
          if (fs.default.existsSync(filePath)) {
            const studentName = [cert.nom, cert.prenom].filter(Boolean).join('_') || 'unknown';
            const pdfName = `${studentName}_${cert.certificate_number}.pdf`;

            archive.file(filePath, { name: pdfName });
            addedCount++;
          } else {
            console.warn(`⚠️ File not found: ${filePath}`);
            missingCount++;
          }
        } else {
          console.warn(`⚠️ No file_path for certificate: ${cert.certificate_number}`);
          missingCount++;
        }
      }

      console.log(`✓ ZIP created: ${addedCount} files added, ${missingCount} missing`);

      // Si aucun fichier n'a été ajouté, ajouter un fichier README
      if (addedCount === 0) {
        archive.append(
          `Aucun fichier PDF trouvé pour les ${certs.rows.length} certificat(s) de type "${documentType}".\n\nLes fichiers PDF ne sont pas disponibles sur le serveur.`,
          { name: 'README.txt' }
        );
      }

      await archive.finalize();

    } catch (error) {
      console.error('Error downloading documents:', error);

      // Si headers pas encore envoyés, envoyer erreur JSON
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }
);

/**
 * GET /api/sessions-formation/:sessionId/certificates-list
 * Retourne la liste des IDs de certificats pour un type de document donné
 * Utilisé par le frontend pour régénérer les PDFs côté client
 * SCOPE: Vérifie que l'utilisateur a accès à cette session
 */
router.get('/:sessionId/certificates-list',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  injectUserScope,
  requireRecordScope('sessions_formation', 'sessionId', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { document_type } = req.query;

      console.log(`📋 Fetching certificates list for session: ${sessionId}, type: ${document_type || 'all'}`);

      let query = `
        SELECT
          c.id,
          c.certificate_number,
          c.document_type,
          c.issued_at,
          s.nom as student_last_name,
          s.prenom as student_first_name
        FROM certificates c
        LEFT JOIN students s ON s.id = c.student_id
        WHERE c.session_id = $1
      `;
      const params = [sessionId];

      if (document_type) {
        query += ` AND c.document_type = $2`;
        params.push(document_type);
      }

      query += ` ORDER BY s.nom, s.prenom`;

      const result = await pool.query(query, params);

      console.log(`✓ Found ${result.rows.length} certificate(s)`);

      res.json({
        success: true,
        certificates: result.rows
      });

    } catch (error) {
      console.error('Error fetching certificates list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
