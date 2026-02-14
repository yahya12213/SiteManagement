/**
 * Migration: Create projects and project_actions tables
 * Run this file once to create the database tables for project management
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'planning',
        priority VARCHAR(20) DEFAULT 'normale',
        start_date DATE,
        end_date DATE,
        budget DECIMAL(15,2),
        manager_id VARCHAR(50) REFERENCES profiles(id) ON DELETE SET NULL,
        segment_id VARCHAR(50) REFERENCES segments(id) ON DELETE SET NULL,
        city_id VARCHAR(50) REFERENCES cities(id) ON DELETE SET NULL,
        created_by VARCHAR(50) REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table projects created');

    // Create project_actions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_actions (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) REFERENCES projects(id) ON DELETE SET NULL,
        description VARCHAR(500) NOT NULL,
        description_detail TEXT,
        pilote_id VARCHAR(50) REFERENCES profiles(id) ON DELETE SET NULL,
        assigned_by VARCHAR(50) REFERENCES profiles(id) ON DELETE SET NULL,
        date_assignment DATE DEFAULT CURRENT_DATE,
        deadline DATE,
        status VARCHAR(50) DEFAULT 'a_faire',
        commentaire TEXT,
        segment_id VARCHAR(50) REFERENCES segments(id) ON DELETE SET NULL,
        city_id VARCHAR(50) REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table project_actions created');

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
      CREATE INDEX IF NOT EXISTS idx_projects_segment ON projects(segment_id);
      CREATE INDEX IF NOT EXISTS idx_projects_city ON projects(city_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_project_actions_project ON project_actions(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_actions_pilote ON project_actions(pilote_id);
      CREATE INDEX IF NOT EXISTS idx_project_actions_status ON project_actions(status);
      CREATE INDEX IF NOT EXISTS idx_project_actions_deadline ON project_actions(deadline);
    `);
    console.log('✅ Indexes created');

    // Add permissions to the database (using correct column names: label, menu, action)
    const permissions = [
      // Projects permissions
      { code: 'accounting.projects.view_page', label: 'Voir Projets', description: 'Voir la page Gestion de Projet', module: 'accounting', menu: 'projects', action: 'view_page' },
      { code: 'accounting.projects.create', label: 'Créer Projets', description: 'Créer des projets', module: 'accounting', menu: 'projects', action: 'create' },
      { code: 'accounting.projects.update', label: 'Modifier Projets', description: 'Modifier des projets', module: 'accounting', menu: 'projects', action: 'update' },
      { code: 'accounting.projects.delete', label: 'Supprimer Projets', description: 'Supprimer des projets', module: 'accounting', menu: 'projects', action: 'delete' },
      { code: 'accounting.projects.export', label: 'Exporter Projets', description: 'Exporter les projets', module: 'accounting', menu: 'projects', action: 'export' },
      // Actions permissions
      { code: 'accounting.actions.view_page', label: 'Voir Actions', description: 'Voir les actions du plan', module: 'accounting', menu: 'actions', action: 'view_page' },
      { code: 'accounting.actions.create', label: 'Créer Actions', description: 'Créer des actions', module: 'accounting', menu: 'actions', action: 'create' },
      { code: 'accounting.actions.update', label: 'Modifier Actions', description: 'Modifier des actions', module: 'accounting', menu: 'actions', action: 'update' },
      { code: 'accounting.actions.delete', label: 'Supprimer Actions', description: 'Supprimer des actions', module: 'accounting', menu: 'actions', action: 'delete' },
    ];

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (code, label, description, module, menu, action)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (code) DO NOTHING
      `, [perm.code, perm.label, perm.description, perm.module, perm.menu, perm.action]);
    }
    console.log('✅ Permissions added');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration completed successfully',
      tables: ['projects', 'project_actions'],
      permissions: permissions.map(p => p.code)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('projects', 'project_actions')
    `);

    const allTablesExist = tablesResult.rows.length === 2;

    // Format compatible avec MigrationPanel
    res.json({
      status: {
        migrationNeeded: !allTablesExist,
        applied: allTablesExist,
        tables: tablesResult.rows.map(r => r.table_name)
      },
      message: allTablesExist
        ? 'Migration Projects already applied - tables exist'
        : 'Migration needed - projects or project_actions table missing'
    });
  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
