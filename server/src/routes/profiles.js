import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope } from '../middleware/requireScope.js';
import { uploadProfileImage, deleteFile } from '../middleware/upload.js';

const router = express.Router();

/**
 * Determine which segment/city tables to use based on user role
 * Gérant users use gerant_segments/gerant_cities
 * All other users (professor, admin) use professor_segments/professor_cities
 */
function getTablesForRole(role) {
  if (role === 'gerant') {
    return {
      segmentsTable: 'gerant_segments',
      citiesTable: 'gerant_cities',
      userIdColumn: 'gerant_id'
    };
  }
  // Default to professor tables for backwards compatibility
  return {
    segmentsTable: 'professor_segments',
    citiesTable: 'professor_cities',
    userIdColumn: 'professor_id'
  };
}

/**
 * GET tous les profils (sans mots de passe)
 * Protected: SBAC filtering only (no permission check)
 * Non-admin users only see users from their assigned segments/cities
 * Permission check removed to allow dropdown usage without view_page permission
 */
router.get('/',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    const scope = req.userScope;
    let query;
    let params = [];

    // Admin voit tous les utilisateurs
    if (!scope || scope.isAdmin) {
      query = `
        SELECT p.id, p.username, p.full_name, p.role, p.role_id, p.created_at,
               r.name as role_name
        FROM profiles p
        LEFT JOIN roles r ON p.role_id = r.id
        ORDER BY p.full_name
      `;
    } else {
      // Non-admin: voit seulement les utilisateurs des mêmes segments/villes (SBAC)
      const { segmentIds, cityIds } = scope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope assigned - return only self
        query = `
          SELECT p.id, p.username, p.full_name, p.role, p.role_id, p.created_at,
                 r.name as role_name
          FROM profiles p
          LEFT JOIN roles r ON p.role_id = r.id
          WHERE p.id = $1
          ORDER BY p.full_name
        `;
        params = [req.user.id];
      } else {
        // Filter by shared segments/cities
        query = `
          SELECT DISTINCT p.id, p.username, p.full_name, p.role, p.role_id, p.created_at,
                 r.name as role_name
          FROM profiles p
          LEFT JOIN roles r ON p.role_id = r.id
          LEFT JOIN professor_segments ps ON p.id = ps.professor_id
          LEFT JOIN professor_cities pc ON p.id = pc.professor_id
          WHERE
            p.id = $1  -- Always include self
        `;
        params = [req.user.id];

        if (segmentIds.length > 0) {
          const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR ps.segment_id IN (${segmentPlaceholders})`;
          params.push(...segmentIds);
        }

        if (cityIds.length > 0) {
          const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR pc.city_id IN (${cityPlaceholders})`;
          params.push(...cityIds);
        }

        query += ' ORDER BY p.full_name';
      }
    }

    const result = await pool.query(query, params);

    // Pour chaque profil, récupérer ses segments et villes
    const profiles = await Promise.all(
      result.rows.map(async (profile) => {
        const tables = getTablesForRole(profile.role);

        // Récupérer les segments
        const segmentsResult = await pool.query(
          `SELECT segment_id FROM ${tables.segmentsTable} WHERE ${tables.userIdColumn} = $1`,
          [profile.id]
        );
        profile.segment_ids = segmentsResult.rows.map(row => row.segment_id);

        // Récupérer les villes
        const citiesResult = await pool.query(
          `SELECT city_id FROM ${tables.citiesTable} WHERE ${tables.userIdColumn} = $1`,
          [profile.id]
        );
        profile.city_ids = citiesResult.rows.map(row => row.city_id);

        return profile;
      })
    );

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

/**
 * GET profiles disponibles pour linkage employe
 * Retourne les profiles non lies a un employe OU le profile actuel de l'employe en edition
 */
router.get('/available-for-employee',
  authenticateToken,
  async (req, res) => {
  try {
    const { current_employee_id } = req.query;

    let query = `
      SELECT p.id, p.username, p.full_name
      FROM profiles p
      WHERE p.id NOT IN (
        SELECT profile_id FROM hr_employees
        WHERE profile_id IS NOT NULL
    `;
    const params = [];

    // Si on edite un employe, exclure son propre profile_id de la restriction
    if (current_employee_id) {
      query += ` AND id != $1`;
      params.push(current_employee_id);
    }

    query += `) ORDER BY p.username`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching available profiles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
  }
});

/**
 * GET tous les professeurs seulement (role='professor')
 * Protected: SBAC filtering only (no permission check)
 * Server-side filtering by role to ensure only professors are returned
 * Non-admin users only see professors from their assigned segments/cities
 */
