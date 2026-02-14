import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 111: Nettoyer les permissions dupliquées
// Cette migration:
// 1. Identifie les permissions avec le même code
// 2. Garde la permission avec l'ID le plus bas
// 3. Migre les role_permissions vers la permission conservée
// 4. Supprime les doublons

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 111: Nettoyage des permissions dupliquées ===');

    // Étape 1: Identifier tous les doublons (même code, plusieurs IDs)
    const duplicatesResult = await client.query(`
      SELECT code, array_agg(id ORDER BY id) as ids, COUNT(*) as count
      FROM permissions
      GROUP BY code
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`\nTrouvé ${duplicatesResult.rows.length} codes avec doublons`);

    let migratedRolePermissions = 0;
    let deletedPermissions = 0;

    for (const row of duplicatesResult.rows) {
      const code = row.code;
      const ids = row.ids; // Array d'IDs, trié par ordre croissant
      const keepId = ids[0]; // Garder l'ID le plus bas
      const deleteIds = ids.slice(1); // Supprimer les autres

      console.log(`\n📋 Code: ${code}`);
      console.log(`   ✅ Garder ID: ${keepId}`);
      console.log(`   🗑️ Supprimer IDs: ${deleteIds.join(', ')}`);

      // Étape 2: Migrer les role_permissions des doublons vers la permission conservée
      for (const deleteId of deleteIds) {
        // Vérifier si des role_permissions pointent vers ce doublon
        const rpCheck = await client.query(
          'SELECT COUNT(*) FROM role_permissions WHERE permission_id = $1',
          [deleteId]
        );
        const rpCount = parseInt(rpCheck.rows[0].count);

        if (rpCount > 0) {
          // Migrer les role_permissions vers la permission conservée
          // Utiliser ON CONFLICT pour éviter les doublons dans role_permissions
          await client.query(`
            UPDATE role_permissions
            SET permission_id = $1
            WHERE permission_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM role_permissions
              WHERE role_id = role_permissions.role_id
              AND permission_id = $1
            )
          `, [keepId, deleteId]);

          // Supprimer les role_permissions qui créeraient des doublons
          await client.query(`
            DELETE FROM role_permissions
            WHERE permission_id = $2
          `, [keepId, deleteId]);

          console.log(`   ↪️ Migré ${rpCount} role_permissions de ID ${deleteId} vers ID ${keepId}`);
          migratedRolePermissions += rpCount;
        }
      }

      // Étape 3: Supprimer les doublons
      for (const deleteId of deleteIds) {
        await client.query('DELETE FROM permissions WHERE id = $1', [deleteId]);
        deletedPermissions++;
      }
    }

    // Étape 4: Nettoyer les permissions orphelines (sans code valide)
    const orphanResult = await client.query(`
      DELETE FROM permissions
      WHERE code IS NULL OR code = '' OR code LIKE '%undefined%'
      RETURNING id, code
    `);

    if (orphanResult.rows.length > 0) {
      console.log(`\n🧹 Supprimé ${orphanResult.rows.length} permissions orphelines/invalides`);
      deletedPermissions += orphanResult.rows.length;
    }

    // Compter les permissions restantes
    const countResult = await client.query('SELECT COUNT(*) FROM permissions');
    const remainingCount = parseInt(countResult.rows[0].count);

    await client.query('COMMIT');

    console.log('\n=== Migration 111 terminée ===');
    console.log(`✅ Role_permissions migrés: ${migratedRolePermissions}`);
    console.log(`🗑️ Permissions supprimées: ${deletedPermissions}`);
    console.log(`📊 Permissions restantes: ${remainingCount}`);

    res.json({
      success: true,
      message: 'Migration 111 exécutée avec succès',
      stats: {
        duplicateCodes: duplicatesResult.rows.length,
        migratedRolePermissions,
        deletedPermissions,
        remainingPermissions: remainingCount
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur Migration 111:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Route de status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    // Vérifier s'il reste des doublons
    const duplicatesResult = await client.query(`
      SELECT COUNT(*) as duplicate_codes
      FROM (
        SELECT code
        FROM permissions
        GROUP BY code
        HAVING COUNT(*) > 1
      ) as duplicates
    `);

    const duplicateCount = parseInt(duplicatesResult.rows[0].duplicate_codes);
    const totalResult = await client.query('SELECT COUNT(*) FROM permissions');
    const totalCount = parseInt(totalResult.rows[0].count);

    const needsMigration = duplicateCount > 0;

    res.json({
      success: true,
      applied: !needsMigration,
      status: {
        migrationNeeded: needsMigration,
        duplicateCodes: duplicateCount,
        totalPermissions: totalCount
      },
      message: needsMigration
        ? `${duplicateCount} codes dupliqués trouvés - Migration recommandée`
        : `Aucun doublon - ${totalCount} permissions uniques`
    });

  } catch (error) {
    console.error('Erreur status Migration 111:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Route de preview (sans modifications)
router.get('/preview', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    // Identifier tous les doublons
    const duplicatesResult = await client.query(`
      SELECT
        code,
        array_agg(id ORDER BY id) as ids,
        array_agg(module ORDER BY id) as modules,
        array_agg(label ORDER BY id) as labels,
        COUNT(*) as count
      FROM permissions
      GROUP BY code
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    const totalPermissions = await client.query('SELECT COUNT(*) FROM permissions');

    // Calculer combien seront supprimées
    let toDelete = 0;
    duplicatesResult.rows.forEach(row => {
      toDelete += (row.count - 1); // Garder 1, supprimer le reste
    });

    res.json({
      success: true,
      preview: {
        totalPermissions: parseInt(totalPermissions.rows[0].count),
        duplicateCodes: duplicatesResult.rows.length,
        permissionsToDelete: toDelete,
        remainingAfterCleanup: parseInt(totalPermissions.rows[0].count) - toDelete,
        duplicates: duplicatesResult.rows.map(row => ({
          code: row.code,
          ids: row.ids,
          modules: row.modules,
          labels: row.labels,
          count: row.count,
          keepId: row.ids[0],
          deleteIds: row.ids.slice(1)
        }))
      }
    });

  } catch (error) {
    console.error('Erreur preview Migration 111:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
