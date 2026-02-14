
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';

const router = express.Router();

const EXTERNAL_ALLOWED_ORIGINS = (process.env.EXTERNAL_PUBLIC_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

const EXTERNAL_STUDENT_JWT_SECRET = process.env.EXTERNAL_STUDENT_JWT_SECRET || process.env.JWT_SECRET || 'change-me-in-production';
const EXTERNAL_STUDENT_TOKEN_TTL = process.env.EXTERNAL_STUDENT_TOKEN_TTL || '24h';

const publicReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
});

const sensitivePublicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
});

function enforceExternalOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) {
        return next();
    }
    if (EXTERNAL_ALLOWED_ORIGINS.includes(origin)) {
        return next();
    }
    return res.status(403).json({ error: 'Origin not allowed' });
}

function signExternalStudentToken(profile) {
    return jwt.sign(
        {
            type: 'external_student',
            profile_id: profile.id,
            username: profile.username,
            full_name: profile.full_name || '',
            role: profile.role || ''
        },
        EXTERNAL_STUDENT_JWT_SECRET,
        { expiresIn: EXTERNAL_STUDENT_TOKEN_TTL }
    );
}

function extractBearerToken(req) {
    const auth = req.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
}

function requireExternalStudentToken(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }
    try {
        const decoded = jwt.verify(token, EXTERNAL_STUDENT_JWT_SECRET);
        if (decoded.type !== 'external_student' || !decoded.profile_id) {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        req.externalStudent = decoded;
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function ensureExternalLeadsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS external_leads (
        id TEXT PRIMARY KEY,
        lead_type TEXT NOT NULL CHECK (lead_type IN ('contact', 'pre_inscription')),
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        city_id TEXT,
        formation_id TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_external_leads_type_created
      ON external_leads(lead_type, created_at DESC)
    `);
}

async function tableExists(tableName) {
    const result = await pool.query(
        `SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists`,
        [tableName]
    );
    return !!result.rows[0]?.exists;
}

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

function isUuidLike(value) {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function normalizePhoneValue(raw) {
    if (!raw) return '';
    return String(raw).replace(/[^\d+]/g, '').trim();
}

function splitFullName(fullName) {
    const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return { nom: '', prenom: '' };
    }
    const parts = normalized.split(' ');
    if (parts.length === 1) {
        return { nom: parts[0], prenom: parts[0] };
    }
    return {
        prenom: parts[0],
        nom: parts.slice(1).join(' ')
    };
}

function buildCinFallback(cinOrPassport, email, phoneNumber) {
    const provided = String(cinOrPassport || '').trim().toUpperCase();
    if (provided) {
        return provided;
    }
    const emailPart = String(email || '').split('@')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3) || 'STD';
    const phonePart = normalizePhoneValue(phoneNumber).replace(/\D/g, '').slice(-3) || '000';
    const timePart = Date.now().toString().slice(-6);
    return `${emailPart}${timePart}${phonePart}`.slice(0, 20);
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

async function getTableColumnsMeta(tableName) {
    const result = await pool.query(
        `SELECT column_name, data_type, udt_name, column_default, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );
    const meta = new Map();
    for (const row of result.rows) {
        meta.set(row.column_name, row);
    }
    return meta;
}

async function getAllowedProfileRoles() {
    try {
        const result = await pool.query(`
          SELECT pg_get_constraintdef(c.oid) AS def
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'profiles'
            AND c.contype = 'c'
            AND c.conname = 'profiles_role_check'
          LIMIT 1
        `);
        if (!result.rows.length) return null;
        const def = result.rows[0].def || '';
        const matches = [...def.matchAll(/'([^']+)'/g)].map(m => m[1].toLowerCase());
        return matches.length ? new Set(matches) : null;
    } catch {
        return null;
    }
}

async function resolveStudentRole(allowedRoleNames = null) {
    const preferredNames = ['student', 'etudiant', 'assistante', 'gerant', 'professor', 'comptable', 'superviseur', 'admin'];
    const effectivePreferred = allowedRoleNames
        ? preferredNames.filter(name => allowedRoleNames.has(name))
        : preferredNames;
    if (effectivePreferred.length === 0 && allowedRoleNames && allowedRoleNames.size > 0) {
        effectivePreferred.push(...allowedRoleNames);
    }

    const existing = await pool.query(
        `SELECT id, name
         FROM roles
         WHERE LOWER(name) = ANY($1::text[])
         ORDER BY
           CASE
             WHEN LOWER(name) = 'student' THEN 0
             WHEN LOWER(name) = 'etudiant' THEN 1
             WHEN LOWER(name) = 'assistante' THEN 2
             WHEN LOWER(name) = 'gerant' THEN 3
             WHEN LOWER(name) = 'professor' THEN 4
             WHEN LOWER(name) = 'comptable' THEN 5
             WHEN LOWER(name) = 'superviseur' THEN 6
             WHEN LOWER(name) = 'admin' THEN 7
             ELSE 99
           END
         LIMIT 1`,
        [effectivePreferred]
    );
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    if (allowedRoleNames && !allowedRoleNames.has('student')) {
        return null;
    }

    const roleId = randomUUID();
    const created = await pool.query(
        `INSERT INTO roles (id, name, description, is_system_role, created_at, updated_at)
         VALUES ($1, $2, $3, false, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
         RETURNING id, name`,
        [roleId, 'student', 'Student role for API registration']
    );
    return created.rows[0];
}

function normalizeCityId(rawCityId, profileMeta) {
    if (!rawCityId || !profileMeta || !profileMeta.has('city_id')) {
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

function normalizeColumnId(rawValue, tableMeta, columnName) {
    if (!rawValue || !tableMeta || !tableMeta.has(columnName)) return null;
    const value = String(rawValue).trim();
    if (!value || value.startsWith('fallback-')) {
        return null;
    }
    const colMeta = tableMeta.get(columnName);
    const isNumeric = ['integer', 'bigint', 'smallint'].includes(colMeta.data_type)
        || ['int4', 'int8', 'int2'].includes(colMeta.udt_name);
    if (isNumeric) {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return value;
}

async function resolveStudentByIdentity({ email, phone, fullName, cinOrPassport }) {
    const studentMeta = await getTableColumnsMeta('students');
    if (studentMeta.size === 0) {
        return null;
    }

    const where = [];
    const params = [];

    if (email && studentMeta.has('email')) {
        params.push(String(email).trim().toLowerCase());
        where.push(`LOWER(email) = $${params.length}`);
    }

    const normalizedPhone = normalizePhoneValue(phone);
    if (normalizedPhone && studentMeta.has('phone')) {
        params.push(normalizedPhone);
        where.push(`regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $${params.length}`);
    }

    if (cinOrPassport && studentMeta.has('cin')) {
        params.push(String(cinOrPassport).trim().toUpperCase());
        where.push(`UPPER(cin) = $${params.length}`);
    }

    const parts = splitFullName(fullName);
    if (parts.nom && parts.prenom && studentMeta.has('nom') && studentMeta.has('prenom')) {
        params.push(parts.nom.toLowerCase());
        params.push(parts.prenom.toLowerCase());
        where.push(`LOWER(nom) = $${params.length - 1} AND LOWER(prenom) = $${params.length}`);
    }

    if (where.length === 0) {
        return null;
    }

    const createdAtExpr = studentMeta.has('created_at') ? 'created_at' : 'NOW()';
    const result = await pool.query(
        `SELECT * FROM students WHERE ${where.join(' OR ')} ORDER BY ${createdAtExpr} DESC LIMIT 1`,
        params
    );
    return result.rows[0] || null;
}

/**
 * GET /api/public/formations
 * Public endpoint to list all formations
 */
router.get('/formations', publicReadLimiter, async (req, res) => {
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
router.get('/cities', publicReadLimiter, async (req, res) => {
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
router.get('/formations/:slug', publicReadLimiter, async (req, res) => {
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
router.post('/student-register', enforceExternalOrigin, sensitivePublicLimiter, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            full_name,
            email,
            password,
            cin_or_passport,
            phone_number,
            city_id
        } = req.body || {};

        if (!full_name || !email || !password || !phone_number) {
            return res.status(400).json({ error: 'full_name, email, phone_number and password are required' });
        }

        const username = String(email).trim().toLowerCase();
        const normalizedPhone = normalizePhoneValue(phone_number);
        const profileMeta = await getProfileColumnsMeta();
        const studentMeta = await getTableColumnsMeta('students');
        const allowedProfileRoles = await getAllowedProfileRoles();
        if (profileMeta.size === 0) {
            return res.status(500).json({ error: 'profiles table metadata not found' });
        }

        await client.query('BEGIN');

        const dupParams = [username];
        let duplicateSql = 'SELECT 1 FROM profiles WHERE username = $1';
        if (profileMeta.has('email')) {
            dupParams.push(username);
            duplicateSql += ` OR email = $${dupParams.length}`;
        }
        const duplicate = await client.query(duplicateSql, dupParams);
        if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email already used' });
        }

        if (studentMeta.size > 0) {
            const studentDupWhere = [];
            const studentDupParams = [];
            if (studentMeta.has('email')) {
                studentDupParams.push(username);
                studentDupWhere.push(`LOWER(email) = $${studentDupParams.length}`);
            }
            if (studentMeta.has('phone')) {
                studentDupParams.push(normalizedPhone);
                studentDupWhere.push(`regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $${studentDupParams.length}`);
            }
            if (studentDupWhere.length > 0) {
                const existingStudent = await client.query(
                    `SELECT id FROM students WHERE ${studentDupWhere.join(' OR ')} LIMIT 1`,
                    studentDupParams
                );
                if (existingStudent.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: 'Student already exists with this email or phone number' });
                }
            }
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
                const maxIdResult = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM profiles');
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

        let selectedRole = null;
        if (profileMeta.has('role') || profileMeta.has('role_id')) {
            selectedRole = await resolveStudentRole(allowedProfileRoles);
            if (!selectedRole && allowedProfileRoles && allowedProfileRoles.size > 0) {
                const fallbackRoleName = ['gerant', 'professor', 'admin'].find(r => allowedProfileRoles.has(r))
                    || Array.from(allowedProfileRoles)[0];
                const fallbackRole = await pool.query(
                    'SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1',
                    [fallbackRoleName]
                );
                if (fallbackRole.rows.length > 0) {
                    selectedRole = fallbackRole.rows[0];
                }
            }
        }

        if (profileMeta.has('role')) {
            insertCols.push('role');
            insertVals.push(selectedRole?.name || 'student');
            placeholders.push(`$${paramIndex++}`);
        }

        if (profileMeta.has('role_id') && selectedRole?.id) {
            const roleIdMeta = profileMeta.get('role_id');
            const roleIdIsUuid = roleIdMeta
                && (roleIdMeta.data_type === 'uuid' || roleIdMeta.udt_name === 'uuid');
            if (!roleIdIsUuid || isUuidLike(String(selectedRole.id))) {
                insertCols.push('role_id');
                insertVals.push(selectedRole.id);
                placeholders.push(`$${paramIndex++}`);
            }
        }

        if (profileMeta.has('status')) {
            insertCols.push('status');
            insertVals.push('pending');
            placeholders.push(`$${paramIndex++}`);
        }
        if (profileMeta.has('account_status')) {
            insertCols.push('account_status');
            insertVals.push('pending');
            placeholders.push(`$${paramIndex++}`);
        }
        if (profileMeta.has('validation_status')) {
            insertCols.push('validation_status');
            insertVals.push('pending');
            placeholders.push(`$${paramIndex++}`);
        }
        if (profileMeta.has('is_active')) {
            insertCols.push('is_active');
            insertVals.push(false);
            placeholders.push(`$${paramIndex++}`);
        }

        if (profileMeta.has('profile_image_url') && profileMeta.get('profile_image_url').is_nullable === 'NO') {
            insertCols.push('profile_image_url');
            insertVals.push('');
            placeholders.push(`$${paramIndex++}`);
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
        const result = await client.query(query, insertVals);

        let student = null;
        if (studentMeta.size > 0) {
            const { nom, prenom } = splitFullName(full_name);
            const cinValue = buildCinFallback(cin_or_passport, username, normalizedPhone);

            const studentInsertCols = [];
            const studentInsertVals = [];
            const studentPlaceholders = [];
            let idx = 1;
            const pushStudent = (col, val) => {
                studentInsertCols.push(col);
                studentInsertVals.push(val);
                studentPlaceholders.push(`$${idx++}`);
            };

            const studentIdMeta = studentMeta.get('id');
            if (studentIdMeta && !studentIdMeta.column_default) {
                const isNumericId = ['integer', 'bigint', 'smallint'].includes(studentIdMeta.data_type)
                    || ['int4', 'int8', 'int2'].includes(studentIdMeta.udt_name);
                if (isNumericId) {
                    const maxId = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM students');
                    pushStudent('id', maxId.rows[0]?.next_id);
                } else {
                    pushStudent('id', randomUUID());
                }
            }

            const defaultValues = new Map([
                ['nom', nom || String(full_name).trim()],
                ['prenom', prenom || nom || String(full_name).trim()],
                ['cin', cinValue],
                ['email', username],
                ['phone', normalizedPhone || String(phone_number).trim()],
                ['whatsapp', normalizedPhone || String(phone_number).trim()],
                ['date_naissance', '2000-01-01'],
                ['lieu_naissance', 'Non renseigne'],
                ['adresse', 'Non renseignee'],
                ['statut_compte', 'inactif'],
                ['status', 'valide'],
                ['city_id', normalizeColumnId(city_id, studentMeta, 'city_id')],
                ['profile_image_url', '']
            ]);

            for (const [col, meta] of studentMeta.entries()) {
                if (col === 'id') continue;
                const hasDefault = !!meta.column_default;
                const isRequired = meta.is_nullable === 'NO' && !hasDefault;
                if (!isRequired && !defaultValues.has(col)) continue;

                let value = defaultValues.get(col);
                if (value === undefined || value === null || value === '') {
                    if (isRequired) {
                        if (col === 'status') value = 'valide';
                        else if (col === 'statut_compte') value = 'inactif';
                        else if (col === 'phone') value = normalizedPhone || '0000000000';
                        else if (col === 'cin') value = cinValue;
                        else if (col === 'nom') value = nom || String(full_name).trim();
                        else if (col === 'prenom') value = prenom || nom || String(full_name).trim();
                        else if (col === 'date_naissance') value = '2000-01-01';
                        else if (col === 'lieu_naissance') value = 'Non renseigne';
                        else if (col === 'adresse') value = 'Non renseignee';
                        else if (col === 'profile_image_url') value = '';
                    } else {
                        continue;
                    }
                }

                pushStudent(col, value);
            }

            if (studentInsertCols.length > 0) {
                const studentInsert = await client.query(
                    `INSERT INTO students (${studentInsertCols.join(', ')})
                     VALUES (${studentPlaceholders.join(', ')})
                     RETURNING id, nom, prenom, email, phone, statut_compte`,
                    studentInsertVals
                );
                student = studentInsert.rows[0] || null;
            }
        }

        await client.query('COMMIT');
        return res.status(201).json({
            message: 'Student registered successfully',
            profile: result.rows[0],
            student
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
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
    } finally {
        client.release();
    }
});

/**
 * POST /api/public/contact-requests
 * Public endpoint for visitor contact requests.
 */
router.post('/contact-requests', enforceExternalOrigin, sensitivePublicLimiter, async (req, res) => {
    try {
        const { full_name, email, phone, city_id, message } = req.body || {};
        if (!full_name || (!email && !phone) || !message) {
            return res.status(400).json({ error: 'full_name, message and one contact (email or phone) are required' });
        }
        await ensureExternalLeadsTable();
        const id = randomUUID();
        await pool.query(
            `INSERT INTO external_leads (id, lead_type, full_name, email, phone, city_id, message, payload)
             VALUES ($1, 'contact', $2, $3, $4, $5, $6, $7::jsonb)`,
            [id, String(full_name).trim(), email || null, phone || null, city_id || null, String(message).trim(), JSON.stringify(req.body || {})]
        );
        return res.status(201).json({ success: true, id, message: 'Contact request submitted' });
    } catch (error) {
        console.error('Error in public contact-requests:', error);
        return res.status(500).json({ error: 'Error creating contact request' });
    }
});

/**
 * POST /api/public/pre-inscriptions
 * Public endpoint for pre-inscription requests.
 */
router.post('/pre-inscriptions', enforceExternalOrigin, sensitivePublicLimiter, async (req, res) => {
    try {
        const { full_name, email, phone, city_id, formation_id, message } = req.body || {};
        if (!full_name || !formation_id || (!email && !phone)) {
            return res.status(400).json({ error: 'full_name, formation_id and one contact (email or phone) are required' });
        }
        await ensureExternalLeadsTable();
        const id = randomUUID();
        await pool.query(
            `INSERT INTO external_leads (id, lead_type, full_name, email, phone, city_id, formation_id, message, payload)
             VALUES ($1, 'pre_inscription', $2, $3, $4, $5, $6, $7, $8::jsonb)`,
            [id, String(full_name).trim(), email || null, phone || null, city_id || null, formation_id, message || null, JSON.stringify(req.body || {})]
        );
        return res.status(201).json({ success: true, id, message: 'Pre-inscription submitted' });
    } catch (error) {
        console.error('Error in public pre-inscriptions:', error);
        return res.status(500).json({ error: 'Error creating pre-inscription' });
    }
});

/**
 * POST /api/public/student-login
 * External website student authentication.
 */
router.post('/student-login', enforceExternalOrigin, sensitivePublicLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const profileMeta = await getProfileColumnsMeta();
        const whereClauses = ['LOWER(username) = LOWER($1)'];
        const params = [String(email).trim().toLowerCase()];
        if (profileMeta.has('email')) {
            whereClauses.push('LOWER(email) = LOWER($1)');
        }
        const result = await pool.query(
            `SELECT * FROM profiles WHERE ${whereClauses.join(' OR ')} LIMIT 1`,
            params
        );
        if (!result.rows.length) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const profile = result.rows[0];
        const passwordHash = profile.password;
        if (!passwordHash || !(await bcrypt.compare(String(password), String(passwordHash)))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const statusValue = (profile.status || profile.account_status || profile.validation_status || '').toString().toLowerCase();
        if (statusValue && ['pending', 'inactive', 'suspended', 'blocked'].includes(statusValue)) {
            return res.status(403).json({ error: 'Account pending activation', status: statusValue });
        }
        if (profileMeta.has('is_active') && profile.is_active === false) {
            return res.status(403).json({ error: 'Account pending activation', status: 'pending' });
        }

        const token = signExternalStudentToken(profile);
        const linkedStudent = await resolveStudentByIdentity({
            email: profile.email || profile.username,
            phone: profile.phone_number || profile.phone || '',
            fullName: profile.full_name || '',
            cinOrPassport: profile.cin_or_passport || ''
        });
        if (linkedStudent) {
            const studentStatus = String(linkedStudent.statut_compte || '').toLowerCase();
            if (studentStatus && ['inactif', 'suspendu'].includes(studentStatus)) {
                return res.status(403).json({ error: 'Account pending activation', status: 'pending' });
            }
        }
        return res.json({
            success: true,
            token,
            expiresIn: EXTERNAL_STUDENT_TOKEN_TTL,
            student: {
                id: profile.id,
                email: profile.email || profile.username,
                full_name: profile.full_name || '',
                status: statusValue || (linkedStudent ? String(linkedStudent.statut_compte || 'active') : 'active')
            }
        });
    } catch (error) {
        console.error('Error in public student-login:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * GET /api/public/student/profile
 * Returns current authenticated external student profile.
 */
router.get('/student/profile', requireExternalStudentToken, async (req, res) => {
    try {
        const profileResult = await pool.query(
            'SELECT id, username, full_name, role, created_at FROM profiles WHERE id = $1',
            [req.externalStudent.profile_id]
        );
        if (!profileResult.rows.length) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        const profile = profileResult.rows[0];
        return res.json({
            success: true,
            profile: {
                id: profile.id,
                email: profile.username,
                full_name: profile.full_name || '',
                role: profile.role || '',
                created_at: profile.created_at
            }
        });
    } catch (error) {
        console.error('Error in public student/profile:', error);
        return res.status(500).json({ error: 'Failed to fetch student profile' });
    }
});

/**
 * GET /api/public/student/dashboard
 * Returns dashboard data for authenticated external student.
 */
router.get('/student/dashboard', requireExternalStudentToken, async (req, res) => {
    try {
        const profileId = req.externalStudent.profile_id;
        const studentMeta = await getTableColumnsMeta('students');
        const studentTablesExist = studentMeta.size > 0;
        const sessionTablesExist = await tableExists('session_etudiants') && await tableExists('sessions_formation');

        let profile = {
            id: profileId,
            full_name: req.externalStudent.full_name || '',
            email: req.externalStudent.username || ''
        };
        const profileResult = await pool.query(
            'SELECT * FROM profiles WHERE id = $1',
            [profileId]
        );
        let profileRow = null;
        if (profileResult.rows.length) {
            const p = profileResult.rows[0];
            profileRow = p;
            profile = { id: p.id, full_name: p.full_name || '', email: p.username || '' };
        }

        const linkedStudent = studentTablesExist
            ? await resolveStudentByIdentity({
                email: profileRow?.email || profileRow?.username || req.externalStudent.username,
                phone: profileRow?.phone_number || profileRow?.phone || '',
                fullName: profileRow?.full_name || req.externalStudent.full_name || '',
                cinOrPassport: profileRow?.cin_or_passport || ''
            })
            : null;

        let formations = [];
        let sessions = [];
        if (linkedStudent && sessionTablesExist) {
            const studentId = linkedStudent.id;
                const sessionCols = await getTableColumns('sessions_formation');
                const formationCols = await getTableColumns('formations');
                const hasFormationTable = formationCols.size > 0;
                const sessionTitleExpr = sessionCols.has('titre')
                    ? 'sf.titre'
                    : (sessionCols.has('title') ? 'sf.title' : 'sf.id::text');
                let formationJoin = '';
                let formationIdExpr = 'NULL::text';
                let formationTitleExpr = 'NULL::text';
                if (hasFormationTable && sessionCols.has('formation_id')) {
                    formationJoin = 'LEFT JOIN formations f ON sf.formation_id = f.id';
                    if (formationCols.has('id')) formationIdExpr = 'f.id';
                    if (formationCols.has('title') && formationCols.has('nom')) {
                        formationTitleExpr = 'COALESCE(f.title, f.nom, f.code, f.id::text)';
                    } else if (formationCols.has('title')) {
                        formationTitleExpr = 'COALESCE(f.title, f.code, f.id::text)';
                    } else if (formationCols.has('nom')) {
                        formationTitleExpr = 'COALESCE(f.nom, f.code, f.id::text)';
                    } else if (formationCols.has('code')) {
                        formationTitleExpr = 'f.code';
                    } else {
                        formationTitleExpr = 'f.id::text';
                    }
                }

                const formationQuery = await pool.query(`
                  SELECT DISTINCT
                    ${formationIdExpr} AS id,
                    ${formationTitleExpr} AS title,
                    sf.id AS session_id,
                    ${sessionTitleExpr} AS session_title
                  FROM session_etudiants se
                  JOIN sessions_formation sf ON sf.id = se.session_id
                  ${formationJoin}
                  WHERE se.student_id = $1
                  ORDER BY session_title ASC
                `, [studentId]);
                formations = formationQuery.rows.map(row => ({
                    id: row.id,
                    title: row.title || row.session_title,
                    session_id: row.session_id
                }));
                sessions = formationQuery.rows.map(row => ({
                    id: row.session_id,
                    title: row.session_title
                }));
        }

        const rawStatus = String(
            linkedStudent?.statut_compte
            || profileRow?.status
            || profileRow?.account_status
            || profileRow?.validation_status
            || 'active'
        ).toLowerCase();
        const accountStatus = rawStatus === 'inactif' ? 'pending' : rawStatus;

        return res.json({
            success: true,
            profile,
            account_status: accountStatus,
            stats: {
                formations_count: formations.length,
                sessions_count: sessions.length
            },
            student_id: linkedStudent?.id || null,
            formations,
            sessions
        });
    } catch (error) {
        console.error('Error in public student/dashboard:', error);
        return res.status(500).json({ error: 'Failed to fetch student dashboard' });
    }
});

export default router;
