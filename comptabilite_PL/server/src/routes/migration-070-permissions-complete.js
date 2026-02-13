/**
 * Migration 070: Structure de Permissions Complète avec Labels/Descriptions FR
 *
 * Objectifs :
 * 1. Ajouter toutes les permissions manquantes depuis PERMISSIONS_MASTER
 * 2. Compléter les labels/descriptions manquants pour les permissions existantes
 * 3. Créer les alias pour compatibilité (.edit vs .update)
 * 4. Migrer les permissions professor.* vers training.declarations.*
 *
 * Total attendu : ~250+ permissions avec labels et descriptions complets
 */

import express from 'express';
import pool from '../config/database.js';
import { PERMISSIONS_MASTER } from '../config/permissions-master.js';

const router = express.Router();

// Mapping des renommages avec alias (Option B : garder les deux)
const PERMISSION_ALIASES = [
  {
    old: 'accounting.calculation_sheets.update',
    new: 'accounting.calculation_sheets.edit',
    label: 'Éditer le contenu',
    description: 'Permet d\'éditer les cellules et formules de la fiche'
  }
];

// Migration des permissions professor.* vers training.declarations.*
const PROFESSOR_MIGRATIONS = [
  {
    old: 'professor.view_my_declarations',
    new: 'training.declarations.view_own',
    label: 'Voir mes déclarations',
    description: 'Permet au professeur de consulter ses propres déclarations'
  },
  {
    old: 'professor.fill_declaration',
    new: 'training.declarations.fill_own',
    label: 'Remplir ma déclaration',
    description: 'Permet au professeur de remplir sa propre déclaration'
  }
];

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 070: Permissions Complètes ===');

    const stats = {
      added: 0,
      updated: 0,
      unchanged: 0,
      aliased: 0,
      migrated: 0,
      errors: [],
      details: {
        added_permissions: [],
        updated_permissions: [],
        aliased_permissions: [],
        migrated_permissions: []
      }
    };

    // ============================================================
    // ÉTAPE 1 : Ajouter/Mettre à jour toutes les permissions du master
    // ============================================================
    console.log('Step 1: Processing permissions from PERMISSIONS_MASTER...');

    for (const [moduleName, module] of Object.entries(PERMISSIONS_MASTER)) {
      for (const [menuName, actions] of Object.entries(module)) {
        for (const action of actions) {
          const code = `${moduleName}.${menuName}.${action.action}`;

          try {
            // Vérifier si la permission existe déjà
            const existing = await client.query(
              'SELECT id, label, description FROM permissions WHERE code = $1',
              [code]
            );

            if (existing.rows.length === 0) {
              // INSERT : Nouvelle permission
              await client.query(`
                INSERT INTO permissions (
                  id,
                  code,
                  module,
                  menu,
                  action,
                  label,
                  description,
                  sort_order,
                  created_at
                ) VALUES (
                  gen_random_uuid(),
                  $1, $2, $3, $4, $5, $6, $7,
                  NOW()
                )
              `, [
                code,
                moduleName,
                menuName,
                action.action,
                action.label,
                action.description,
                action.sort_order
              ]);

              stats.added++;
              stats.details.added_permissions.push(code);
              console.log(`  ✓ Added: ${code}`);

            } else {
              // UPDATE : Permission existe, vérifier si labels/descriptions manquent
              const current = existing.rows[0];
              const needsUpdate = !current.label || !current.description ||
                                 current.label.trim() === '' ||
                                 current.description.trim() === '';

              if (needsUpdate) {
                await client.query(`
                  UPDATE permissions
                  SET
                    label = $2,
                    description = $3,
                    module = $4,
                    menu = $5,
                    action = $6,
                    sort_order = $7
                  WHERE code = $1
                `, [
                  code,
                  action.label,
                  action.description,
                  moduleName,
                  menuName,
                  action.action,
                  action.sort_order
                ]);

                stats.updated++;
                stats.details.updated_permissions.push(code);
                console.log(`  ↻ Updated: ${code}`);
              } else {
                stats.unchanged++;
              }
            }
          } catch (error) {
            stats.errors.push({ code, error: error.message });
            console.error(`  ✗ Error processing ${code}:`, error.message);
          }
        }
      }
    }

    console.log(`✓ Step 1 Complete: ${stats.added} added, ${stats.updated} updated, ${stats.unchanged} unchanged`);

    // ============================================================
    // ÉTAPE 2 : Créer les alias pour compatibilité
    // ============================================================
    console.log('Step 2: Creating permission aliases...');

    for (const alias of PERMISSION_ALIASES) {
      try {
        // Vérifier si le nouveau code existe déjà
        const newExists = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [alias.new]
        );

        if (newExists.rows.length === 0) {
          // Extraire module, menu, action du nouveau code
          const [module, menu, action] = alias.new.split('.');

          // Créer la nouvelle permission
          await client.query(`
            INSERT INTO permissions (
              id,
              code,
              module,
              menu,
              action,
              label,
              description,
              sort_order,
              created_at
            ) VALUES (
              gen_random_uuid(),
              $1, $2, $3, $4, $5, $6, 99,
              NOW()
            )
          `, [alias.new, module, menu, action, alias.label, alias.description]);

          stats.aliased++;
          stats.details.aliased_permissions.push(`${alias.old} → ${alias.new}`);
          console.log(`  ✓ Created alias: ${alias.old} → ${alias.new} (both kept for compatibility)`);
        }
      } catch (error) {
        stats.errors.push({ alias: alias.new, error: error.message });
        console.error(`  ✗ Error creating alias ${alias.new}:`, error.message);
      }
    }

    console.log(`✓ Step 2 Complete: ${stats.aliased} aliases created`);

    // ============================================================
    // ÉTAPE 3 : Migrer professor.* vers training.declarations.*
    // ============================================================
    console.log('Step 3: Migrating professor.* permissions...');

    for (const migration of PROFESSOR_MIGRATIONS) {
      try {
        // Vérifier si l'ancienne permission existe
        const oldExists = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [migration.old]
        );

        if (oldExists.rows.length > 0) {
          // Vérifier si la nouvelle permission existe déjà
          const newExists = await client.query(
            'SELECT id FROM permissions WHERE code = $1',
            [migration.new]
          );

          if (newExists.rows.length === 0) {
            // Extraire module, menu, action
            const [module, menu, action] = migration.new.split('.');

            // Créer la nouvelle permission
            await client.query(`
              INSERT INTO permissions (
                id,
                code,
                module,
                menu,
                action,
                label,
                description,
                sort_order,
                created_at
              ) VALUES (
                gen_random_uuid(),
                $1, $2, $3, $4, $5, $6, 50,
                NOW()
              )
            `, [migration.new, module, menu, action, migration.label, migration.description]);

            // Copier les assignations de rôles de l'ancienne vers la nouvelle
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id, granted_at)
              SELECT rp.role_id, p_new.id, NOW()
              FROM role_permissions rp
              INNER JOIN permissions p_old ON rp.permission_id = p_old.id
              CROSS JOIN permissions p_new
              WHERE p_old.code = $1 AND p_new.code = $2
              ON CONFLICT DO NOTHING
            `, [migration.old, migration.new]);

            stats.migrated++;
            stats.details.migrated_permissions.push(`${migration.old} → ${migration.new}`);
            console.log(`  ✓ Migrated: ${migration.old} → ${migration.new}`);

            // GARDER l'ancienne permission pour compatibilité (ne pas supprimer)
            console.log(`  ℹ Keeping ${migration.old} for backward compatibility`);
          }
        }
      } catch (error) {
        stats.errors.push({ migration: migration.new, error: error.message });
        console.error(`  ✗ Error migrating ${migration.old}:`, error.message);
      }
    }

    console.log(`✓ Step 3 Complete: ${stats.migrated} permissions migrated`);

    // ============================================================
    // COMMIT ET RÉSUMÉ
    // ============================================================
    await client.query('COMMIT');

    console.log('=== Migration 070 Complete ===');
    console.log(`Total: ${stats.added} added, ${stats.updated} updated, ${stats.aliased} aliased, ${stats.migrated} migrated`);
    console.log(`Unchanged: ${stats.unchanged}`);
    console.log(`Errors: ${stats.errors.length}`);

    res.json({
      success: true,
      message: 'Migration 070 completed successfully - Permissions structure complete',
      stats: {
        added: stats.added,
        updated: stats.updated,
        unchanged: stats.unchanged,
        aliased: stats.aliased,
        migrated: stats.migrated,
        total_processed: stats.added + stats.updated + stats.unchanged,
        errors_count: stats.errors.length
      },
      details: stats.details,
      errors: stats.errors.length > 0 ? stats.errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 070 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to complete permissions migration'
    });
  } finally {
    client.release();
  }
});

// ============================================================
// ROLLBACK MIGRATION
// ============================================================
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back Migration 070...');

    // Note: Rollback complexe car on ne veut pas supprimer toutes les permissions
    // On supprime uniquement celles ajoutées par cette migration
    // Pour simplifier, on ne fait que retirer les labels/descriptions

    await client.query(`
      UPDATE permissions
      SET label = NULL, description = NULL
      WHERE created_at > (NOW() - INTERVAL '1 hour')
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 070 rolled back (labels/descriptions cleared for recent permissions)'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback 070 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// ============================================================
// CHECK MIGRATION STATUS
// ============================================================
router.get('/status', async (req, res) => {
  try {
    // Compter les permissions avec labels/descriptions
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN label IS NOT NULL AND label != '' THEN 1 END) as with_label,
        COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description,
        COUNT(CASE WHEN label IS NOT NULL AND label != '' AND description IS NOT NULL AND description != '' THEN 1 END) as complete
      FROM permissions
    `);

    const counts = countResult.rows[0];

    // Vérifier si migration nécessaire
    const migrationNeeded = parseInt(counts.complete) < 200; // Attendre au moins 200 permissions complètes

    // Vérifier si les nouvelles permissions clés existent
    const keyPermissions = [
      'accounting.declarations.fill_data',
      'accounting.declarations.edit_metadata',
      'training.formations.create_pack',
      'training.corps.view_page',
      'hr.validation_workflows.view_page',
      'hr.employee_portal.clock_in_out'
    ];

    const keyResults = await pool.query(`
      SELECT code
      FROM permissions
      WHERE code = ANY($1::text[])
    `, [keyPermissions]);

    const missingKeys = keyPermissions.filter(
      key => !keyResults.rows.some(row => row.code === key)
    );

    res.json({
      status: {
        migrationNeeded,
        applied: !migrationNeeded,
        total_permissions: parseInt(counts.total),
        with_label: parseInt(counts.with_label),
        with_description: parseInt(counts.with_description),
        complete: parseInt(counts.complete),
        missing_key_permissions: missingKeys.length,
        missing_keys: missingKeys
      },
      message: migrationNeeded
        ? `Migration needed - ${missingKeys.length} key permissions missing, ${counts.complete}/${counts.total} permissions complete`
        : 'Migration 070 applied - Permissions structure is complete'
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
