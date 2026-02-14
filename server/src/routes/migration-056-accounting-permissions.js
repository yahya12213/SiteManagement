import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 056: Repeupler toutes les permissions accounting manquantes
// Ces permissions étaient définies dans migration-040 mais sont absentes de la DB
router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 056: Repeupler permissions accounting ===');

    // Définition de TOUTES les permissions accounting (source: migration-040)
    const accountingPermissions = [
      // 1. Dashboard
      { module: 'accounting', menu: 'dashboard', action: 'view_page', code: 'accounting.dashboard.view_page', label: 'Voir le dashboard comptabilité', description: 'Accéder au tableau de bord comptabilité', sort_order: 100 },

      // 2. Segments
      { module: 'accounting', menu: 'segments', action: 'view_page', code: 'accounting.segments.view_page', label: 'Voir la page Segments', description: 'Accéder à la gestion des segments', sort_order: 200 },
      { module: 'accounting', menu: 'segments', action: 'create', code: 'accounting.segments.create', label: 'Créer un segment', description: 'Créer un nouveau segment', sort_order: 201 },
      { module: 'accounting', menu: 'segments', action: 'update', code: 'accounting.segments.update', label: 'Modifier un segment', description: 'Modifier un segment existant', sort_order: 202 },
      { module: 'accounting', menu: 'segments', action: 'delete', code: 'accounting.segments.delete', label: 'Supprimer un segment', description: 'Supprimer un segment', sort_order: 203 },

      // 3. Villes
      { module: 'accounting', menu: 'cities', action: 'view_page', code: 'accounting.cities.view_page', label: 'Voir la page Villes', description: 'Accéder à la gestion des villes', sort_order: 300 },
      { module: 'accounting', menu: 'cities', action: 'create', code: 'accounting.cities.create', label: 'Créer une ville', description: 'Créer une nouvelle ville', sort_order: 301 },
      { module: 'accounting', menu: 'cities', action: 'update', code: 'accounting.cities.update', label: 'Modifier une ville', description: 'Modifier une ville existante', sort_order: 302 },
      { module: 'accounting', menu: 'cities', action: 'delete', code: 'accounting.cities.delete', label: 'Supprimer une ville', description: 'Supprimer une ville', sort_order: 303 },

      // 4. Utilisateurs
      { module: 'accounting', menu: 'users', action: 'view_page', code: 'accounting.users.view_page', label: 'Voir la page Utilisateurs', description: 'Accéder à la gestion des utilisateurs', sort_order: 400 },
      { module: 'accounting', menu: 'users', action: 'create', code: 'accounting.users.create', label: 'Créer un utilisateur', description: 'Créer un nouvel utilisateur', sort_order: 401 },
      { module: 'accounting', menu: 'users', action: 'update', code: 'accounting.users.update', label: 'Modifier un utilisateur', description: 'Modifier un utilisateur existant', sort_order: 402 },
      { module: 'accounting', menu: 'users', action: 'delete', code: 'accounting.users.delete', label: 'Supprimer un utilisateur', description: 'Supprimer un utilisateur', sort_order: 403 },
      { module: 'accounting', menu: 'users', action: 'assign_segments', code: 'accounting.users.assign_segments', label: 'Assigner des segments', description: 'Assigner des segments à un utilisateur', sort_order: 404 },
      { module: 'accounting', menu: 'users', action: 'assign_cities', code: 'accounting.users.assign_cities', label: 'Assigner des villes', description: 'Assigner des villes à un utilisateur', sort_order: 405 },
      { module: 'accounting', menu: 'users', action: 'assign_roles', code: 'accounting.users.assign_roles', label: 'Assigner des rôles', description: 'Assigner des rôles à un utilisateur', sort_order: 406 },

      // 6. Fiches de calcul
      { module: 'accounting', menu: 'calculation_sheets', action: 'view_page', code: 'accounting.calculation_sheets.view_page', label: 'Voir la page Fiches de calcul', description: 'Accéder à la gestion des fiches de calcul', sort_order: 600 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'create', code: 'accounting.calculation_sheets.create', label: 'Créer une fiche de calcul', description: 'Créer une nouvelle fiche de calcul', sort_order: 601 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'update', code: 'accounting.calculation_sheets.update', label: 'Modifier une fiche de calcul', description: 'Modifier une fiche de calcul existante', sort_order: 602 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'delete', code: 'accounting.calculation_sheets.delete', label: 'Supprimer une fiche de calcul', description: 'Supprimer une fiche de calcul', sort_order: 603 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'publish', code: 'accounting.calculation_sheets.publish', label: 'Publier/Dépublier une fiche', description: 'Publier ou dépublier une fiche de calcul', sort_order: 604 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'duplicate', code: 'accounting.calculation_sheets.duplicate', label: 'Dupliquer une fiche', description: 'Dupliquer une fiche de calcul', sort_order: 605 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'export', code: 'accounting.calculation_sheets.export', label: 'Exporter en JSON', description: 'Exporter une fiche de calcul en JSON', sort_order: 606 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'settings', code: 'accounting.calculation_sheets.settings', label: 'Gérer les paramètres', description: 'Gérer les paramètres des fiches de calcul', sort_order: 607 },

      // 7. Créer déclaration (page dédiée)
      { module: 'accounting', menu: 'create_declaration', action: 'view_page', code: 'accounting.create_declaration.view_page', label: 'Accéder à création déclaration', description: 'Accéder à la page de création de déclaration', sort_order: 700 },

      // 8. Gérer déclarations
      { module: 'accounting', menu: 'declarations', action: 'view_page', code: 'accounting.declarations.view_page', label: 'Voir la page Déclarations', description: 'Accéder à la gestion des déclarations', sort_order: 800 },
      { module: 'accounting', menu: 'declarations', action: 'view_all', code: 'accounting.declarations.view_all', label: 'Voir TOUTES les déclarations', description: 'Voir toutes les déclarations (admin)', sort_order: 801 },
      { module: 'accounting', menu: 'declarations', action: 'create', code: 'accounting.declarations.create', label: 'Créer pour un autre professeur', description: 'Créer une déclaration pour un professeur', sort_order: 802 },
      { module: 'accounting', menu: 'declarations', action: 'update', code: 'accounting.declarations.update', label: 'Modifier une déclaration', description: 'Modifier une déclaration existante', sort_order: 803 },
      { module: 'accounting', menu: 'declarations', action: 'delete', code: 'accounting.declarations.delete', label: 'Supprimer une déclaration', description: 'Supprimer une déclaration', sort_order: 804 },
      { module: 'accounting', menu: 'declarations', action: 'approve', code: 'accounting.declarations.approve', label: 'Approuver une déclaration', description: 'Approuver une déclaration', sort_order: 805 },
      { module: 'accounting', menu: 'declarations', action: 'reject', code: 'accounting.declarations.reject', label: 'Rejeter une déclaration', description: 'Rejeter une déclaration', sort_order: 806 },
      { module: 'accounting', menu: 'declarations', action: 'request_modification', code: 'accounting.declarations.request_modification', label: 'Demander modification', description: 'Demander une modification de déclaration', sort_order: 807 },
    ];

    console.log(`Inserting ${accountingPermissions.length} accounting permissions...`);

    let insertedCount = 0;
    let existingCount = 0;

    for (const perm of accountingPermissions) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rowCount > 0) {
        console.log(`  ✓ Added: ${perm.code}`);
        insertedCount++;
      } else {
        console.log(`  - Already exists: ${perm.code}`);
        existingCount++;
      }
    }

    console.log(`\nInsertion summary: ${insertedCount} new, ${existingCount} existing`);

    // Assigner toutes les permissions accounting à admin et gerant
    console.log('\nAssigning accounting permissions to admin and gerant roles...');

    const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    const gerantRole = await client.query(`SELECT id FROM roles WHERE name = 'gerant' LIMIT 1`);

    const allAccountingCodes = accountingPermissions.map(p => p.code);

    for (const code of allAccountingCodes) {
      const permResult = await client.query(`SELECT id FROM permissions WHERE code = $1`, [code]);
      if (permResult.rows.length > 0) {
        const permId = permResult.rows[0].id;

        // Assign to admin
        if (adminRole.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [adminRole.rows[0].id, permId]);
        }

        // Assign to gerant (except role management and user deletion)
        if (gerantRole.rows.length > 0 && !code.includes('roles.') && code !== 'accounting.users.delete') {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [gerantRole.rows[0].id, permId]);
        }
      }
    }

    console.log('  Permissions assigned to admin and gerant roles');

    await client.query('COMMIT');

    console.log('\n=== Migration 056 completed successfully! ===');
    console.log(`Summary:`);
    console.log(`  - Inserted ${insertedCount} new permissions`);
    console.log(`  - Found ${existingCount} existing permissions`);
    console.log(`  - Total accounting permissions: ${accountingPermissions.length}`);

    res.json({
      success: true,
      message: 'Migration 056 executed successfully',
      details: {
        inserted: insertedCount,
        existing: existingCount,
        total: accountingPermissions.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 056 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// GET endpoint to check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check critical permissions
    const calculationSheetsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'accounting.calculation_sheets.view_page'
    `);

    const declarationsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'accounting.declarations.view_page'
    `);

    const segmentsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'accounting.segments.view_page'
    `);

    const citiesCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'accounting.cities.view_page'
    `);

    const usersCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'accounting.users.view_page'
    `);

    const totalAccountingCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE module = 'accounting'
    `);

    const status = {
      calculationSheetsExists: parseInt(calculationSheetsCheck.rows[0].count) > 0,
      declarationsExists: parseInt(declarationsCheck.rows[0].count) > 0,
      segmentsExists: parseInt(segmentsCheck.rows[0].count) > 0,
      citiesExists: parseInt(citiesCheck.rows[0].count) > 0,
      usersExists: parseInt(usersCheck.rows[0].count) > 0,
      totalAccountingPermissions: parseInt(totalAccountingCheck.rows[0].count),
      expectedTotal: 36,
      migrationNeeded: parseInt(calculationSheetsCheck.rows[0].count) === 0
    };

    res.json({
      success: true,
      status,
      message: status.migrationNeeded ?
        'Migration 056 needs to be run - accounting permissions are missing' :
        'Migration 056 already applied'
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