router.get('/professors',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    const { segment_id, city_id } = req.query;
    const scope = req.userScope;

    let query;
    let params = [];

    // Admin voit tous les professeurs avec filtres optionnels
    if (!scope || scope.isAdmin) {
      query = `
        SELECT id, username, full_name, role, created_at
        FROM profiles
        WHERE role = 'professor'
      `;

      // Add segment filter if provided
      if (segment_id) {
        query += ' AND EXISTS (SELECT 1 FROM professor_segments WHERE professor_id = profiles.id AND segment_id = $1)';
        params.push(segment_id);
      }

      // Add city filter if provided
      if (city_id) {
        const paramNum = params.length + 1;
        query += ` AND EXISTS (SELECT 1 FROM professor_cities WHERE professor_id = profiles.id AND city_id = $${paramNum})`;
        params.push(city_id);
      }

      query += ' ORDER BY full_name';
    } else {
      // Non-admin: voit seulement les professeurs des mêmes segments/villes (SBAC)
      const { segmentIds, cityIds } = scope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope assigned - return only self if professor
        query = `
          SELECT id, username, full_name, role, created_at
          FROM profiles
          WHERE id = $1 AND role = 'professor'
        `;
        params = [req.user.id];

        // Add filters even for self
        if (segment_id) {
          params.push(segment_id);
          query += ` AND EXISTS (SELECT 1 FROM professor_segments WHERE professor_id = profiles.id AND segment_id = $${params.length})`;
        }
        if (city_id) {
          params.push(city_id);
          query += ` AND EXISTS (SELECT 1 FROM professor_cities WHERE professor_id = profiles.id AND city_id = $${params.length})`;
        }

        query += ' ORDER BY full_name';
      } else {
        // Filter by shared segments/cities AND role='professor'
        query = `
          SELECT DISTINCT p.id, p.username, p.full_name, p.role, p.created_at
          FROM profiles p
          LEFT JOIN professor_segments ps ON p.id = ps.professor_id
          LEFT JOIN professor_cities pc ON p.id = pc.professor_id
          WHERE p.role = 'professor' AND (
            p.id = $1  -- Always include self if professor
        `;
        params = [req.user.id];

        if (segmentIds.length > 0) {
          const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR ps.segment_id IN (${segmentPlaceholders})`;
          params.push(...segmentIds);
        }

        if (cityIds.length > 0) {
          const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR pc.city_id IN (${cityPlaceholders})`;
          params.push(...cityIds);
        }

        query += ')';

        // Apply additional segment/city filters if provided
        if (segment_id) {
          params.push(segment_id);
          query += ` AND EXISTS (SELECT 1 FROM professor_segments WHERE professor_id = p.id AND segment_id = $${params.length})`;
        }
        if (city_id) {
          params.push(city_id);
          query += ` AND EXISTS (SELECT 1 FROM professor_cities WHERE professor_id = p.id AND city_id = $${params.length})`;
        }

        query += ' ORDER BY p.full_name';
      }
    }

    const result = await pool.query(query, params);

    // Pour chaque professeur, récupérer ses segments et villes
    const professors = await Promise.all(
      result.rows.map(async (professor) => {
        const tables = getTablesForRole(professor.role);

        // Récupérer les segments
        const segmentsResult = await pool.query(
          `SELECT segment_id FROM ${tables.segmentsTable} WHERE ${tables.userIdColumn} = $1`,
          [professor.id]
        );
        professor.segment_ids = segmentsResult.rows.map(row => row.segment_id);

        // Récupérer les villes
        const citiesResult = await pool.query(
          `SELECT city_id FROM ${tables.citiesTable} WHERE ${tables.userIdColumn} = $1`,
          [professor.id]
        );
        professor.city_ids = citiesResult.rows.map(row => row.city_id);

        return professor;
      })
    );

    res.json(professors);
  } catch (error) {
    console.error('Error fetching professors:', error);
    res.status(500).json({ error: 'Failed to fetch professors' });
  }
});

/**
 * GET un profil avec ses segments et villes
 * Protected: SBAC only - non-admins can only access users from their assigned segments/cities
 * Permission check removed to allow dropdown usage without view_page permission
 */
