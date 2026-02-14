
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/public/formations
 * Public endpoint to list all formations
 */
router.get('/formations', async (req, res) => {
    try {
        const query = `
      SELECT 
        id, 
        title, 
        description, 
        price as price_mad, 
        duration_hours,
        image_url as image,
        is_featured,
        slug
      FROM formations 
      WHERE is_published = true 
      ORDER BY sort_order ASC, title ASC
    `;
        // Note: I will adjust columns based on the check-formations.js output
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
        const query = `
      SELECT 
        id, 
        title, 
        description, 
        price as price_mad, 
        duration_hours,
        image_url as image,
        program_details,
        prerequisites,
        objectives
      FROM formations 
      WHERE slug = $1 AND is_published = true
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
