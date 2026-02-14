import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

/**
 * Migration 058: Synchroniser les permissions manquantes entre frontend et backend
 *
 * Permissions ajoutées:
 * - accounting.declarations.submit (Soumettre une déclaration)
 * - accounting.cities.bulk_delete (Suppression en masse de villes)
 * - training.corps.duplicate (Dupliquer un corps de formation)
 */

/**
 * GET /api/migration-058/status
 * Vérifier si la migration 058 est nécessaire
 */
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    // Liste des permissions de cette migration
    const permissionCodes = [
      'accounting.declarations.submit',
      'accounting.cities.bulk_delete',
      'training.corps.duplicate'
    ];

    // Vérifier chaque permission
    const permissionsStatus = {};
    let missingCount = 0;

    for (const code of permissionCodes) {
      const result = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [code]
      );
      const exists = result.rows.length > 0;
      permissionsStatus[code] = { exists };
      if (!exists) missingCount++;
    }

    const migrationNeeded = missingCount > 0;

    res.json({
      success: true,
      status: {
        migrationNeeded,
        permissionsStatus,
        missingCount,
        totalChecked: permissionCodes.length
      },
      message: migrationNeeded
        ? `Migration needed: ${missingCount} permission(s) missing`
        : 'Migration 058 already applied'
    });

  } catch (error) {
    console.error('Error checking migration 058 status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check migration status',
      details: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 058: Synchroniser permissions manquantes ===');

    // Définition des permissions manquantes
    const missingPermissions = [
      // Accounting - Déclarations
      {
        module: 'accounting',
        menu: 'declarations',
        action: 'submit',
        code: 'accounting.declarations.submit',
        label: 'Soumettre une déclaration',
        description: 'Soumettre une déclaration pour validation',
        sort_order: 808
      },

      // Accounting - Villes (bulk delete manquante dans migration-056)
      {
        module: 'accounting',
        menu: 'cities',
        action: 'bulk_delete',
        code: 'accounting.cities.bulk_delete',
        label: 'Suppression en masse de villes',
        description: 'Supprimer plusieurs villes en une seule opération',
        sort_order: 304
      },

      // Training - Corps de Formation
      {
        module: 'training',
        menu: 'corps',
        action: 'duplicate',
        code: 'training.corps.duplicate',
        label: 'Dupliquer un corps de formation',
        description: 'Créer une copie d\'un corps de formation existant',
        sort_order: 284
      },
    ];

    console.log(`Inserting ${missingPermissions.length} missing permissions...`);

    let insertedCount = 0;
    let existingCount = 0;

    for (const perm of missingPermissions) {
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

    // Assigner les nouvelles permissions aux rôles appropriés
    console.log('\nAssigning new permissions to roles...');

    const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    const gerantRole = await client.query(`SELECT id FROM roles WHERE name = 'gerant' LIMIT 1`);

    for (const perm of missingPermissions) {
      const permResult = await client.query(`SELECT id FROM permissions WHERE code = $1`, [perm.code]);
      if (permResult.rows.length > 0) {
        const permId = permResult.rows[0].id;

        // Assign to admin (all permissions)
        if (adminRole.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [adminRole.rows[0].id, permId]);
          console.log(`  ✓ Assigned ${perm.code} to admin`);
        }

        // Assign to gerant (all except sensitive operations)
        if (gerantRole.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [gerantRole.rows[0].id, permId]);
          console.log(`  ✓ Assigned ${perm.code} to gerant`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Migration 058 completed successfully! ===');
    console.log(`Summary:`);
    console.log(`  - Inserted ${insertedCount} new permissions`);
    console.log(`  - Found ${existingCount} existing permissions`);
    console.log(`  - Total new permissions: ${missingPermissions.length}`);

    res.json({
      success: true,
      message: 'Migration 058 executed successfully',
      details: {
        inserted: insertedCount,
        existing: existingCount,
        total: missingPermissions.length,
        permissions: missingPermissions.map(p => p.code)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 058 failed:', error);

    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