router.get('/:id',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.userScope;

    let query;
    let params;

    // Admin peut voir n'importe quel profil
    if (!scope || scope.isAdmin) {
      query = 'SELECT id, username, full_name, role, created_at FROM profiles WHERE id = $1';
      params = [id];
    } else {
      // Non-admin: vérifier que l'utilisateur demandé partage au moins un segment/ville (SBAC)
      const { segmentIds, cityIds } = scope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope - can only access self
        if (id !== req.user.id) {
          return res.status(404).json({ error: 'Profile not found or access denied' });
        }
        query = 'SELECT id, username, full_name, role, created_at FROM profiles WHERE id = $1';
        params = [id];
      } else {
        // Vérifier que le profil demandé partage au moins un segment/ville
        query = `
          SELECT DISTINCT p.id, p.username, p.full_name, p.role, p.created_at
          FROM profiles p
          LEFT JOIN professor_segments ps ON p.id = ps.professor_id
          LEFT JOIN professor_cities pc ON p.id = pc.professor_id
          WHERE p.id = $1 AND (
            p.id = $2  -- Always allow self
        `;
        params = [id, req.user.id];

        if (segmentIds.length > 0) {
          const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR ps.segment_id IN (${segmentPlaceholders})`;
          params.push(...segmentIds);
        }

        if (cityIds.length > 0) {
          const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
          query += ` OR pc.city_id IN (${cityPlaceholders})`;
          params.push(...cityIds);
        }

        query += ')';
      }
    }

    const profileResult = await pool.query(query, params);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found or access denied' });
    }

    const profile = profileResult.rows[0];

    const tables = getTablesForRole(profile.role);

    // Segments
    const segmentsResult = await pool.query(
      `SELECT segment_id FROM ${tables.segmentsTable} WHERE ${tables.userIdColumn} = $1`,
      [id]
    );
    profile.segment_ids = segmentsResult.rows.map(row => row.segment_id);

    // Villes
    const citiesResult = await pool.query(
      `SELECT city_id FROM ${tables.citiesTable} WHERE ${tables.userIdColumn} = $1`,
      [id]
    );
    profile.city_ids = citiesResult.rows.map(row => row.city_id);

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST créer un profil
 * Protected: Requires authentication and users create permission
 * Security: Only admins can create admin accounts
 * Auto-inherit: Non-admin creators pass their segments/cities to new users if not specified
 */
router.post('/',
  authenticateToken,
  requirePermission('accounting.users.create'),
  injectUserScope,
  async (req, res) => {
  const client = await pool.connect();

  try {
    let {
      id, username, password, full_name, role, segment_ids, city_ids,
      // Nouveaux champs optionnels pour création d'employé
      create_employee, cin, hire_date, position, department
    } = req.body;

    if (!id || !username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Security check: Only admins can create admin accounts
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can create admin accounts',
        code: 'FORBIDDEN_ADMIN_CREATION'
      });
    }

    // Validation: segments et villes obligatoires pour les utilisateurs non-admin
    if (role !== 'admin') {
      if (!segment_ids || segment_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Au moins un segment est requis',
          code: 'MISSING_SEGMENTS'
        });
      }
      if (!city_ids || city_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Au moins une ville est requise',
          code: 'MISSING_CITIES'
        });
      }
    }

    // Auto-inherit segments/cities from creator if not specified (for non-admin creators)
    // This ensures the creator can see the users they create
    const scope = req.userScope;
    if (scope && !scope.isAdmin) {
      if ((!segment_ids || segment_ids.length === 0) && scope.segmentIds && scope.segmentIds.length > 0) {
        segment_ids = scope.segmentIds;
        console.log(`📍 Auto-assigning creator's segments to new user: ${segment_ids.join(', ')}`);
      }
      if ((!city_ids || city_ids.length === 0) && scope.cityIds && scope.cityIds.length > 0) {
        city_ids = scope.cityIds;
        console.log(`📍 Auto-assigning creator's cities to new user: ${city_ids.join(', ')}`);
      }
    }

    await client.query('BEGIN');

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer le profil
    const profileResult = await client.query(
      'INSERT INTO profiles (id, username, password, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role, created_at',
      [id, username, hashedPassword, full_name, role]
    );

    const profile = profileResult.rows[0];

    // Assigner le rôle RBAC - recherche insensible à la casse
    const roleResult = await client.query(
      'SELECT id FROM roles WHERE LOWER(name) = LOWER($1)',
      [role]
    );
    if (roleResult.rows.length > 0) {
      const roleId = roleResult.rows[0].id;

      // Mettre à jour role_id dans profiles
      await client.query(
        'UPDATE profiles SET role_id = $1 WHERE id = $2',
        [roleId, id]
      );

      // Assigner dans user_roles (si cette table est utilisée)
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role_id) DO NOTHING
      `, [id, roleId]);
    } else {
      console.warn(`⚠️ Rôle "${role}" non trouvé dans la table roles lors de la création de l'utilisateur ${username}`);
    }

    // Créer l'employé si demandé
    if (create_employee) {
      const nameParts = full_name.trim().split(' ');
      const firstName = nameParts[0] || username;
      const lastName = nameParts.slice(1).join(' ') || '';
      const employeeNumber = `EMP-${username.toUpperCase().substring(0, 5)}-${Date.now().toString().slice(-4)}`;

      const employeeResult = await client.query(`
        INSERT INTO hr_employees (
          employee_number, first_name, last_name,
          profile_id, cin, hire_date, position, department,
          requires_clocking, employment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'active', NOW(), NOW())
        RETURNING id, employee_number
      `, [
        employeeNumber,
        firstName,
        lastName,
        id,
        cin || null,
        hire_date || new Date().toISOString().split('T')[0],
        position || null,
        department || null
      ]);

      profile.employee = employeeResult.rows[0];
      console.log(`✅ Employé créé pour ${username}: ${employeeNumber}`);
    }

    const tables = getTablesForRole(role);

    // Ajouter les segments
    if (segment_ids && segment_ids.length > 0) {
      for (const segmentId of segment_ids) {
        await client.query(
          `INSERT INTO ${tables.segmentsTable} (${tables.userIdColumn}, segment_id) VALUES ($1, $2)`,
          [id, segmentId]
        );
      }
      profile.segment_ids = segment_ids;
    }

    // Ajouter les villes
    if (city_ids && city_ids.length > 0) {
      for (const cityId of city_ids) {
        await client.query(
          `INSERT INTO ${tables.citiesTable} (${tables.userIdColumn}, city_id) VALUES ($1, $2)`,
          [id, cityId]
        );
      }
      profile.city_ids = city_ids;
    }

    await client.query('COMMIT');
    res.status(201).json(profile);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * PUT mettre à jour un profil (support des mises à jour partielles)
 * Protected: Requires authentication and users update permission
 * Security: Users cannot change their own role; Only admins can assign admin role
 */
