/**
 * Migration FIX: Synchroniser role_id de "khalid fathi" avec le rôle gérant
 * Corrige le problème où l'utilisateur a role='gerant' mais role_id pointe vers 'professor'
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration FIX: Synchroniser role_id de khalid fathi ===');

    // 1. Trouver le rôle gérant
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) = 'gerant'
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Rôle gérant introuvable dans la table roles'
      });
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    console.log(`✓ Rôle gérant trouvé: ${gerantRoleId}`);

    // 2. Trouver l'utilisateur "khalid fathi"
    const userResult = await client.query(`
      SELECT id, username, role, role_id
      FROM profiles
      WHERE username = 'khalid fathi'
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Utilisateur "khalid fathi" introuvable'
      });
    }

    const user = userResult.rows[0];
    console.log(`✓ Utilisateur trouvé: ${user.username}`);
    console.log(`  - role (texte): ${user.role}`);
    console.log(`  - role_id (avant): ${user.role_id}`);

    // 3. Mettre à jour le role_id
    await client.query(`
      UPDATE profiles
      SET role_id = $1
      WHERE username = 'khalid fathi'
    `, [gerantRoleId]);

    console.log(`✓ role_id mis à jour vers: ${gerantRoleId}`);

    // 4. Vérifier la mise à jour
    const verifyResult = await client.query(`
      SELECT p.id, p.username, p.role, p.role_id, r.name as role_name_from_id
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.username = 'khalid fathi'
    `);

    const updatedUser = verifyResult.rows[0];
    console.log('\n✅ Vérification après mise à jour:');
    console.log(`  - username: ${updatedUser.username}`);
    console.log(`  - role (texte): ${updatedUser.role}`);
    console.log(`  - role_id: ${updatedUser.role_id}`);
    console.log(`  - rôle via role_id: ${updatedUser.role_name_from_id}`);

    // 5. Vérifier les permissions
    const permCountResult = await client.query(`
      SELECT COUNT(*) as count
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);

    const permCount = parseInt(permCountResult.rows[0].count);
    console.log(`\n📊 Permissions du rôle gérant: ${permCount}`);

    await client.query('COMMIT');

    console.log('\n✅ Migration FIX terminée avec succès!');
    console.log('L\'utilisateur "khalid fathi" doit se déconnecter et se reconnecter.');

    res.json({
      success: true,
      message: 'role_id de "khalid fathi" synchronisé avec le rôle gérant',
      user: {
        username: updatedUser.username,
        role: updatedUser.role,
        role_id: updatedUser.role_id,
        role_name_from_id: updatedUser.role_name_from_id
      },
      permissions_count: permCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration FIX failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Check if khalid fathi exists and if role_id matches gerant role
    const checkResult = await pool.query(`
      SELECT
        p.username,
        p.role,
        p.role_id,
        r.name as role_name_from_id,
        CASE
          WHEN p.role = 'gerant' AND r.name = 'gerant' THEN true
          ELSE false
        END as is_synchronized
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.username = 'khalid fathi'
    `);

    if (checkResult.rows.length === 0) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'User "khalid fathi" not found'
      });
    }

    const user = checkResult.rows[0];
    const needsFix = !user.is_synchronized;

    res.json({
      status: {
        migrationNeeded: needsFix,
        applied: !needsFix,
        user: {
          username: user.username,
          role_text: user.role,
          role_id_points_to: user.role_name_from_id,
          is_synchronized: user.is_synchronized
        }
      },
      message: needsFix
        ? `FIX needed - role_id points to "${user.role_name_from_id}" but role text is "${user.role}"`
        : 'role_id is correctly synchronized with role text'
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
