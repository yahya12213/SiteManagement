import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Migration pour corriger les permissions du rôle impression
// Le rôle impression a besoin de lire les segments et villes pour créer des déclarations

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔧 Début de la migration: Fix impression role permissions...');

    await client.query('BEGIN');

    // 1. Vérifier que le rôle impression existe
    const impressionRole = await client.query(
      "SELECT id FROM roles WHERE name = 'impression'"
    );

    if (impressionRole.rows.length === 0) {
      console.log('⚠️ Le rôle impression n\'existe pas');
      await client.query('ROLLBACK');
      return res.json({
        success: false,
        message: 'Le rôle impression n\'existe pas'
      });
    }

    const roleId = impressionRole.rows[0].id;
    console.log(`✓ Rôle impression trouvé avec ID: ${roleId}`);

    // 2. Ajouter les permissions manquantes pour segments et cities
    const permissionsToAdd = [
      { code: 'accounting.segments.view_page', module: 'accounting', menu: 'segments', action: 'view_page', label: 'Voir la page Segments' },
      { code: 'accounting.cities.view_page', module: 'accounting', menu: 'cities', action: 'view_page', label: 'Voir la page Villes' }
    ];

    for (const permission of permissionsToAdd) {
      // Vérifier que la permission existe
      const permExists = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [permission.code]
      );

      if (permExists.rows.length === 0) {
        console.log(`⚠️ Permission ${permission.code} n'existe pas, création...`);

        // Créer la permission
        await client.query(
          'INSERT INTO permissions (code, module, menu, action, label) VALUES ($1, $2, $3, $4, $5)',
          [permission.code, permission.module, permission.menu, permission.action, permission.label]
        );
        console.log(`✓ Permission ${permission.code} créée`);
      }

      // Vérifier si l'association existe déjà
      const assocExists = await client.query(
        `SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1 AND p.code = $2`,
        [roleId, permission.code]
      );

      if (assocExists.rows.length === 0) {
        // Ajouter la permission au rôle
        const perm = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [permission.code]
        );

        if (perm.rows.length > 0) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [roleId, perm.rows[0].id]
          );
          console.log(`✓ Permission ${permission.code} ajoutée au rôle impression`);
        }
      } else {
        console.log(`✓ Permission ${permission.code} déjà présente pour le rôle impression`);
      }
    }

    // 3. Vérifier les permissions finales
    const finalPerms = await client.query(
      `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.code`,
      [roleId]
    );

    console.log('\n📋 Permissions finales pour le rôle impression:');
    finalPerms.rows.forEach(row => {
      console.log(`  - ${row.code}`);
    });

    await client.query('COMMIT');

    console.log('\n✅ Migration terminée avec succès!');
    console.log('Le rôle impression peut maintenant:');
    console.log('  - Voir les segments (lecture seule)');
    console.log('  - Voir les villes (lecture seule)');
    console.log('  - Créer des déclarations pour les professeurs');

    res.json({
      success: true,
      message: 'Permissions du rôle impression corrigées avec succès',
      permissions: finalPerms.rows.map(r => r.code)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Endpoint pour vérifier les permissions actuelles du rôle impression
router.get('/check', async (req, res) => {
  const client = await pool.connect();

  try {
    // Récupérer les permissions actuelles du rôle impression
    const result = await client.query(
      `SELECT p.code, p.module, p.menu, p.action, p.label
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'impression'
       ORDER BY p.code`
    );

    res.json({
      role: 'impression',
      permissions: result.rows,
      hasSegmentsAccess: result.rows.some(p => p.code === 'accounting.segments.view_page'),
      hasCitiesAccess: result.rows.some(p => p.code === 'accounting.cities.view_page')
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;