import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 053: Add Commercialisation Module Permissions
// Creates complete permission set for the commercialisation module

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 053: Add Commercialisation Module Permissions ===');

    // Complete permission set for commercialisation module (hierarchical structure: module.menu.action)
    const commercialisationPermissions = [
      // Dashboard permissions
      { module: 'commercialisation', menu: 'dashboard', action: 'view_page', code: 'commercialisation.dashboard.view_page', label: 'Voir Tableau de bord Commercialisation', description: 'Accéder au tableau de bord commercialisation' },
      { module: 'commercialisation', menu: 'dashboard', action: 'view_stats', code: 'commercialisation.dashboard.view_stats', label: 'Voir statistiques', description: 'Voir les statistiques commerciales' },
      { module: 'commercialisation', menu: 'dashboard', action: 'export', code: 'commercialisation.dashboard.export', label: 'Exporter statistiques', description: 'Exporter les données du dashboard' },

      // Clients permissions
      { module: 'commercialisation', menu: 'clients', action: 'view_page', code: 'commercialisation.clients.view_page', label: 'Voir page Clients', description: 'Accéder à la page de gestion des clients' },
      { module: 'commercialisation', menu: 'clients', action: 'view', code: 'commercialisation.clients.view', label: 'Voir clients', description: 'Consulter la liste des clients' },
      { module: 'commercialisation', menu: 'clients', action: 'create', code: 'commercialisation.clients.create', label: 'Créer client', description: 'Créer un nouveau client' },
      { module: 'commercialisation', menu: 'clients', action: 'edit', code: 'commercialisation.clients.edit', label: 'Modifier client', description: 'Modifier les informations d\'un client' },
      { module: 'commercialisation', menu: 'clients', action: 'delete', code: 'commercialisation.clients.delete', label: 'Supprimer client', description: 'Supprimer un client' },
      { module: 'commercialisation', menu: 'clients', action: 'export', code: 'commercialisation.clients.export', label: 'Exporter clients', description: 'Exporter la liste des clients' },

      // Prospects permissions
      { module: 'commercialisation', menu: 'prospects', action: 'view_page', code: 'commercialisation.prospects.view_page', label: 'Voir page Prospects', description: 'Accéder à la page de gestion des prospects' },
      { module: 'commercialisation', menu: 'prospects', action: 'view', code: 'commercialisation.prospects.view', label: 'Voir prospects', description: 'Consulter la liste des prospects' },
      { module: 'commercialisation', menu: 'prospects', action: 'create', code: 'commercialisation.prospects.create', label: 'Créer prospect', description: 'Créer un nouveau prospect' },
      { module: 'commercialisation', menu: 'prospects', action: 'edit', code: 'commercialisation.prospects.edit', label: 'Modifier prospect', description: 'Modifier les informations d\'un prospect' },
      { module: 'commercialisation', menu: 'prospects', action: 'delete', code: 'commercialisation.prospects.delete', label: 'Supprimer prospect', description: 'Supprimer un prospect' },
      { module: 'commercialisation', menu: 'prospects', action: 'convert', code: 'commercialisation.prospects.convert', label: 'Convertir prospect', description: 'Convertir un prospect en client' },
      { module: 'commercialisation', menu: 'prospects', action: 'export', code: 'commercialisation.prospects.export', label: 'Exporter prospects', description: 'Exporter la liste des prospects' },

      // Devis (Quotes) permissions
      { module: 'commercialisation', menu: 'devis', action: 'view_page', code: 'commercialisation.devis.view_page', label: 'Voir page Devis', description: 'Accéder à la page de gestion des devis' },
      { module: 'commercialisation', menu: 'devis', action: 'view', code: 'commercialisation.devis.view', label: 'Voir devis', description: 'Consulter la liste des devis' },
      { module: 'commercialisation', menu: 'devis', action: 'create', code: 'commercialisation.devis.create', label: 'Créer devis', description: 'Créer un nouveau devis' },
      { module: 'commercialisation', menu: 'devis', action: 'edit', code: 'commercialisation.devis.edit', label: 'Modifier devis', description: 'Modifier un devis existant' },
      { module: 'commercialisation', menu: 'devis', action: 'delete', code: 'commercialisation.devis.delete', label: 'Supprimer devis', description: 'Supprimer un devis' },
      { module: 'commercialisation', menu: 'devis', action: 'validate', code: 'commercialisation.devis.validate', label: 'Valider devis', description: 'Valider et approuver un devis' },
      { module: 'commercialisation', menu: 'devis', action: 'send', code: 'commercialisation.devis.send', label: 'Envoyer devis', description: 'Envoyer un devis au client' },
      { module: 'commercialisation', menu: 'devis', action: 'export', code: 'commercialisation.devis.export', label: 'Exporter devis', description: 'Exporter un devis en PDF' },

      // Contrats (Contracts) permissions
      { module: 'commercialisation', menu: 'contrats', action: 'view_page', code: 'commercialisation.contrats.view_page', label: 'Voir page Contrats', description: 'Accéder à la page de gestion des contrats' },
      { module: 'commercialisation', menu: 'contrats', action: 'view', code: 'commercialisation.contrats.view', label: 'Voir contrats', description: 'Consulter la liste des contrats' },
      { module: 'commercialisation', menu: 'contrats', action: 'create', code: 'commercialisation.contrats.create', label: 'Créer contrat', description: 'Créer un nouveau contrat' },
      { module: 'commercialisation', menu: 'contrats', action: 'edit', code: 'commercialisation.contrats.edit', label: 'Modifier contrat', description: 'Modifier un contrat existant' },
      { module: 'commercialisation', menu: 'contrats', action: 'delete', code: 'commercialisation.contrats.delete', label: 'Supprimer contrat', description: 'Supprimer un contrat' },
      { module: 'commercialisation', menu: 'contrats', action: 'sign', code: 'commercialisation.contrats.sign', label: 'Signer contrat', description: 'Signer et finaliser un contrat' },
      { module: 'commercialisation', menu: 'contrats', action: 'archive', code: 'commercialisation.contrats.archive', label: 'Archiver contrat', description: 'Archiver un contrat terminé' },
      { module: 'commercialisation', menu: 'contrats', action: 'export', code: 'commercialisation.contrats.export', label: 'Exporter contrat', description: 'Exporter un contrat en PDF' },
    ];

    console.log(`Adding ${commercialisationPermissions.length} commercialisation permissions...`);

    for (const perm of commercialisationPermissions) {
      // Check if permission already exists
      const checkExisting = await client.query(`
        SELECT id FROM permissions WHERE code = $1
      `, [perm.code]);

      if (checkExisting.rows.length === 0) {
        // Insert permission using hierarchical structure
        await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
        `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description]);
        console.log(`  ✓ Added: ${perm.code}`);
      } else {
        console.log(`  - Already exists: ${perm.code}`);
      }
    }

    // Automatically assign all commercialisation permissions to admin role
    console.log('Assigning commercialisation permissions to admin role...');

    const adminRoleQuery = await client.query(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
    `);

    if (adminRoleQuery.rows.length > 0) {
      const adminRoleId = adminRoleQuery.rows[0].id;
      let assignedCount = 0;

      for (const perm of commercialisationPermissions) {
        const permQuery = await client.query(`
          SELECT id FROM permissions WHERE code = $1
        `, [perm.code]);

        if (permQuery.rows.length > 0) {
          const permId = permQuery.rows[0].id;

          // Check if already assigned
          const checkAssignment = await client.query(`
            SELECT 1 FROM role_permissions
            WHERE role_id = $1 AND permission_id = $2
          `, [adminRoleId, permId]);

          if (checkAssignment.rows.length === 0) {
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
            `, [adminRoleId, permId]);
            assignedCount++;
          }
        }
      }

      console.log(`  ✓ Assigned ${assignedCount} permissions to admin role`);
    }

    // Also assign to gérant role if it exists
    console.log('Checking for gérant role...');

    const gerantRoleQuery = await client.query(`
      SELECT id FROM roles WHERE name = 'gerant' LIMIT 1
    `);

    if (gerantRoleQuery.rows.length > 0) {
      const gerantRoleId = gerantRoleQuery.rows[0].id;
      let assignedCount = 0;

      console.log('Assigning commercialisation permissions to gérant role...');

      for (const perm of commercialisationPermissions) {
        const permQuery = await client.query(`
          SELECT id FROM permissions WHERE code = $1
        `, [perm.code]);

        if (permQuery.rows.length > 0) {
          const permId = permQuery.rows[0].id;

          // Check if already assigned
          const checkAssignment = await client.query(`
            SELECT 1 FROM role_permissions
            WHERE role_id = $1 AND permission_id = $2
          `, [gerantRoleId, permId]);

          if (checkAssignment.rows.length === 0) {
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
            `, [gerantRoleId, permId]);
            assignedCount++;
          }
        }
      }

      console.log(`  ✓ Assigned ${assignedCount} permissions to gérant role`);
    } else {
      console.log('  - No gérant role found, skipping');
    }

    await client.query('COMMIT');

    console.log('✅ Migration 053 completed successfully!');
    console.log(`Created ${commercialisationPermissions.length} commercialisation permissions`);

    res.json({
      success: true,
      message: 'Migration 053 completed - Commercialisation permissions created',
      permissionsCreated: commercialisationPermissions.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 053 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE module = 'commercialisation'
    `);

    const commercialisationPermsCount = parseInt(result.rows[0].count);
    const expectedCount = 33; // Total permissions we should have

    res.json({
      status: 'ok',
      commercialisationPermissions: {
        existing: commercialisationPermsCount,
        expected: expectedCount,
        isMigrated: commercialisationPermsCount >= expectedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