router.put('/:id',
  authenticateToken,
  requirePermission('accounting.users.update'),
  async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { username, full_name, role, segment_ids, city_ids, password } = req.body;

    // Security check 1: Prevent self-role elevation
    // Users cannot change their own role unless they are admin
    if (role !== undefined && id === req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You cannot change your own role',
        code: 'FORBIDDEN_SELF_ROLE_CHANGE'
      });
    }

    // Security check 2: Only admins can assign admin role
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can assign admin role',
        code: 'FORBIDDEN_ADMIN_ASSIGNMENT'
      });
    }

    await client.query('BEGIN');

    // Vérifier si le profil existe
    const checkResult = await client.query('SELECT id FROM profiles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Déterminer si on doit mettre à jour la table profiles
    const hasProfileFields = username !== undefined || full_name !== undefined || role !== undefined || password !== undefined;

    if (hasProfileFields) {
      // Construire dynamiquement la requête UPDATE avec les champs fournis
      const fieldsToUpdate = [];
      const values = [];
      let paramIndex = 1;

      if (username !== undefined) {
        fieldsToUpdate.push(`username = $${paramIndex++}`);
        values.push(username);
      }
      if (full_name !== undefined) {
        fieldsToUpdate.push(`full_name = $${paramIndex++}`);
        values.push(full_name);
      }
      if (role !== undefined) {
        fieldsToUpdate.push(`role = $${paramIndex++}`);
        values.push(role);

        // Synchroniser role_id avec role (texte) - recherche insensible à la casse
        const roleIdResult = await client.query(
          'SELECT id FROM roles WHERE LOWER(name) = LOWER($1)',
          [role]
        );
        if (roleIdResult.rows.length > 0) {
          fieldsToUpdate.push(`role_id = $${paramIndex++}`);
          values.push(roleIdResult.rows[0].id);
        } else {
          console.warn(`⚠️ Rôle "${role}" non trouvé dans la table roles - role_id non mis à jour`);
        }
      }
      if (password !== undefined) {
        const hashedPassword = await bcrypt.hash(password, 10);
        fieldsToUpdate.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      // Ajouter l'ID comme dernier paramètre
      values.push(id);

      const query = `UPDATE profiles SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, full_name, role, created_at`;
      await client.query(query, values);
    }

    // Récupérer le rôle actuel pour déterminer les tables à utiliser
    const roleCheck = await client.query('SELECT role FROM profiles WHERE id = $1', [id]);
    const currentRole = role !== undefined ? role : roleCheck.rows[0].role;
    const tables = getTablesForRole(currentRole);

    // Mettre à jour les segments si fournis
    if (segment_ids !== undefined) {
      await client.query(`DELETE FROM ${tables.segmentsTable} WHERE ${tables.userIdColumn} = $1`, [id]);
      if (segment_ids.length > 0) {
        for (const segmentId of segment_ids) {
          await client.query(
            `INSERT INTO ${tables.segmentsTable} (${tables.userIdColumn}, segment_id) VALUES ($1, $2)`,
            [id, segmentId]
          );
        }
      }
    }

    // Mettre à jour les villes si fournies
    if (city_ids !== undefined) {
      await client.query(`DELETE FROM ${tables.citiesTable} WHERE ${tables.userIdColumn} = $1`, [id]);
      if (city_ids.length > 0) {
        for (const cityId of city_ids) {
          await client.query(
            `INSERT INTO ${tables.citiesTable} (${tables.userIdColumn}, city_id) VALUES ($1, $2)`,
            [id, cityId]
          );
        }
      }
    }

    // Récupérer le profil complet avec les segments et villes
    const profileResult = await client.query(
      'SELECT id, username, full_name, role, created_at FROM profiles WHERE id = $1',
      [id]
    );

    const profile = profileResult.rows[0];

    // Re-fetch tables in case role was updated
    const finalTables = getTablesForRole(profile.role);

    // Ajouter les segment_ids
    const segmentsResult = await client.query(
      `SELECT segment_id FROM ${finalTables.segmentsTable} WHERE ${finalTables.userIdColumn} = $1`,
      [id]
    );
    profile.segment_ids = segmentsResult.rows.map(row => row.segment_id);

    // Ajouter les city_ids
    const citiesResult = await client.query(
      `SELECT city_id FROM ${finalTables.citiesTable} WHERE ${finalTables.userIdColumn} = $1`,
      [id]
    );
    profile.city_ids = citiesResult.rows.map(row => row.city_id);

    await client.query('COMMIT');
    res.json(profile);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * DELETE supprimer un profil
 * Protected: Requires authentication and users delete permission
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('accounting.users.delete'),
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM profiles WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST upload profile photo for current user
 * POST /api/profiles/me/photo
 * Allows authenticated user to upload their own profile photo
 */
router.post('/me/photo',
  authenticateToken,
  (req, res, next) => {
    uploadProfileImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
      }

      const userId = req.user.id;

      // Get old photo URL to delete it later
      const oldPhotoResult = await pool.query(
        'SELECT profile_image_url FROM profiles WHERE id = $1',
        [userId]
      );

      const profile_image_url = `/uploads/profiles/${req.file.filename}`;

      // Update profile with new photo URL
      const result = await pool.query(`
        UPDATE profiles
        SET profile_image_url = $1
        WHERE id = $2
        RETURNING id, username, full_name, profile_image_url
      `, [profile_image_url, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Profil non trouvé' });
      }

      // Delete old photo if exists
      if (oldPhotoResult.rows.length > 0 && oldPhotoResult.rows[0].profile_image_url) {
        const oldUrl = oldPhotoResult.rows[0].profile_image_url;
        const uploadsDir = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
        const oldFilePath = path.join(uploadsDir, 'profiles', path.basename(oldUrl));
        deleteFile(oldFilePath);
      }

      console.log(`✅ Profile photo updated for user ${userId}: ${profile_image_url}`);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Photo de profil mise à jour'
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de l\'upload de la photo' });
    }
  }
);

/**
 * DELETE profile photo for current user
 * DELETE /api/profiles/me/photo
 * Allows authenticated user to delete their own profile photo
 */
router.delete('/me/photo',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Get current photo URL
      const photoResult = await pool.query(
        'SELECT profile_image_url FROM profiles WHERE id = $1',
        [userId]
      );

      if (photoResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Profil non trouvé' });
      }

      const profile_image_url = photoResult.rows[0].profile_image_url;

      // Update profile to remove photo URL
      await pool.query(`
        UPDATE profiles
        SET profile_image_url = NULL
        WHERE id = $1
      `, [userId]);

      // Delete physical file if exists
      if (profile_image_url) {
        const uploadsDir = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadsDir, 'profiles', path.basename(profile_image_url));
        deleteFile(filePath);
      }

      console.log(`✅ Profile photo deleted for user ${userId}`);

      res.json({
        success: true,
        message: 'Photo de profil supprimée'
      });
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la photo' });
    }
  }
);

export default router;
