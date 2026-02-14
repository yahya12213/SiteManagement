
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import pool from '../config/database.js';

const router = express.Router();

async function getFormationColumns() {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'formations'
    `);
    return new Set(result.rows.map(row => row.column_name));
}

function hasCol(columns, column) {
    return columns.has(column);
}

async function getProfileColumnsMeta() {
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    `);

    const meta = new Map();
    for (const row of result.rows) {
        meta.set(row.column_name, row);
    }
    return meta;
}

function normalizeCityId(rawCityId, profileMeta) {
    if (!rawCityId || !profileMeta.has('city_id')) {
        return null;
    }

    const value = String(rawCityId).trim();
    if (!value || value.startsWith('fallback-')) {
        return null;
    }

    const cityMeta = profileMeta.get('city_id');
    const isNumericCity = ['integer', 'bigint', 'smallint'].includes(cityMeta.data_type)
        || ['int4', 'int8', 'int2'].includes(cityMeta.udt_name);
    if (isNumericCity) {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return value;
}

/**
 * GET /api/public/formations
 * Public endpoint to list all formations
 */
router.get('/formations', async (req, res) => {
    try {
        const columns = await getFormationColumns();

        const priceExpr = hasCol(columns, 'price')
            ? 'price'
            : (hasCol(columns, 'price_mad') ? 'price_mad' : '0');
        const durationExpr = hasCol(columns, 'duration_hours')
            ? 'duration_hours'
            : (hasCol(columns, 'duration_days') ? '(duration_days * 8)' : '0');
        const imageExpr = hasCol(columns, 'image_url')
            ? 'image_url'
            : (hasCol(columns, 'thumbnail_url') ? 'thumbnail_url' : 'NULL');
        const featuredExpr = hasCol(columns, 'is_featured') ? 'is_featured' : 'false';
        const slugExpr = hasCol(columns, 'slug') ? 'slug' : 'id';

        let whereClause = '';
        if (hasCol(columns, 'is_published')) {
            whereClause = 'WHERE is_published = true';
        } else if (hasCol(columns, 'status')) {
            whereClause = "WHERE status IN ('published', 'active')";
        }

        let orderClause = 'ORDER BY title ASC';
        if (hasCol(columns, 'sort_order')) {
            orderClause = 'ORDER BY sort_order ASC, title ASC';
        } else if (hasCol(columns, 'created_at')) {
            orderClause = 'ORDER BY created_at DESC, title ASC';
        }

        const query = `
      SELECT 
        id, 
        title, 
        description, 
        ${priceExpr} as price_mad, 
        ${durationExpr} as duration_hours,
        ${imageExpr} as image,
        ${featuredExpr} as is_featured,
        ${slugExpr} as slug
      FROM formations 
      ${whereClause}
      ${orderClause}
    `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching public formations:', error);
        res.status(500).json({ error: 'Error fetching formations' });
    }
});

/**
 * GET /api/public/cities
 * Public endpoint to list all cities
 */
router.get('/cities', async (req, res) => {
    try {
        const query = `
      SELECT id, name, code, segment_id 
      FROM cities 
      ORDER BY name ASC
    `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching public cities:', error);
        res.status(500).json({ error: 'Error fetching cities' });
    }
});

/**
 * GET /api/public/formations/:slug
 * Public endpoint to get formation details
 */
router.get('/formations/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const columns = await getFormationColumns();

        const priceExpr = hasCol(columns, 'price')
            ? 'price'
            : (hasCol(columns, 'price_mad') ? 'price_mad' : '0');
        const durationExpr = hasCol(columns, 'duration_hours')
            ? 'duration_hours'
            : (hasCol(columns, 'duration_days') ? '(duration_days * 8)' : '0');
        const imageExpr = hasCol(columns, 'image_url')
            ? 'image_url'
            : (hasCol(columns, 'thumbnail_url') ? 'thumbnail_url' : 'NULL');

        const programExpr = hasCol(columns, 'program_details') ? 'program_details' : 'NULL';
        const prereqExpr = hasCol(columns, 'prerequisites') ? 'prerequisites' : 'NULL';
        const objectivesExpr = hasCol(columns, 'objectives') ? 'objectives' : 'NULL';

        let whereClause = '';
        if (hasCol(columns, 'slug')) {
            whereClause = 'slug = $1';
        } else {
            whereClause = 'id = $1';
        }
        if (hasCol(columns, 'is_published')) {
            whereClause += ' AND is_published = true';
        } else if (hasCol(columns, 'status')) {
            whereClause += " AND status IN ('published', 'active')";
        }

        const query = `
      SELECT 
        id, 
        title, 
        description, 
        ${priceExpr} as price_mad, 
        ${durationExpr} as duration_hours,
        ${imageExpr} as image,
        ${programExpr} as program_details,
        ${prereqExpr} as prerequisites,
        ${objectivesExpr} as objectives
      FROM formations 
      WHERE ${whereClause}
    `;
        const result = await pool.query(query, [slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Formation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching formation details:', error);
        res.status(500).json({ error: 'Error fetching formation details' });
    }
});

/**
 * POST /api/public/student-register
 * Public endpoint for Prolean signup. Creates a STUDENT profile in management DB.
 */
router.post('/student-register', async (req, res) => {
    try {
        const {
            full_name,
            email,
            password,
            cin_or_passport,
            phone_number,
            city_id
        } = req.body || {};

        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'full_name, email and password are required' });
        }

        const username = String(email).trim().toLowerCase();
        const profileMeta = await getProfileColumnsMeta();
        if (profileMeta.size === 0) {
            return res.status(500).json({ error: 'profiles table metadata not found' });
        }

        const dupParams = [username];
        let duplicateSql = 'SELECT 1 FROM profiles WHERE username = $1';
        if (profileMeta.has('email')) {
            dupParams.push(username);
            duplicateSql += ` OR email = $${dupParams.length}`;
        }
        const duplicate = await pool.query(duplicateSql, dupParams);
        if (duplicate.rows.length > 0) {
            return res.status(409).json({ error: 'Email already used' });
        }

        const insertCols = [];
        const insertVals = [];
        const placeholders = [];
        let paramIndex = 1;

        const idMeta = profileMeta.get('id');
        if (idMeta && !idMeta.column_default) {
            const isUuid = idMeta.data_type === 'uuid' || idMeta.udt_name === 'uuid';
            const isStringId = ['character varying', 'text', 'character'].includes(idMeta.data_type)
                || ['varchar', 'text', 'bpchar'].includes(idMeta.udt_name);
            const isNumericId = ['integer', 'bigint', 'smallint'].includes(idMeta.data_type)
                || ['int4', 'int8', 'int2'].includes(idMeta.udt_name);

            let generatedId = null;
            if (isUuid || isStringId) {
                generatedId = randomUUID();
            } else if (isNumericId) {
                const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM profiles');
                generatedId = maxIdResult.rows[0]?.next_id;
            } else {
                generatedId = randomUUID();
            }

            insertCols.push('id');
            insertVals.push(generatedId);
            placeholders.push(`$${paramIndex++}`);
        }

        const hashedPassword = await bcrypt.hash(String(password), 10);

        const optionalFields = [
            ['email', username],
            ['phone_number', phone_number || null],
            ['cin_or_passport', cin_or_passport || null],
            ['city_id', normalizeCityId(city_id, profileMeta)]
        ];

        const requiredFields = [
            ['username', username],
            ['password', hashedPassword],
            ['full_name', String(full_name).trim()]
        ];
        for (const [col, val] of requiredFields) {
            if (!profileMeta.has(col)) {
                return res.status(500).json({ error: `profiles.${col} column is required` });
            }
            insertCols.push(col);
            insertVals.push(val);
            placeholders.push(`$${paramIndex++}`);
        }

        if (profileMeta.has('role')) {
            insertCols.push('role');
            insertVals.push('student');
            placeholders.push(`$${paramIndex++}`);
        }

        if (profileMeta.has('role_id')) {
            const roleIdResult = await pool.query(
                `SELECT id
                 FROM roles
                 WHERE LOWER(name) IN ('student', 'etudiant')
                 ORDER BY CASE WHEN LOWER(name) = 'student' THEN 0 ELSE 1 END
                 LIMIT 1`
            );
            if (roleIdResult.rows.length > 0) {
                insertCols.push('role_id');
                insertVals.push(roleIdResult.rows[0].id);
                placeholders.push(`$${paramIndex++}`);
            }
        }

        if (profileMeta.has('created_at') && !profileMeta.get('created_at').column_default) {
            insertCols.push('created_at');
            insertVals.push(new Date());
            placeholders.push(`$${paramIndex++}`);
        }

        if (profileMeta.has('updated_at') && !profileMeta.get('updated_at').column_default) {
            insertCols.push('updated_at');
            insertVals.push(new Date());
            placeholders.push(`$${paramIndex++}`);
        }

        for (const [col, val] of optionalFields) {
            if (profileMeta.has(col) && val) {
                insertCols.push(col);
                insertVals.push(val);
                placeholders.push(`$${paramIndex++}`);
            }
        }

        const query = `
          INSERT INTO profiles (${insertCols.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING id, username, full_name, role, created_at
        `;
        const result = await pool.query(query, insertVals);
        return res.status(201).json({
            message: 'Student registered successfully',
            profile: result.rows[0]
        });
    } catch (error) {
        console.error('Error in public student-register:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email already used' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Invalid related data (city/role). Please try again.' });
        }
        if (error.code === '22P02') {
            return res.status(400).json({ error: 'Invalid field format in registration payload.' });
        }
        return res.status(500).json({
            error: 'Error creating student account',
            details: error.detail || error.message
        });
    }
});

export default router;
