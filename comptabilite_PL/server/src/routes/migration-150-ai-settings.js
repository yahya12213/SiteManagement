import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('Starting migration 150: AI Settings table...');

    // Create app_settings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('app_settings table created/verified');

    // Create index on key
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
    `);

    console.log('Index created');

    // Insert default AI settings if not exist
    const defaultSettings = [
      { key: 'ai_provider', value: '', description: 'AI provider: claude, openai, or gemini' },
      { key: 'ai_api_key', value: '', description: 'API key for the AI provider' },
      { key: 'ai_model', value: '', description: 'AI model to use' },
      { key: 'ai_enabled', value: 'false', description: 'Whether AI features are enabled' }
    ];

    for (const setting of defaultSettings) {
      await pool.query(`
        INSERT INTO app_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
      `, [setting.key, setting.value, setting.description]);
    }

    console.log('Default AI settings inserted');

    res.json({
      success: true,
      message: 'Migration 150 completed: AI Settings table created'
    });

  } catch (error) {
    console.error('Migration 150 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
