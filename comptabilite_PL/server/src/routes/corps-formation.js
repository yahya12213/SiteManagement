import express from 'express';
import pool from '../config/database.js';
import { nanoid } from 'nanoid';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/corps-formation
 * Liste tous les corps de formation triés par order_index
 * Protected: Requires training.corps.view_page permission
 */
router.get('/',
  authenticateToken,
  requirePermission('training.corps.view_page'),
  async (req, res) => {
  try {
    const query = `
      SELECT
        cf.*,
        s.name as segment_name,
        s.color as segment_color,
        COUNT(f.id)::integer as formations_count
      FROM corps_formation cf
      LEFT JOIN segments s ON cf.segment_id = s.id
      LEFT JOIN formations f ON f.corps_formation_id = cf.id
      GROUP BY cf.id, s.name, s.color
      ORDER BY cf.order_index ASC, cf.name ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      corps: result.rows
    });
  } catch (error) {
    console.error('Erreur récupération corps de formation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * GET /api/corps-formation/:id
 * Récupère un corps de formation par ID avec ses formations
 * Protected: Requires training.corps.view_page permission
 */
router.get('/:id',
  authenticateToken,
  requirePermission('training.corps.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le corps avec segment
    const corpsResult = await pool.query(
      `SELECT
        cf.*,
        s.name as segment_name,
        s.color as segment_color
      FROM corps_formation cf
      LEFT JOIN segments s ON cf.segment_id = s.id
      WHERE cf.id = $1`,
      [id]
    );

    if (corpsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Corps de formation non trouvé'
      });
    }

    // Récupérer les formations associées
    const formationsResult = await pool.query(
      `SELECT
        id, title, description, price, level, status, is_pack, created_at
      FROM formations
      WHERE corps_formation_id = $1
      ORDER BY is_pack DESC, title ASC`,
      [id]
    );

    res.json({
      success: true,
      corps: {
        ...corpsResult.rows[0],
        formations: formationsResult.rows
      }
    });
  } catch (error) {
    console.error('Erreur récupération corps:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * POST /api/corps-formation
 * Créer un nouveau corps de formation
 * Protected: Requires training.corps.create permission
 */
router.post('/',
  authenticateToken,
  requirePermission('training.corps.create'),
  async (req, res) => {
  try {
    const { name, description, color, icon, order_index, segment_id } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Le nom du corps de formation est obligatoire'
      });
    }

    // Vérifier unicité du nom
    const existingCheck = await pool.query(
      'SELECT id FROM corps_formation WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un corps de formation avec ce nom existe déjà'
      });
    }

    // Créer le corps
    const id = nanoid();
    const query = `
      INSERT INTO corps_formation (
        id, name, description, color, icon, order_index, segment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      id,
      name.trim(),
      description || null,
      color || '#3B82F6',
      icon || null,
      order_index !== undefined ? order_index : 0,
      segment_id || null
    ]);

    res.status(201).json({
      success: true,
      corps: result.rows[0],
      message: 'Corps de formation créé avec succès'
    });
  } catch (error) {
    console.error('Erreur création corps:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * PUT /api/corps-formation/:id
 * Modifier un corps de formation
 * Protected: Requires training.corps.update permission
 */
router.put('/:id',
  authenticateToken,
  requirePermission('training.corps.update'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, order_index, segment_id } = req.body;

    // Vérifier que le corps existe
    const existingCorps = await pool.query(
      'SELECT id FROM corps_formation WHERE id = $1',
      [id]
    );

    if (existingCorps.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Corps de formation non trouvé'
      });
    }

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Le nom du corps de formation est obligatoire'
      });
    }

    // Vérifier unicité du nom (sauf pour ce corps)
    const duplicateCheck = await pool.query(
      'SELECT id FROM corps_formation WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un autre corps de formation avec ce nom existe déjà'
      });
    }

    // Mise à jour
    const query = `
      UPDATE corps_formation
      SET
        name = $1,
        description = $2,
        color = $3,
        icon = $4,
        order_index = $5,
        segment_id = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await pool.query(query, [
      name.trim(),
      description || null,
      color || '#3B82F6',
      icon || null,
      order_index !== undefined ? order_index : 0,
      segment_id || null,
      id
    ]);

    res.json({
      success: true,
      corps: result.rows[0],
      message: 'Corps de formation modifié avec succès'
    });
  } catch (error) {
    console.error('Erreur modification corps:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * DELETE /api/corps-formation/:id
 * Supprimer un corps de formation
 * Empêche la suppression si des formations sont liées
 * Protected: Requires training.corps.delete permission
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('training.corps.delete'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Paramètre pour forcer la suppression

    // Vérifier que le corps existe
    const existingCorps = await pool.query(
      'SELECT * FROM corps_formation WHERE id = $1',
      [id]
    );

    if (existingCorps.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Corps de formation non trouvé'
      });
    }

    // Vérifier s'il y a des formations liées
    const formationsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM formations WHERE corps_formation_id = $1',
      [id]
    );

    const formationsCount = parseInt(formationsCheck.rows[0].count);

    // Si force=true, détacher les formations automatiquement
    if (force === 'true' && formationsCount > 0) {
      console.log(`Force delete requested for corps ${id} with ${formationsCount} formations`);

      // Vérifier si les formations ont des sessions actives
      const sessionsCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM session_formations sf
        INNER JOIN formations f ON sf.formation_id = f.id
        WHERE f.corps_formation_id = $1
      `, [id]);

      const hasActiveSessions = parseInt(sessionsCheck.rows[0].count) > 0;

      if (hasActiveSessions) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de supprimer: certaines formations ont des sessions actives',
          formations_count: formationsCount,
          has_active_sessions: true
        });
      }

      // Détacher les formations (met corps_formation_id à NULL)
      await pool.query(
        'UPDATE formations SET corps_formation_id = NULL WHERE corps_formation_id = $1',
        [id]
      );

      console.log(`${formationsCount} formation(s) détachée(s) du corps ${id}`);

      // Maintenant on peut supprimer le corps
      await pool.query('DELETE FROM corps_formation WHERE id = $1', [id]);

      return res.json({
        success: true,
        message: `Corps de formation supprimé avec succès (${formationsCount} formation(s) détachée(s))`,
        formations_detached: formationsCount
      });
    }

    // Si pas de force=true et qu'il y a des formations, retourner une erreur
    if (formationsCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Impossible de supprimer ce corps de formation car il contient ${formationsCount} formation(s)`,
        formations_count: formationsCount,
        hint: 'Ajoutez ?force=true pour détacher les formations et supprimer le corps'
      });
    }

    // Suppression normale (pas de formations)
    await pool.query('DELETE FROM corps_formation WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Corps de formation supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression corps:', error);

    // Gestion erreur contrainte FK
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        error: 'Impossible de supprimer ce corps car des formations y sont liées'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * GET /api/corps-formation/:id/debug
 * Endpoint de diagnostic pour identifier les problèmes de données
 * TEMPORAIRE - Pour déboguer les formations orphelines
 */
router.get('/:id/debug',
  authenticateToken,
  requirePermission('training.corps.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le corps
    const corpsResult = await pool.query(
      'SELECT * FROM corps_formation WHERE id = $1',
      [id]
    );

    // Compter les formations
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM formations WHERE corps_formation_id = $1',
      [id]
    );

    // Récupérer les formations réelles
    const formationsResult = await pool.query(
      `SELECT id, title, corps_formation_id, is_pack, status, created_at
       FROM formations
       WHERE corps_formation_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    // Vérifier les collisions d'ID de corps
    const duplicateIdsResult = await pool.query(
      'SELECT id, COUNT(*) as count FROM corps_formation GROUP BY id HAVING COUNT(*) > 1'
    );

    // Vérifier si des formations référencent un corps inexistant
    const orphanedFormationsResult = await pool.query(
      `SELECT f.id, f.title, f.corps_formation_id
       FROM formations f
       LEFT JOIN corps_formation cf ON f.corps_formation_id = cf.id
       WHERE f.corps_formation_id IS NOT NULL
       AND cf.id IS NULL`
    );

    res.json({
      success: true,
      debug: {
        corps_exists: corpsResult.rows.length > 0,
        corps: corpsResult.rows[0] || null,
        formations_count: parseInt(countResult.rows[0].count),
        formations: formationsResult.rows,
        duplicate_corps_ids: duplicateIdsResult.rows,
        orphaned_formations: orphanedFormationsResult.rows,
        diagnosis: {
          has_data_inconsistency: corpsResult.rows.length === 0 && parseInt(countResult.rows[0].count) > 0,
          has_id_collision: duplicateIdsResult.rows.length > 0,
          has_orphaned_formations: orphanedFormationsResult.rows.length > 0
        }
      }
    });
  } catch (error) {
    console.error('Erreur endpoint debug:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * GET /api/corps-formation/:id/formations
 * Récupère toutes les formations unitaires (non-packs) d'un corps
 * Utilisé pour la création de packs
 * Protected: Requires training.corps.view_page permission
 */
router.get('/:id/formations',
  authenticateToken,
  requirePermission('training.corps.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        id, title, description, price, duration_hours, level, status
      FROM formations
      WHERE corps_formation_id = $1
      AND is_pack = FALSE
      AND status = 'published'
      ORDER BY title ASC
    `;

    const result = await pool.query(query, [id]);

    res.json({
      success: true,
      formations: result.rows
    });
  } catch (error) {
    console.error('Erreur récupération formations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * GET /api/corps-formation/stats/global
 * Statistiques globales des corps de formation
 * Protected: Requires training.corps.view_page permission
 */
router.get('/stats/global',
  authenticateToken,
  requirePermission('training.corps.view_page'),
  async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(DISTINCT cf.id)::integer as total_corps,
        COUNT(DISTINCT f.id)::integer as total_formations,
        COUNT(DISTINCT CASE WHEN f.is_pack = TRUE THEN f.id END)::integer as total_packs,
        COUNT(DISTINCT CASE WHEN f.is_pack = FALSE THEN f.id END)::integer as total_formations_unitaires
      FROM corps_formation cf
      LEFT JOIN formations f ON f.corps_formation_id = cf.id
    `;

    const result = await pool.query(statsQuery);

    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

/**
 * POST /api/corps-formation/:id/duplicate
 * Dupliquer un corps de formation (avec option d'inclure les formations)
 * Protected: Requires training.corps.create permission
 */
router.post('/:id/duplicate',
  authenticateToken,
  requirePermission('training.corps.create'),
  async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { include_formations = false } = req.body;

    await client.query('BEGIN');

    // Récupérer le corps original
    const corpsResult = await client.query(
      'SELECT * FROM corps_formation WHERE id = $1',
      [id]
    );

    if (corpsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Corps de formation non trouvé'
      });
    }

    const originalCorps = corpsResult.rows[0];

    // Créer le nouveau corps avec (Copie)
    // Vérifier la collision d'ID et régénérer si nécessaire
    let newCorpsId = nanoid();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existingIdCheck = await client.query(
        'SELECT id FROM corps_formation WHERE id = $1',
        [newCorpsId]
      );

      if (existingIdCheck.rows.length === 0) {
        // ID unique trouvé
        break;
      }

      // Collision détectée, régénérer
      console.warn(`Collision d'ID détectée: ${newCorpsId}, régénération...`);
      newCorpsId = nanoid();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        error: 'Impossible de générer un ID unique après plusieurs tentatives'
      });
    }

    // Générer un nom unique pour la copie
    // Si "(Copie)" existe déjà, essayer "(Copie 2)", "(Copie 3)", etc.
    let newCorpsName = `${originalCorps.name} (Copie)`;
    let nameAttempts = 0;
    const maxNameAttempts = 10;

    while (nameAttempts < maxNameAttempts) {
      const nameCheck = await client.query(
        'SELECT id FROM corps_formation WHERE name = $1',
        [newCorpsName]
      );

      if (nameCheck.rows.length === 0) {
        // Nom unique trouvé
        break;
      }

      // Nom existe déjà, essayer avec un numéro
      nameAttempts++;
      newCorpsName = `${originalCorps.name} (Copie ${nameAttempts + 1})`;
      console.log(`Nom en collision détecté, essai avec: ${newCorpsName}`);
    }

    if (nameAttempts >= maxNameAttempts) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        error: 'Impossible de générer un nom unique après plusieurs tentatives'
      });
    }

    const insertCorpsQuery = `
      INSERT INTO corps_formation (
        id, name, description, color, icon, order_index, segment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const newCorpsResult = await client.query(insertCorpsQuery, [
      newCorpsId,
      newCorpsName,
      originalCorps.description,
      originalCorps.color,
      originalCorps.icon,
      originalCorps.order_index,
      originalCorps.segment_id
    ]);

    const newCorps = newCorpsResult.rows[0];
    const duplicatedFormations = [];
    const duplicatedPacks = [];

    // Dupliquer les formations si demandé
    if (include_formations) {
      // Map pour associer ancien ID -> nouveau ID (pour les packs)
      const formationIdMapping = new Map();

      // ÉTAPE 1: Dupliquer les formations unitaires (non-packs)
      const formationsResult = await client.query(
        `SELECT * FROM formations
         WHERE corps_formation_id = $1
         AND is_pack = FALSE
         ORDER BY title ASC`,
        [id]
      );

      for (const formation of formationsResult.rows) {
        const newFormationId = nanoid();
        const newFormationTitle = `${formation.title} (Copie)`;

        // Stocker le mapping ancien ID -> nouveau ID
        formationIdMapping.set(formation.id, newFormationId);

        const insertFormationQuery = `
          INSERT INTO formations (
            id, title, description, price, duration_hours, level,
            status, corps_formation_id, certificate_template_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          RETURNING id, title, description, price, level, status
        `;

        const newFormationResult = await client.query(insertFormationQuery, [
          newFormationId,
          newFormationTitle,
          formation.description,
          formation.price,
          formation.duration_hours,
          formation.level,
          'draft', // Toujours en brouillon pour la copie
          newCorpsId,
          formation.certificate_template_id
        ]);

        // Dupliquer les templates associés à cette formation
        const templatesResult = await client.query(
          `SELECT template_id, document_type, is_default
           FROM formation_templates
           WHERE formation_id = $1`,
          [formation.id]
        );

        for (const template of templatesResult.rows) {
          await client.query(
            `INSERT INTO formation_templates (id, formation_id, template_id, document_type, is_default)
             VALUES ($1, $2, $3, $4, $5)`,
            [nanoid(), newFormationId, template.template_id, template.document_type, template.is_default]
          );
        }

        const formationData = {
          ...newFormationResult.rows[0],
          templates_count: templatesResult.rows.length
        };
        duplicatedFormations.push(formationData);
      }

      // ÉTAPE 2: Dupliquer les packs
      const packsResult = await client.query(
        `SELECT * FROM formations
         WHERE corps_formation_id = $1
         AND is_pack = TRUE
         ORDER BY title ASC`,
        [id]
      );

      for (const pack of packsResult.rows) {
        const newPackId = nanoid();
        const newPackTitle = `${pack.title} (Copie)`;

        // Stocker le mapping pour ce pack aussi
        formationIdMapping.set(pack.id, newPackId);

        const insertPackQuery = `
          INSERT INTO formations (
            id, title, description, price, duration_hours, level,
            status, corps_formation_id, certificate_template_id, is_pack, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, CURRENT_TIMESTAMP)
          RETURNING id, title, description, price, level, status, is_pack
        `;

        const newPackResult = await client.query(insertPackQuery, [
          newPackId,
          newPackTitle,
          pack.description,
          pack.price,
          pack.duration_hours,
          pack.level,
          'draft',
          newCorpsId,
          pack.certificate_template_id
        ]);

        // Dupliquer les formation_pack_items (compositions du pack)
        const packItemsResult = await client.query(
          `SELECT formation_id, order_index
           FROM formation_pack_items
           WHERE pack_id = $1
           ORDER BY order_index ASC`,
          [pack.id]
        );

        let packItemsCount = 0;
        for (const item of packItemsResult.rows) {
          // Vérifier si la formation membre a été dupliquée
          const newMemberFormationId = formationIdMapping.get(item.formation_id);

          if (newMemberFormationId) {
            await client.query(
              `INSERT INTO formation_pack_items (id, pack_id, formation_id, order_index)
               VALUES ($1, $2, $3, $4)`,
              [nanoid(), newPackId, newMemberFormationId, item.order_index]
            );
            packItemsCount++;
          }
        }

        // Dupliquer les templates associés au pack
        const packTemplatesResult = await client.query(
          `SELECT template_id, document_type, is_default
           FROM formation_templates
           WHERE formation_id = $1`,
          [pack.id]
        );

        for (const template of packTemplatesResult.rows) {
          await client.query(
            `INSERT INTO formation_templates (id, formation_id, template_id, document_type, is_default)
             VALUES ($1, $2, $3, $4, $5)`,
            [nanoid(), newPackId, template.template_id, template.document_type, template.is_default]
          );
        }

        const packData = {
          ...newPackResult.rows[0],
          templates_count: packTemplatesResult.rows.length,
          pack_items_count: packItemsCount
        };
        duplicatedPacks.push(packData);
      }
    }

    await client.query('COMMIT');

    const totalDuplicated = duplicatedFormations.length + duplicatedPacks.length;
    res.status(201).json({
      success: true,
      corps: newCorps,
      duplicated_formations: duplicatedFormations,
      duplicated_packs: duplicatedPacks,
      message: `Corps de formation dupliqué avec succès${include_formations ? ` (${duplicatedFormations.length} formation(s) + ${duplicatedPacks.length} pack(s) copiés)` : ''}`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur duplication corps:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/corps-formation/:id/fix-orphaned-formations
 * Nettoyer les formations orphelines qui référencent ce corps
 * Options:
 * - set_to_null: Met corps_formation_id à NULL
 * - move_to_default: Déplace vers un corps par défaut (si fourni)
 * - delete: Supprime les formations orphelines
 */
router.post('/:id/fix-orphaned-formations',
  authenticateToken,
  requirePermission('training.corps.update'),
  async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { action = 'set_to_null', default_corps_id = null } = req.body;

    await client.query('BEGIN');

    // Vérifier que le corps existe (ou pas, c'est justement le problème)
    const corpsResult = await client.query(
      'SELECT * FROM corps_formation WHERE id = $1',
      [id]
    );

    // Récupérer les formations qui référencent ce corps
    const formationsResult = await client.query(
      'SELECT id, title, corps_formation_id FROM formations WHERE corps_formation_id = $1',
      [id]
    );

    const formationsCount = formationsResult.rows.length;

    if (formationsCount === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Aucune formation à corriger',
        fixed_count: 0
      });
    }

    let result;
    let message;

    switch (action) {
      case 'set_to_null':
        // Mettre corps_formation_id à NULL
        result = await client.query(
          'UPDATE formations SET corps_formation_id = NULL WHERE corps_formation_id = $1',
          [id]
        );
        message = `${formationsCount} formation(s) détachée(s) du corps (corps_formation_id = NULL)`;
        break;

      case 'move_to_default':
        if (!default_corps_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'default_corps_id requis pour action move_to_default'
          });
        }

        // Vérifier que le corps de destination existe
        const targetCorpsResult = await client.query(
          'SELECT id FROM corps_formation WHERE id = $1',
          [default_corps_id]
        );

        if (targetCorpsResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: 'Corps de formation de destination non trouvé'
          });
        }

        // Déplacer les formations vers le nouveau corps
        result = await client.query(
          'UPDATE formations SET corps_formation_id = $1 WHERE corps_formation_id = $2',
          [default_corps_id, id]
        );
        message = `${formationsCount} formation(s) déplacée(s) vers le corps ${default_corps_id}`;
        break;

      case 'delete':
        // Supprimer les formations orphelines
        result = await client.query(
          'DELETE FROM formations WHERE corps_formation_id = $1',
          [id]
        );
        message = `${formationsCount} formation(s) supprimée(s)`;
        break;

      default:
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Action invalide. Actions valides: set_to_null, move_to_default, delete'
        });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message,
      fixed_count: formationsCount,
      formations_affected: formationsResult.rows.map(f => ({ id: f.id, title: f.title }))
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur nettoyage formations orphelines:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/corps-formation/cleanup-all-orphans
 * Nettoie automatiquement TOUS les corps dupliqués problématiques
 *
 * Processus:
 * 1. Trouve tous les corps avec "(Copie)" dans le nom
 * 2. Pour chaque corps, vérifie s'il a des formations
 * 3. Si oui, détache les formations (set corps_formation_id à NULL)
 * 4. Tente de supprimer le corps vidé
 * 5. Retourne un rapport détaillé de toutes les actions
 */
router.post('/cleanup-all-orphans',
  authenticateToken,
  requirePermission('training.corps.delete'),
  async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Début du nettoyage automatique des corps dupliqués ===');

    // 1. Trouver tous les corps avec "(Copie)" dans le nom
    const duplicateCorpsResult = await client.query(`
      SELECT id, name, created_at
      FROM corps_formation
      WHERE name LIKE '%(Copie%'
      ORDER BY created_at DESC
    `);

    const duplicateCorps = duplicateCorpsResult.rows;
    console.log(`Trouvé ${duplicateCorps.length} corps avec "(Copie)" dans le nom`);

    if (duplicateCorps.length === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Aucun corps dupliqué à nettoyer',
        report: {
          total_duplicates_found: 0,
          corps_cleaned: [],
          corps_deleted: [],
          errors: []
        }
      });
    }

    const report = {
      total_duplicates_found: duplicateCorps.length,
      corps_cleaned: [],
      corps_deleted: [],
      errors: []
    };

    // 2. Pour chaque corps dupliqué
    for (const corps of duplicateCorps) {
      try {
        console.log(`\nTraitement du corps: ${corps.name} (ID: ${corps.id})`);

        // Compter les formations liées
        const formationsCountResult = await client.query(
          'SELECT COUNT(*) as count FROM formations WHERE corps_formation_id = $1',
          [corps.id]
        );

        const formationsCount = parseInt(formationsCountResult.rows[0].count);
        console.log(`  → ${formationsCount} formation(s) trouvée(s)`);

        if (formationsCount > 0) {
          // Récupérer les détails des formations pour le rapport
          const formationsResult = await client.query(
            'SELECT id, title FROM formations WHERE corps_formation_id = $1',
            [corps.id]
          );

          // Détacher les formations (set corps_formation_id à NULL)
          await client.query(
            'UPDATE formations SET corps_formation_id = NULL WHERE corps_formation_id = $1',
            [corps.id]
          );

          console.log(`  ✓ ${formationsCount} formation(s) détachée(s)`);

          report.corps_cleaned.push({
            corps_id: corps.id,
            corps_name: corps.name,
            formations_detached: formationsCount,
            formations: formationsResult.rows.map(f => ({
              id: f.id,
              title: f.title
            }))
          });
        }

        // 3. Tenter de supprimer le corps (maintenant vide)
        const deleteResult = await client.query(
          'DELETE FROM corps_formation WHERE id = $1',
          [corps.id]
        );

        if (deleteResult.rowCount > 0) {
          console.log(`  ✓ Corps supprimé: ${corps.name}`);
          report.corps_deleted.push({
            corps_id: corps.id,
            corps_name: corps.name,
            formations_detached: formationsCount
          });
        } else {
          console.log(`  ⚠ Impossible de supprimer le corps: ${corps.name}`);
          report.errors.push({
            corps_id: corps.id,
            corps_name: corps.name,
            error: 'Suppression impossible (corps introuvable ou contrainte)'
          });
        }

      } catch (error) {
        console.error(`  ✗ Erreur lors du traitement de ${corps.name}:`, error.message);
        report.errors.push({
          corps_id: corps.id,
          corps_name: corps.name,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Nettoyage terminé ===');
    console.log(`Corps nettoyés: ${report.corps_cleaned.length}`);
    console.log(`Corps supprimés: ${report.corps_deleted.length}`);
    console.log(`Erreurs: ${report.errors.length}`);

    res.json({
      success: true,
      message: `Nettoyage terminé: ${report.corps_deleted.length} corps supprimés, ${report.corps_cleaned.length} nettoyés`,
      report
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors du nettoyage automatique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du nettoyage',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
