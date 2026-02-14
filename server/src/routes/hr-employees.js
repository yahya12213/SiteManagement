import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { uploadEmployeeDocument, getEmployeeDocumentsDir, deleteFile, uploadEmployeePhoto, getEmployeePhotosDir } from '../middleware/upload.js';
import path from 'path';
import { getCurrentLeaveBalance } from '../services/leaveBalanceService.js';

const router = express.Router();

/**
 * Get all employees with filters
 * Protected: Requires hr.employees.view_page permission
 */
router.get('/',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
  const { search, status, department, segment_id } = req.query;

  try {
    let query = `
      SELECT
        e.*,
        p.username as profile_username,
        s.name as segment_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM hr_employees e
      LEFT JOIN profiles p ON e.profile_id = p.id
      LEFT JOIN segments s ON e.segment_id = s.id
      LEFT JOIN hr_employees m ON e.manager_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (
        e.first_name ILIKE $${paramCount} OR
        e.last_name ILIKE $${paramCount} OR
        e.employee_number ILIKE $${paramCount} OR
        e.cin ILIKE $${paramCount} OR
        e.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status) {
      query += ` AND e.employment_status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (department) {
      query += ` AND e.department = $${paramCount}`;
      params.push(department);
      paramCount++;
    }

    if (segment_id) {
      query += ` AND e.segment_id = $${paramCount}`;
      params.push(segment_id);
      paramCount++;
    }

    query += ' ORDER BY e.last_name, e.first_name';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PRIMES EMPLOYÉ - Ces routes doivent être AVANT /:id
// =====================================================

/**
 * Get all prime types (référentiel)
 * GET /api/hr/employees/prime-types
 */
router.get('/prime-types',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM hr_prime_types
        WHERE is_active = true
        ORDER BY category DESC, display_order
      `);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching prime types:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// =====================================================
// ROUTES GLOBALES DOCUMENTS/CONTRATS/DISCIPLINAIRE
// Ces routes doivent être AVANT /:id
// =====================================================

/**
 * Get all contracts across all employees
 * GET /api/hr/employees/all-contracts
 */
router.get('/all-contracts',
  authenticateToken,
  requirePermission('hr.contracts.manage'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          c.*,
          e.first_name, e.last_name, e.employee_number
        FROM hr_contracts c
        JOIN hr_employees e ON e.id = c.employee_id
        ORDER BY c.start_date DESC
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching all contracts:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get all documents across all employees
 * GET /api/hr/employees/all-documents
 */
router.get('/all-documents',
  authenticateToken,
  requirePermission('hr.documents.manage'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          d.*,
          e.first_name, e.last_name, e.employee_number
        FROM hr_employee_documents d
        JOIN hr_employees e ON e.id = d.employee_id
        ORDER BY d.uploaded_at DESC
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching all documents:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get all disciplinary actions across all employees
 * GET /api/hr/employees/all-disciplinary
 */
router.get('/all-disciplinary',
  authenticateToken,
  requirePermission('hr.discipline.manage'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          da.*,
          e.first_name, e.last_name, e.employee_number
        FROM hr_disciplinary_actions da
        JOIN hr_employees e ON e.id = da.employee_id
        ORDER BY da.issue_date DESC
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching all disciplinary actions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Upload employee photo
 * POST /api/hr/employees/:id/photo
 */
router.post('/:id/photo',
  authenticateToken,
  requirePermission('hr.employees.update'),
  (req, res, next) => {
    uploadEmployeePhoto(req, res, (err) => {
      if (err) {
        console.error('Photo upload error:', err);
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Aucune photo fournie' });
      }

      // Get old photo URL and profile_id to delete it later and sync with profiles
      const oldPhotoResult = await pool.query(
        'SELECT photo_url, profile_id FROM hr_employees WHERE id = $1',
        [id]
      );

      const photo_url = `/uploads/employee-photos/${req.file.filename}`;

      // Update employee with new photo URL
      const result = await pool.query(`
        UPDATE hr_employees
        SET photo_url = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, photo_url, profile_id
      `, [photo_url, id]);

      if (result.rows.length === 0) {
        // Delete uploaded file since employee not found
        const filePath = path.join(getEmployeePhotosDir(), req.file.filename);
        deleteFile(filePath);
        return res.status(404).json({ success: false, error: 'Employé non trouvé' });
      }

      // Synchroniser avec profiles si l'employé a un profile_id
      const employee = result.rows[0];
      if (employee.profile_id) {
        await pool.query(
          'UPDATE profiles SET profile_image_url = $1 WHERE id = $2',
          [photo_url, employee.profile_id]
        );
      }

      // Delete old photo if exists
      if (oldPhotoResult.rows.length > 0 && oldPhotoResult.rows[0].photo_url) {
        const oldFilePath = path.join(getEmployeePhotosDir(), path.basename(oldPhotoResult.rows[0].photo_url));
        deleteFile(oldFilePath);
      }

      res.json({ success: true, data: { id: employee.id, photo_url: employee.photo_url } });
    } catch (error) {
      console.error('Error uploading employee photo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Delete employee photo
 * DELETE /api/hr/employees/:id/photo
 */
router.delete('/:id/photo',
  authenticateToken,
  requirePermission('hr.employees.update'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get current photo URL and profile_id
      const photoResult = await pool.query(
        'SELECT photo_url, profile_id FROM hr_employees WHERE id = $1',
        [id]
      );

      if (photoResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employé non trouvé' });
      }

      const { photo_url, profile_id } = photoResult.rows[0];

      // Update employee to remove photo URL
      await pool.query(`
        UPDATE hr_employees
        SET photo_url = NULL, updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // Synchroniser avec profiles si l'employé a un profile_id
      if (profile_id) {
        await pool.query(
          'UPDATE profiles SET profile_image_url = NULL WHERE id = $1',
          [profile_id]
        );
      }

      // Delete physical file if exists
      if (photo_url) {
        const filePath = path.join(getEmployeePhotosDir(), path.basename(photo_url));
        deleteFile(filePath);
      }

      res.json({ success: true, message: 'Photo supprimée' });
    } catch (error) {
      console.error('Error deleting employee photo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get employee leave balance
 * GET /api/hr/employees/:id/leave-balance
 */
router.get('/:id/leave-balance',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Vérifier que l'employé existe
      const empCheck = await pool.query('SELECT id, first_name, last_name FROM hr_employees WHERE id = $1', [id]);
      if (empCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employé non trouvé' });
      }

      const balance = await getCurrentLeaveBalance(id);

      res.json({
        success: true,
        data: {
          employee: empCheck.rows[0],
          balance
        }
      });
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get single employee with all details
 * Protected: Requires hr.employees.view_page permission
 */
router.get('/:id',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee
    const employee = await pool.query(`
      SELECT
        e.*,
        p.username as profile_username,
        s.name as segment_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM hr_employees e
      LEFT JOIN profiles p ON e.profile_id = p.id
      LEFT JOIN segments s ON e.segment_id = s.id
      LEFT JOIN hr_employees m ON e.manager_id = m.id
      WHERE e.id = $1
    `, [id]);

    if (employee.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Get contracts
    const contracts = await pool.query(`
      SELECT * FROM hr_contracts
      WHERE employee_id = $1
      ORDER BY start_date DESC
    `, [id]);

    // Get documents
    const documents = await pool.query(`
      SELECT * FROM hr_employee_documents
      WHERE employee_id = $1
      ORDER BY uploaded_at DESC
    `, [id]);

    // Get disciplinary actions
    const disciplinary = await pool.query(`
      SELECT * FROM hr_disciplinary_actions
      WHERE employee_id = $1
      ORDER BY issue_date DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...employee.rows[0],
        contracts: contracts.rows,
        documents: documents.rows,
        disciplinary_actions: disciplinary.rows
      }
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create new employee
 * Protected: Requires hr.employees.create permission
 */
router.post('/',
  authenticateToken,
  requirePermission('hr.employees.create'),
  async (req, res) => {
  try {
    const {
      profile_id,
      employee_number,
      first_name,
      last_name,
      cin,
      birth_date,
      birth_place,
      email,
      phone,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      hire_date,
      employment_type,
      position,
      department,
      segment_id,
      manager_id,
      photo_url,
      notes,
      is_cnss_subject = true,
      is_amo_subject = true,
      inscription_objective = 0,
      objective_period_start,
      objective_period_end,
      payroll_cutoff_day = 18,
      // Champs IR
      marital_status = 'single',
      spouse_dependent = false,
      dependent_children = 0,
      other_dependents = 0,
      professional_category = 'normal',
      cimr_affiliated = false,
      cimr_rate = 0,
      mutual_affiliated = false,
      mutual_contribution = 0,
      initial_leave_balance = 0
    } = req.body;

    const result = await pool.query(`
      INSERT INTO hr_employees (
        profile_id, employee_number, first_name, last_name, cin,
        birth_date, birth_place, email, phone, address,
        emergency_contact_name, emergency_contact_phone,
        hire_date, employment_type, position, department,
        segment_id, manager_id, photo_url, notes,
        is_cnss_subject, is_amo_subject,
        inscription_objective, objective_period_start, objective_period_end,
        payroll_cutoff_day,
        marital_status, spouse_dependent, dependent_children, other_dependents,
        professional_category, cimr_affiliated, cimr_rate, mutual_affiliated, mutual_contribution,
        initial_leave_balance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
      RETURNING *
    `, [
      profile_id, employee_number, first_name, last_name, cin,
      birth_date, birth_place, email, phone, address,
      emergency_contact_name, emergency_contact_phone,
      hire_date, employment_type, position, department,
      segment_id, manager_id, photo_url, notes,
      is_cnss_subject, is_amo_subject,
      inscription_objective || 0, objective_period_start || null, objective_period_end || null,
      payroll_cutoff_day || 18,
      marital_status, spouse_dependent, dependent_children || 0, other_dependents || 0,
      professional_category, cimr_affiliated, cimr_rate || 0, mutual_affiliated, mutual_contribution || 0,
      initial_leave_balance || 0
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating employee:', error);
    if (error.code === '23505') {
      res.status(400).json({ success: false, error: 'Employee number or CIN already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * Update employee
 * Protected: Requires hr.employees.update permission
 */
router.put('/:id',
  authenticateToken,
  requirePermission('hr.employees.update'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // Champs de type date qui doivent être null si vides
    const dateFields = ['birth_date', 'hire_date', 'termination_date', 'start_date', 'end_date', 'trial_period_end', 'objective_period_start', 'objective_period_end'];
    // Champs de type UUID/foreign key qui doivent être null si vides
    const fkFields = ['segment_id', 'ville_id', 'manager_id', 'department_id', 'user_id', 'profile_id'];
    // Champs numériques qui doivent être null si vides
    const numericFields = ['approval_levels', 'hourly_rate', 'inscription_objective', 'payroll_cutoff_day',
      'dependents', 'dependent_children', 'other_dependents', 'cimr_rate', 'mutual_contribution',
      'initial_leave_balance', 'seniority_bonus_days', 'base_salary', 'gross_salary', 'net_salary'];

    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    const values = fields.map(f => {
      const val = updates[f];
      // Convertir les chaînes vides en null pour les champs date, FK et numériques
      if ((dateFields.includes(f) || fkFields.includes(f) || numericFields.includes(f)) && val === '') {
        return null;
      }
      return val;
    });

    const result = await pool.query(
      `UPDATE hr_employees SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Synchroniser initial_leave_balance vers hr_leave_balances si modifié
    if (updates.initial_leave_balance !== undefined) {
      const currentYear = new Date().getFullYear();
      await pool.query(`
        UPDATE hr_leave_balances
        SET initial_balance = $1, updated_at = NOW()
        WHERE employee_id = $2 AND year = $3
      `, [updates.initial_leave_balance, id, currentYear]);
      console.log(`✅ Synced initial_leave_balance (${updates.initial_leave_balance}) to hr_leave_balances for employee ${id}`);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete employee
 * Protected: Requires hr.employees.delete permission
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('hr.employees.delete'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM hr_employees WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === CONTRACTS ===

/**
 * Add contract
 * Protected: Requires hr.contracts.manage permission
 */
router.post('/:id/contracts',
  authenticateToken,
  requirePermission('hr.contracts.manage'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const {
      contract_type,
      start_date,
      end_date,
      trial_period_end,
      base_salary,
      salary_currency,
      payment_frequency,
      work_hours_per_week,
      position,
      department,
      document_url,
      notes
    } = req.body;

    const result = await pool.query(`
      INSERT INTO hr_contracts (
        employee_id, contract_type, start_date, end_date,
        trial_period_end, base_salary, salary_currency,
        payment_frequency, work_hours_per_week, position,
        department, document_url, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id, contract_type, start_date, end_date,
      trial_period_end, base_salary, salary_currency || 'MAD',
      payment_frequency || 'monthly', work_hours_per_week || 44,
      position, department, document_url, notes, req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload contract with file
 * POST /api/hr/employees/:id/contracts/upload
 */
router.post('/:id/contracts/upload',
  authenticateToken,
  requirePermission('hr.contracts.manage'),
  (req, res, next) => {
    uploadEmployeeDocument(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        contract_type, start_date, end_date, trial_period_end,
        base_salary, salary_currency, payment_frequency,
        work_hours_per_week, position, department, notes
      } = req.body;

      let document_url = null;
      if (req.file) {
        document_url = `/uploads/employee-documents/${req.file.filename}`;
      }

      const result = await pool.query(`
        INSERT INTO hr_contracts (
          employee_id, contract_type, start_date, end_date,
          trial_period_end, base_salary, salary_currency,
          payment_frequency, work_hours_per_week, position,
          department, document_url, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        id, contract_type, start_date, end_date || null,
        trial_period_end || null, base_salary, salary_currency || 'MAD',
        payment_frequency || 'monthly', work_hours_per_week || 44,
        position, department, document_url, notes, req.user.id
      ]);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error creating contract with upload:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Update contract
 * PUT /api/hr/employees/contracts/:contractId
 */
router.put('/contracts/:contractId',
  authenticateToken,
  requirePermission('hr.contracts.manage'),
  async (req, res) => {
    try {
      const { contractId } = req.params;
      const {
        contract_type, start_date, end_date, trial_period_end,
        base_salary, position, department, notes, status
      } = req.body;

      const result = await pool.query(`
        UPDATE hr_contracts
        SET contract_type = COALESCE($1, contract_type),
            start_date = COALESCE($2, start_date),
            end_date = $3,
            trial_period_end = $4,
            base_salary = COALESCE($5, base_salary),
            position = COALESCE($6, position),
            department = COALESCE($7, department),
            notes = $8,
            status = COALESCE($9, status),
            updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `, [
        contract_type, start_date, end_date || null,
        trial_period_end || null, base_salary, position,
        department, notes, status, contractId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Contract not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating contract:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Delete contract
 * DELETE /api/hr/employees/contracts/:contractId
 */
router.delete('/contracts/:contractId',
  authenticateToken,
  requirePermission('hr.contracts.manage'),
  async (req, res) => {
    try {
      const { contractId } = req.params;

      // Get file path first
      const contractResult = await pool.query(
        'SELECT document_url FROM hr_contracts WHERE id = $1',
        [contractId]
      );

      if (contractResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Contract not found' });
      }

      // Delete from database
      await pool.query('DELETE FROM hr_contracts WHERE id = $1', [contractId]);

      // Delete physical file if exists
      const document_url = contractResult.rows[0].document_url;
      if (document_url) {
        const filePath = path.join(getEmployeeDocumentsDir(), path.basename(document_url));
        deleteFile(filePath);
      }

      res.json({ success: true, message: 'Contrat supprimé' });
    } catch (error) {
      console.error('Error deleting contract:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// === DOCUMENTS ===

/**
 * Add document
 * Protected: Requires hr.documents.manage permission
 */
router.post('/:id/documents',
  authenticateToken,
  requirePermission('hr.documents.manage'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const {
      document_type,
      title,
      description,
      file_url,
      file_name,
      file_size,
      mime_type,
      expiry_date
    } = req.body;

    const result = await pool.query(`
      INSERT INTO hr_employee_documents (
        employee_id, document_type, title, description,
        file_url, file_name, file_size, mime_type,
        expiry_date, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id, document_type, title, description,
      file_url, file_name, file_size, mime_type,
      expiry_date, req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload document with file
 * POST /api/hr/employees/:id/documents/upload
 * Protected: Requires hr.documents.manage permission
 */
router.post('/:id/documents/upload',
  authenticateToken,
  requirePermission('hr.documents.manage'),
  (req, res, next) => {
    uploadEmployeeDocument(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const { document_type, title, description, expiry_date } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
      }

      const file_url = `/uploads/employee-documents/${req.file.filename}`;
      const file_name = req.file.originalname;
      const file_size = req.file.size;
      const mime_type = req.file.mimetype;

      const result = await pool.query(`
        INSERT INTO hr_employee_documents (
          employee_id, document_type, title, description,
          file_url, file_name, file_size, mime_type,
          expiry_date, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        id, document_type, title || file_name, description,
        file_url, file_name, file_size, mime_type,
        expiry_date || null, req.user.id
      ]);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Verify document
/**
 * Verify document
 * Protected: Requires hr.documents.verify permission
 */
router.put('/documents/:docId/verify',
  authenticateToken,
  requirePermission('hr.documents.verify'),
  async (req, res) => {
  try {
    const { docId } = req.params;
    const result = await pool.query(`
      UPDATE hr_employee_documents
      SET is_verified = true, verified_by = $1, verified_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.user.id, docId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update document
 * PUT /api/hr/employees/documents/:docId
 */
router.put('/documents/:docId',
  authenticateToken,
  requirePermission('hr.documents.manage'),
  async (req, res) => {
    try {
      const { docId } = req.params;
      const { document_type, title, description, expiry_date } = req.body;

      const result = await pool.query(`
        UPDATE hr_employee_documents
        SET document_type = COALESCE($1, document_type),
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            expiry_date = $4
        WHERE id = $5
        RETURNING *
      `, [document_type, title, description, expiry_date || null, docId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Delete document
 * DELETE /api/hr/employees/documents/:docId
 */
router.delete('/documents/:docId',
  authenticateToken,
  requirePermission('hr.documents.manage'),
  async (req, res) => {
    try {
      const { docId } = req.params;

      // Get file path first
      const docResult = await pool.query(
        'SELECT file_url FROM hr_employee_documents WHERE id = $1',
        [docId]
      );

      if (docResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      // Delete from database
      await pool.query('DELETE FROM hr_employee_documents WHERE id = $1', [docId]);

      // Delete physical file
      const file_url = docResult.rows[0].file_url;
      if (file_url) {
        const filePath = path.join(getEmployeeDocumentsDir(), path.basename(file_url));
        deleteFile(filePath);
      }

      res.json({ success: true, message: 'Document supprimé' });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// === DISCIPLINARY ===

// Add disciplinary action
/**
 * Add disciplinary action
 * Protected: Requires hr.discipline.manage permission
 */
router.post('/:id/disciplinary',
  authenticateToken,
  requirePermission('hr.discipline.manage'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const {
      action_type,
      severity,
      issue_date,
      reason,
      description,
      document_url,
      duration_days,
      salary_impact,
      witnesses
    } = req.body;

    const result = await pool.query(`
      INSERT INTO hr_disciplinary_actions (
        employee_id, action_type, severity, issue_date,
        reason, description, document_url, duration_days,
        salary_impact, witnesses, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id, action_type, severity, issue_date,
      reason, description, document_url, duration_days,
      salary_impact, witnesses || [], req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating disciplinary action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload disciplinary action with file
 * POST /api/hr/employees/:id/disciplinary/upload
 */
router.post('/:id/disciplinary/upload',
  authenticateToken,
  requirePermission('hr.discipline.manage'),
  (req, res, next) => {
    uploadEmployeeDocument(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        action_type, severity, issue_date, reason,
        description, duration_days, salary_impact, witnesses
      } = req.body;

      let document_url = null;
      if (req.file) {
        document_url = `/uploads/employee-documents/${req.file.filename}`;
      }

      const result = await pool.query(`
        INSERT INTO hr_disciplinary_actions (
          employee_id, action_type, severity, issue_date,
          reason, description, document_url, duration_days,
          salary_impact, witnesses, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        id, action_type, severity, issue_date,
        reason, description, document_url, duration_days || null,
        salary_impact || null, witnesses ? JSON.parse(witnesses) : [], req.user.id
      ]);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error creating disciplinary action with upload:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Update disciplinary action
 * PUT /api/hr/employees/disciplinary/:actionId
 */
router.put('/disciplinary/:actionId',
  authenticateToken,
  requirePermission('hr.discipline.manage'),
  async (req, res) => {
    try {
      const { actionId } = req.params;
      const {
        action_type, severity, issue_date, reason,
        description, duration_days, salary_impact, is_final
      } = req.body;

      const result = await pool.query(`
        UPDATE hr_disciplinary_actions
        SET action_type = COALESCE($1, action_type),
            severity = COALESCE($2, severity),
            issue_date = COALESCE($3, issue_date),
            reason = COALESCE($4, reason),
            description = $5,
            duration_days = $6,
            salary_impact = $7,
            is_final = COALESCE($8, is_final),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [
        action_type, severity, issue_date, reason,
        description, duration_days || null, salary_impact || null,
        is_final, actionId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Disciplinary action not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating disciplinary action:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Delete disciplinary action
 * DELETE /api/hr/employees/disciplinary/:actionId
 */
router.delete('/disciplinary/:actionId',
  authenticateToken,
  requirePermission('hr.discipline.manage'),
  async (req, res) => {
    try {
      const { actionId } = req.params;

      // Get file path first
      const actionResult = await pool.query(
        'SELECT document_url FROM hr_disciplinary_actions WHERE id = $1',
        [actionId]
      );

      if (actionResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Disciplinary action not found' });
      }

      // Delete from database
      await pool.query('DELETE FROM hr_disciplinary_actions WHERE id = $1', [actionId]);

      // Delete physical file if exists
      const document_url = actionResult.rows[0].document_url;
      if (document_url) {
        const filePath = path.join(getEmployeeDocumentsDir(), path.basename(document_url));
        deleteFile(filePath);
      }

      res.json({ success: true, message: 'Action disciplinaire supprimée' });
    } catch (error) {
      console.error('Error deleting disciplinary action:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get departments list
 * Protected: Requires hr.employees.view_page permission
 */
router.get('/meta/departments',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT department
      FROM hr_employees
      WHERE department IS NOT NULL
      ORDER BY department
    `);
    res.json({ success: true, data: result.rows.map(r => r.department) });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === MULTI-MANAGERS ===

/**
 * Get all managers for an employee
 * Protected: Requires hr.employees.view_page permission
 */
router.get('/:id/managers',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        em.id,
        em.employee_id,
        em.manager_id,
        em.rank,
        em.is_active,
        em.created_at,
        m.first_name || ' ' || m.last_name as manager_name,
        m.position as manager_position,
        m.employee_number as manager_employee_number
      FROM hr_employee_managers em
      JOIN hr_employees m ON em.manager_id = m.id
      WHERE em.employee_id = $1 AND em.is_active = true
      ORDER BY em.rank ASC
    `, [id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching employee managers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update managers for an employee (replace all)
 * Protected: Requires hr.employees.update permission
 *
 * Body: { managers: [{ manager_id: uuid, rank: number }, ...] }
 * - Rank 0 (N) = direct manager (required)
 * - Rank 1 (N+1) = superior manager
 * - Rank 2+ (N+2, N+3...) = higher levels
 */
router.put('/:id/managers',
  authenticateToken,
  requirePermission('hr.employees.update'),
  async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { managers } = req.body;

    if (!Array.isArray(managers)) {
      return res.status(400).json({
        success: false,
        error: 'managers must be an array'
      });
    }

    // Validate: at least one manager at rank 0 (N)
    const hasDirectManager = managers.some(m => m.rank === 0);
    if (managers.length > 0 && !hasDirectManager) {
      return res.status(400).json({
        success: false,
        error: 'Un manager direct (rang N) est obligatoire'
      });
    }

    // Validate: no duplicate ranks
    const ranks = managers.map(m => m.rank);
    if (new Set(ranks).size !== ranks.length) {
      return res.status(400).json({
        success: false,
        error: 'Chaque rang ne peut avoir qu\'un seul manager'
      });
    }

    // Validate: employee cannot be their own manager
    if (managers.some(m => m.manager_id === id)) {
      return res.status(400).json({
        success: false,
        error: 'Un employé ne peut pas être son propre manager'
      });
    }

    await client.query('BEGIN');

    // Delete all existing managers for this employee (will be replaced)
    await client.query(`
      DELETE FROM hr_employee_managers
      WHERE employee_id = $1
    `, [id]);

    // Insert new managers
    for (const manager of managers) {
      await client.query(`
        INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (employee_id, manager_id)
        DO UPDATE SET rank = $3, is_active = true, updated_at = NOW()
      `, [id, manager.manager_id, manager.rank]);
    }

    // Also update the legacy manager_id field with the direct manager (rank 0)
    const directManager = managers.find(m => m.rank === 0);
    if (directManager) {
      await client.query(`
        UPDATE hr_employees SET manager_id = $1, updated_at = NOW() WHERE id = $2
      `, [directManager.manager_id, id]);
    } else {
      await client.query(`
        UPDATE hr_employees SET manager_id = NULL, updated_at = NOW() WHERE id = $1
      `, [id]);
    }

    await client.query('COMMIT');

    // Fetch the updated managers list
    const result = await pool.query(`
      SELECT
        em.id,
        em.employee_id,
        em.manager_id,
        em.rank,
        em.is_active,
        m.first_name || ' ' || m.last_name as manager_name,
        m.position as manager_position
      FROM hr_employee_managers em
      JOIN hr_employees m ON em.manager_id = m.id
      WHERE em.employee_id = $1 AND em.is_active = true
      ORDER BY em.rank ASC
    `, [id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating employee managers:', error);

    if (error.code === '23503') {
      res.status(400).json({ success: false, error: 'Manager not found' });
    } else if (error.code === '23505') {
      res.status(400).json({ success: false, error: 'Duplicate manager or rank' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  } finally {
    client.release();
  }
});

/**
 * Get the approval chain for an employee (all active managers in order)
 * Protected: Requires hr.employees.view_page permission
 */
router.get('/:id/approval-chain',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        em.rank,
        em.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        m.email as manager_email,
        m.position as manager_position
      FROM hr_employee_managers em
      JOIN hr_employees m ON em.manager_id = m.id
      WHERE em.employee_id = $1 AND em.is_active = true
      ORDER BY em.rank ASC
    `, [id]);

    res.json({
      success: true,
      data: result.rows,
      approval_levels: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching approval chain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// PRIMES EMPLOYÉ - Routes avec :id
// =====================================================

/**
 * Get employee primes
 * GET /api/hr/employees/:id/primes
 */
router.get('/:id/primes',
  authenticateToken,
  requirePermission('hr.employees.view_page'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT
          ep.*,
          pt.label,
          pt.description as prime_description,
          pt.category,
          pt.exemption_ceiling,
          pt.exemption_unit,
          pt.display_order
        FROM hr_employee_primes ep
        JOIN hr_prime_types pt ON pt.code = ep.prime_type_code
        WHERE ep.employee_id = $1
        ORDER BY pt.category DESC, pt.display_order
      `, [id]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching employee primes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Update employee primes (bulk upsert)
 * PUT /api/hr/employees/:id/primes
 * Body: { primes: [{ prime_type_code, is_active, amount, frequency, notes }, ...] }
 */
router.put('/:id/primes',
  authenticateToken,
  requirePermission('hr.employees.update'),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { primes } = req.body;

      if (!Array.isArray(primes)) {
        return res.status(400).json({
          success: false,
          error: 'primes doit être un tableau'
        });
      }

      await client.query('BEGIN');

      for (const prime of primes) {
        if (!prime.prime_type_code) continue;

        await client.query(`
          INSERT INTO hr_employee_primes (
            employee_id, prime_type_code, is_active, amount, frequency, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (employee_id, prime_type_code)
          DO UPDATE SET
            is_active = EXCLUDED.is_active,
            amount = EXCLUDED.amount,
            frequency = EXCLUDED.frequency,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        `, [
          id,
          prime.prime_type_code,
          prime.is_active ?? false,
          prime.amount ?? 0,
          prime.frequency ?? 'monthly',
          prime.notes ?? null
        ]);
      }

      await client.query('COMMIT');

      // Fetch updated primes
      const result = await pool.query(`
        SELECT
          ep.*,
          pt.label,
          pt.category,
          pt.exemption_ceiling,
          pt.exemption_unit,
          pt.display_order
        FROM hr_employee_primes ep
        JOIN hr_prime_types pt ON pt.code = ep.prime_type_code
        WHERE ep.employee_id = $1
        ORDER BY pt.category DESC, pt.display_order
      `, [id]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating employee primes:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;
