import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Migration pour synchroniser profiles.role_id avec profiles.role
// Corrige le problème où les utilisateurs ont role (texte) mais role_id NULL

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔧 Début de la migration: Synchronisation role ↔ role_id...');

    await client.query('BEGIN');

    // 1. Vérifier l'état actuel
    const statusCheck = await client.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(role_id) as users_with_role_id,
        COUNT(*) FILTER (WHERE role_id IS NULL) as users_without_role_id
      FROM profiles
    `);

    console.log('📊 État actuel:');
    console.log(`  - Total utilisateurs: ${statusCheck.rows[0].total_users}`);
    console.log(`  - Avec role_id: ${statusCheck.rows[0].users_with_role_id}`);
    console.log(`  - Sans role_id: ${statusCheck.rows[0].users_without_role_id}`);

    // 2. Lister les utilisateurs problématiques
    const problematicUsers = await client.query(`
      SELECT id, username, full_name, role, role_id
      FROM profiles
      WHERE role_id IS NULL AND role IS NOT NULL
      ORDER BY username
    `);

    if (problematicUsers.rows.length > 0) {
      console.log(`\n⚠️  ${problematicUsers.rows.length} utilisateur(s) avec role_id NULL:`);
      problematicUsers.rows.forEach(user => {
        console.log(`  - ${user.username} (${user.full_name}): role="${user.role}"`);
      });
    }

    // 3. Synchroniser role_id basé sur role (texte)
    console.log('\n🔄 Synchronisation role_id avec role...');

    const syncResult = await client.query(`
      UPDATE profiles p
      SET role_id = r.id
      FROM roles r
      WHERE p.role = r.name
        AND p.role_id IS NULL
      RETURNING p.id, p.username, p.role, r.name as role_name, r.id as new_role_id
    `);

    if (syncResult.rows.length > 0) {
      console.log(`\n✅ ${syncResult.rows.length} utilisateur(s) synchronisé(s):`);
      syncResult.rows.forEach(user => {
        console.log(`  - ${user.username}: role="${user.role}" → role_id=${user.new_role_id}`);
      });
    } else {
      console.log('\n✓ Aucune synchronisation nécessaire (tous les utilisateurs sont déjà à jour)');
    }

    // 4. Vérifier les rôles qui n'existent pas dans la table roles
    const unmatchedRoles = await client.query(`
      SELECT DISTINCT p.role
      FROM profiles p
      LEFT JOIN roles r ON p.role = r.name
      WHERE p.role IS NOT NULL AND r.id IS NULL
    `);

    if (unmatchedRoles.rows.length > 0) {
      console.log(`\n⚠️  Attention: ${unmatchedRoles.rows.length} rôle(s) dans profiles sans correspondance dans la table roles:`);
      unmatchedRoles.rows.forEach(row => {
        console.log(`  - "${row.role}" (il faut créer ce rôle dans la table roles)`);
      });
    }

    // 5. Vérification finale
    const finalCheck = await client.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(role_id) as users_with_role_id,
        COUNT(*) FILTER (WHERE role_id IS NULL) as users_without_role_id
      FROM profiles
    `);

    console.log('\n📊 État après synchronisation:');
    console.log(`  - Total utilisateurs: ${finalCheck.rows[0].total_users}`);
    console.log(`  - Avec role_id: ${finalCheck.rows[0].users_with_role_id}`);
    console.log(`  - Sans role_id: ${finalCheck.rows[0].users_without_role_id}`);

    // 6. Afficher les permissions maintenant disponibles pour chaque utilisateur
    if (syncResult.rows.length > 0) {
      console.log('\n🔑 Permissions chargées pour les utilisateurs synchronisés:');
      for (const user of syncResult.rows) {
        const perms = await client.query(`
          SELECT COUNT(DISTINCT p.code) as perm_count
          FROM permissions p
          INNER JOIN role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = $1
        `, [user.new_role_id]);

        console.log(`  - ${user.username}: ${perms.rows[0].perm_count} permission(s)`);
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Migration terminée avec succès!');
    console.log('Les utilisateurs peuvent maintenant se reconnecter pour charger leurs permissions.');

    res.json({
      success: true,
      message: 'Synchronisation role ↔ role_id terminée avec succès',
      synchronized: syncResult.rows.length,
      details: {
        before: {
          total: statusCheck.rows[0].total_users,
          withRoleId: statusCheck.rows[0].users_with_role_id,
          withoutRoleId: statusCheck.rows[0].users_without_role_id
        },
        after: {
          total: finalCheck.rows[0].total_users,
          withRoleId: finalCheck.rows[0].users_with_role_id,
          withoutRoleId: finalCheck.rows[0].users_without_role_id
        },
        users: syncResult.rows.map(u => ({
          username: u.username,
          role: u.role,
          role_id: u.new_role_id
        }))
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// Endpoint pour vérifier l'état de synchronisation
router.get('/status', async (req, res) => {
  const client = await pool.connect();

  try {
    // État de synchronisation
    const syncStatus = await client.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(role_id) as users_with_role_id,
        COUNT(*) FILTER (WHERE role_id IS NULL) as users_without_role_id,
        COUNT(*) FILTER (WHERE role IS NOT NULL AND role_id IS NULL) as need_sync
      FROM profiles
    `);

    // Liste des utilisateurs non synchronisés
    const unsyncedUsers = await client.query(`
      SELECT username, full_name, role
      FROM profiles
      WHERE role IS NOT NULL AND role_id IS NULL
      ORDER BY username
    `);

    // Liste des rôles disponibles
    const availableRoles = await client.query(`
      SELECT name, description,
        (SELECT COUNT(*) FROM profiles WHERE role_id = roles.id) as user_count
      FROM roles
      ORDER BY name
    `);

    res.json({
      status: 'ok',
      syncStatus: {
        totalUsers: parseInt(syncStatus.rows[0].total_users),
        usersWithRoleId: parseInt(syncStatus.rows[0].users_with_role_id),
        usersWithoutRoleId: parseInt(syncStatus.rows[0].users_without_role_id),
        needsSync: parseInt(syncStatus.rows[0].need_sync)
      },
      unsyncedUsers: unsyncedUsers.rows,
      availableRoles: availableRoles.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
