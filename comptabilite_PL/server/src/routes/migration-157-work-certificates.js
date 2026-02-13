import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 157: HR Work Certificates
// Creates: hr_work_certificates table for employment attestations

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 157: HR Work Certificates ===');

    // Step 1: Create hr_work_certificates table
    console.log('Step 1: Creating hr_work_certificates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_work_certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        certificate_number TEXT UNIQUE NOT NULL,
        certificate_type TEXT NOT NULL CHECK (certificate_type IN (
          'standard',
          'with_salary',
          'end_of_contract',
          'custom'
        )),
        purpose TEXT,
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
        start_date DATE,
        end_date DATE,
        include_salary BOOLEAN DEFAULT FALSE,
        include_position BOOLEAN DEFAULT TRUE,
        custom_text TEXT,
        pdf_url TEXT,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'delivered')),
        delivered_at TIMESTAMP,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_work_certificates table created');

    // Step 2: Create indexes
    console.log('Step 2: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_work_cert_employee ON hr_work_certificates(employee_id);
      CREATE INDEX IF NOT EXISTS idx_work_cert_date ON hr_work_certificates(issue_date);
      CREATE INDEX IF NOT EXISTS idx_work_cert_status ON hr_work_certificates(status);
      CREATE INDEX IF NOT EXISTS idx_work_cert_type ON hr_work_certificates(certificate_type);
    `);
    console.log('Indexes created');

    // Step 3: Create sequence for certificate numbers
    console.log('Step 3: Creating certificate number sequence...');
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS hr_work_certificate_seq START 1;
    `);
    console.log('Sequence created');

    // Step 4: Create updated_at trigger
    console.log('Step 4: Creating updated_at trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_work_certificates_updated_at ON hr_work_certificates;
      CREATE TRIGGER update_hr_work_certificates_updated_at
        BEFORE UPDATE ON hr_work_certificates
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);
    console.log('Trigger created');

    // Step 5: Add permissions
    console.log('Step 5: Adding permissions...');
    const permissions = [
      {
        module: 'ressources_humaines',
        menu: 'gestion_paie',
        action: 'attestations.voir',
        code: 'ressources_humaines.gestion_paie.attestations.voir',
        label: 'Voir les attestations de travail',
        description: 'Permet de consulter les attestations de travail',
        sort_order: 100
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_paie',
        action: 'attestations.creer',
        code: 'ressources_humaines.gestion_paie.attestations.creer',
        label: 'Créer des attestations de travail',
        description: 'Permet de créer des attestations de travail',
        sort_order: 101
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_paie',
        action: 'attestations.supprimer',
        code: 'ressources_humaines.gestion_paie.attestations.supprimer',
        label: 'Supprimer des attestations de travail',
        description: 'Permet de supprimer des attestations de travail',
        sort_order: 102
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_paie',
        action: 'attestations.telecharger',
        code: 'ressources_humaines.gestion_paie.attestations.telecharger',
        label: 'Télécharger les attestations de travail',
        description: 'Permet de télécharger les PDF des attestations',
        sort_order: 103
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_paie',
        action: 'disciplinaire_vue.voir',
        code: 'ressources_humaines.gestion_paie.disciplinaire_vue.voir',
        label: 'Voir la vue disciplinaire centralisée',
        description: 'Permet de consulter les actions disciplinaires depuis Gestion de Paie',
        sort_order: 104
      }
    ];

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (code) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);
    }
    console.log(`${permissions.length} permissions added/updated`);

    // Step 6: Grant permissions to admin role
    console.log('Step 6: Granting permissions to admin role...');
    const adminRoleResult = await client.query(
      `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`
    );

    if (adminRoleResult.rows.length > 0) {
      const adminRoleId = adminRoleResult.rows[0].id;
      for (const perm of permissions) {
        const permResult = await client.query(
          `SELECT id FROM permissions WHERE code = $1`,
          [perm.code]
        );
        if (permResult.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id, granted_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [adminRoleId, permResult.rows[0].id]);
        }
      }
      console.log('Permissions granted to admin role');
    }

    await client.query('COMMIT');

    // Get summary
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hr_work_certificates'
      )
    `);

    console.log('=== Migration 157 Complete ===');

    res.json({
      success: true,
      message: 'Migration 157 completed successfully - HR Work Certificates',
      summary: {
        table_created: tableCheck.rows[0].exists,
        permissions_added: permissions.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 157 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 157 failed',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Rollback endpoint
router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Remove permissions
    const permCodes = [
      'ressources_humaines.gestion_paie.attestations.voir',
      'ressources_humaines.gestion_paie.attestations.creer',
      'ressources_humaines.gestion_paie.attestations.supprimer',
      'ressources_humaines.gestion_paie.attestations.telecharger',
      'ressources_humaines.gestion_paie.disciplinaire_vue.voir'
    ];

    for (const code of permCodes) {
      await client.query(`
        DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE code = $1)
      `, [code]);
      await client.query(`DELETE FROM permissions WHERE code = $1`, [code]);
    }

    // Drop table
    await client.query('DROP TABLE IF EXISTS hr_work_certificates CASCADE');
    await client.query('DROP SEQUENCE IF EXISTS hr_work_certificate_seq CASCADE');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 157 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Rollback failed',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hr_work_certificates'
      )
    `);

    const permResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE code LIKE 'ressources_humaines.gestion_paie.attestations.%'
    `);

    res.json({
      success: true,
      migrated: tableResult.rows[0].exists,
      table_exists: tableResult.rows[0].exists,
      permissions_count: parseInt(permResult.rows[0].count)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
