import express from 'express';
import pg from 'pg';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const { Pool } = pg;
const router = express.Router();

// Get pool connection
const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/hr/public-holidays - Get all public holidays
router.get('/', authenticateToken, requirePermission('hr.holidays.view_page'), async (req, res) => {
  const pool = getPool();

  try {
    const { year } = req.query;

    let query = `
      SELECT
        id,
        holiday_date,
        name,
        description,
        is_recurring,
        created_at
      FROM hr_public_holidays
    `;

    const params = [];

    // Filter by year if provided
    if (year) {
      query += ` WHERE EXTRACT(YEAR FROM holiday_date) = $1`;
      params.push(parseInt(year));
    }

    query += ` ORDER BY holiday_date ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      holidays: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching public holidays:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des jours fériés',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * POST /api/hr/public-holidays/bulk - Bulk create holidays
 * IMPORTANT: Must be defined BEFORE /:id route to avoid route conflicts
 * Protected: Requires hr.holidays.manage permission
 */
router.post('/bulk',
  authenticateToken,
  requirePermission('hr.holidays.manage'),
  async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Un tableau de jours fériés est requis'
      });
    }

    await client.query('BEGIN');

    const created = [];
    const skipped = [];

    for (const holiday of holidays) {
      const { holiday_date, name, description, is_recurring } = holiday;

      if (!holiday_date || !name) {
        skipped.push({ ...holiday, reason: 'Date ou nom manquant' });
        continue;
      }

      // Check if exists
      const existing = await client.query(`
        SELECT id FROM hr_public_holidays WHERE holiday_date = $1
      `, [holiday_date]);

      if (existing.rows.length > 0) {
        skipped.push({ ...holiday, reason: 'Déjà existant' });
        continue;
      }

      // Insert
      const result = await client.query(`
        INSERT INTO hr_public_holidays (
          holiday_date, name, description, is_recurring, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `, [holiday_date, name, description || null, is_recurring || false]);

      created.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${created.length} jours fériés créés, ${skipped.length} ignorés`,
      created,
      skipped
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk creating holidays:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création en masse',
      details: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

/**
 * POST /api/hr/public-holidays - Create a public holiday
 * Protected: Requires hr.holidays.manage permission
 */
router.post('/',
  authenticateToken,
  requirePermission('hr.holidays.manage'),
  async (req, res) => {
  const pool = getPool();

  try {
    const { holiday_date, name, description, is_recurring } = req.body;

    // Validation
    if (!holiday_date || !name) {
      return res.status(400).json({
        success: false,
        error: 'La date et le nom du jour férié sont requis'
      });
    }

    // Check if holiday already exists for this date
    const existing = await pool.query(`
      SELECT id FROM hr_public_holidays
      WHERE holiday_date = $1
    `, [holiday_date]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Un jour férié existe déjà pour cette date'
      });
    }

    // Insert holiday
    const result = await pool.query(`
      INSERT INTO hr_public_holidays (
        holiday_date,
        name,
        description,
        is_recurring,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [holiday_date, name, description || null, is_recurring || false]);

    // MISE À JOUR AUTOMATIQUE: Mettre à jour les pointages de récupération pour cette date
    // Si un pointage existe pour cette date et est un jour de récupération (recovery_unpaid),
    // le changer en recovery_paid car c'est maintenant aussi un jour férié
    const updateRecoveryResult = await pool.query(`
      UPDATE hr_attendance_daily ad
      SET day_status = 'recovery_paid',
          notes = COALESCE(notes, '') || ' (Jour férié: ' || $2 || ')',
          updated_at = NOW()
      WHERE ad.work_date = $1
        AND ad.day_status IN ('recovery_unpaid', 'recovery_day')
      RETURNING ad.id, ad.employee_id
    `, [holiday_date, name]);

    const updatedCount = updateRecoveryResult.rows.length;
    console.log(`Jour férié ${name} ajouté: ${updatedCount} pointages de récupération mis à jour vers recovery_paid`);

    res.json({
      success: true,
      message: updatedCount > 0
        ? `Jour férié ajouté avec succès. ${updatedCount} pointage(s) de récupération mis à jour.`
        : 'Jour férié ajouté avec succès',
      holiday: result.rows[0],
      updated_attendance_records: updatedCount
    });

  } catch (error) {
    console.error('Error creating public holiday:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du jour férié',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * PUT /api/hr/public-holidays/:id - Update a public holiday
 * Protected: Requires hr.holidays.manage permission
 */
router.put('/:id',
  authenticateToken,
  requirePermission('hr.holidays.manage'),
  async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { holiday_date, name, description, is_recurring } = req.body;

    // Check if holiday exists
    const existing = await pool.query(`
      SELECT id FROM hr_public_holidays WHERE id = $1
    `, [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Jour férié non trouvé'
      });
    }

    // Update holiday
    const result = await pool.query(`
      UPDATE hr_public_holidays
      SET
        holiday_date = COALESCE($1, holiday_date),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_recurring = COALESCE($4, is_recurring),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [holiday_date, name, description, is_recurring, id]);

    res.json({
      success: true,
      message: 'Jour férié mis à jour avec succès',
      holiday: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating public holiday:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du jour férié',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * DELETE /api/hr/public-holidays/:id - Delete a public holiday
 * Protected: Requires hr.holidays.manage permission
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('hr.holidays.manage'),
  async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;

    // Check if holiday exists and get its date
    const existing = await pool.query(`
      SELECT id, holiday_date, name FROM hr_public_holidays WHERE id = $1
    `, [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Jour férié non trouvé'
      });
    }

    const holidayDate = existing.rows[0].holiday_date;
    const holidayName = existing.rows[0].name;

    // Delete holiday
    await pool.query(`
      DELETE FROM hr_public_holidays WHERE id = $1
    `, [id]);

    // MISE À JOUR AUTOMATIQUE: Rétablir les pointages de récupération
    // Si un pointage était recovery_paid (car jour férié), le remettre à recovery_unpaid
    const updateRecoveryResult = await pool.query(`
      UPDATE hr_attendance_daily ad
      SET day_status = 'recovery_unpaid',
          notes = REPLACE(COALESCE(notes, ''), ' (Jour férié: ' || $2 || ')', ''),
          updated_at = NOW()
      WHERE ad.work_date = $1
        AND ad.day_status = 'recovery_paid'
      RETURNING ad.id, ad.employee_id
    `, [holidayDate, holidayName]);

    const updatedCount = updateRecoveryResult.rows.length;
    console.log(`Jour férié ${holidayName} supprimé: ${updatedCount} pointages mis à jour vers recovery_unpaid`);

    res.json({
      success: true,
      message: updatedCount > 0
        ? `Jour férié supprimé. ${updatedCount} pointage(s) de récupération rétabli(s).`
        : 'Jour férié supprimé avec succès',
      updated_attendance_records: updatedCount
    });

  } catch (error) {
    console.error('Error deleting public holiday:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du jour férié',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
