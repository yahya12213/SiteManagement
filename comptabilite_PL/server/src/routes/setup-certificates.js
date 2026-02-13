import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration pour créer la table certificates
 * GET /api/setup-certificates/run
 */
router.get('/run', async (req, res) => {
  try {
    // Vérifier si la table existe déjà
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'certificates'
      );
    `);

    if (tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        message: 'Table certificates already exists',
        alreadyExists: true,
      });
    }

    // Créer la table certificates
    await pool.query(`
      CREATE TABLE certificates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
        certificate_number TEXT UNIQUE NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completion_date TIMESTAMP NOT NULL,
        grade DECIMAL(5, 2),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, formation_id)
      );
    `);

    // Créer les index
    await pool.query(`
      CREATE INDEX idx_certificates_student_id ON certificates(student_id);
    `);

    await pool.query(`
      CREATE INDEX idx_certificates_formation_id ON certificates(formation_id);
    `);

    await pool.query(`
      CREATE INDEX idx_certificates_number ON certificates(certificate_number);
    `);

    res.json({
      success: true,
      message: 'Certificates table created successfully',
      details: {
        table: 'certificates',
        indexes: ['idx_certificates_student_id', 'idx_certificates_formation_id', 'idx_certificates_number'],
      },
    });
  } catch (error) {
    console.error('Error creating certificates table:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Vérifier si la table existe
 * GET /api/setup-certificates/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'certificates'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        message: 'Table certificates does not exist',
      });
    }

    res.json({
      success: true,
      exists: true,
      columns: result.rows,
    });
  } catch (error) {
    console.error('Error verifying certificates table:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
