
import express from 'express';
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

export default router;
