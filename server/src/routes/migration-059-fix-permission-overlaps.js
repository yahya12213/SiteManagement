import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

/**
 * Migration 059: Corriger les chevauchements de permissions et ajouter les permissions manquantes
 *
 * Problèmes résolus:
 * 1. Séparation des permissions qui se chevauchaient (fill_data vs edit_metadata, folder vs template)
 * 2. Ajout de permissions manquantes pour boutons non protégés
 * 3. Alignement total entre frontend et backend
 *
 * Nouvelles permissions ajoutées: 20
 */

/**
 * GET /api/migration-059/status
 * Vérifier si la migration 059 est nécessaire
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
      // Calculation Sheets - Permissions manquantes
      'accounting.calculation_sheets.view',
      'accounting.calculation_sheets.duplicate',
      'accounting.calculation_sheets.export',
      'accounting.calculation_sheets.settings',

      // Declarations - Séparation du chevauchement update
      'accounting.declarations.fill_data',
      'accounting.declarations.edit_metadata',

      // Corps - Permissions manquantes
      'training.corps.create',
      'training.corps.update',
      'training.corps.delete',

      // Sessions - Permissions manquantes
      'training.sessions.create',
      'training.sessions.update',
      'training.sessions.delete',

      // Certificates - Permissions manquantes
      'training.certificates.download',
      'training.certificates.delete',

      // Certificate Templates - Séparation des chevauchements folder/template
      'training.certificate_templates.rename_folder',
      'training.certificate_templates.rename_template',
      'training.certificate_templates.delete_folder',
      'training.certificate_templates.delete_template',
      'training.certificate_templates.create_folder',
      'training.certificate_templates.create_template',
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
        : 'Migration 059 already applied'
    });

  } catch (error) {
    console.error('Error checking migration 059 status:', error);
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

    console.log('=== Migration 059: Corriger les chevauchements de permissions ===');

    // Définition des nouvelles permissions
    const newPermissions = [
      // ==================== CALCULATION SHEETS ====================
      {
        module: 'accounting',
        menu: 'calculation_sheets',
        action: 'view',
        code: 'accounting.calculation_sheets.view',
        label: 'Voir une fiche de calcul',
        description: 'Voir les détails d\'une fiche de calcul spécifique',
        sort_order: 401
      },
      {
        module: 'accounting',
        menu: 'calculation_sheets',
        action: 'duplicate',
        code: 'accounting.calculation_sheets.duplicate',
        label: 'Dupliquer une fiche de calcul',
        description: 'Créer une copie d\'une fiche de calcul existante',
        sort_order: 405
      },
      {
        module: 'accounting',
        menu: 'calculation_sheets',
        action: 'export',
        code: 'accounting.calculation_sheets.export',
        label: 'Exporter une fiche de calcul',
        description: 'Exporter une fiche de calcul au format Excel',
        sort_order: 406
      },
      {
        module: 'accounting',
        menu: 'calculation_sheets',
        action: 'settings',
        code: 'accounting.calculation_sheets.settings',
        label: 'Gérer les paramètres de fiche',
        description: 'Modifier les métadonnées d\'une fiche de calcul (nom, segment, ville)',
        sort_order: 407
      },

      // ==================== DECLARATIONS (Séparation du chevauchement) ====================
      {
        module: 'accounting',
        menu: 'declarations',
        action: 'fill_data',
        code: 'accounting.declarations.fill_data',
        label: 'Remplir les données d\'une déclaration',
        description: 'Accéder à l\'éditeur pour remplir les données d\'une déclaration',
        sort_order: 805
      },
      {
        module: 'accounting',
        menu: 'declarations',
        action: 'edit_metadata',
        code: 'accounting.declarations.edit_metadata',
        label: 'Modifier les métadonnées d\'une déclaration',
        description: 'Modifier le nom et autres métadonnées d\'une déclaration',
        sort_order: 806
      },

      // ==================== CORPS DE FORMATION ====================
      {
        module: 'training',
        menu: 'corps',
        action: 'create',
        code: 'training.corps.create',
        label: 'Créer un corps de formation',
        description: 'Créer un nouveau corps de formation',
        sort_order: 281
      },
      {
        module: 'training',
        menu: 'corps',
        action: 'update',
        code: 'training.corps.update',
        label: 'Modifier un corps de formation',
        description: 'Modifier les détails d\'un corps de formation existant',
        sort_order: 282
      },
      {
        module: 'training',
        menu: 'corps',
        action: 'delete',
        code: 'training.corps.delete',
        label: 'Supprimer un corps de formation',
        description: 'Supprimer un corps de formation',
        sort_order: 283
      },

      // ==================== SESSIONS ====================
      {
        module: 'training',
        menu: 'sessions',
        action: 'create',
        code: 'training.sessions.create',
        label: 'Créer une session',
        description: 'Créer une nouvelle session de formation',
        sort_order: 301
      },
      {
        module: 'training',
        menu: 'sessions',
        action: 'update',
        code: 'training.sessions.update',
        label: 'Modifier une session',
        description: 'Modifier les détails d\'une session existante',
        sort_order: 302
      },
      {
        module: 'training',
        menu: 'sessions',
        action: 'delete',
        code: 'training.sessions.delete',
        label: 'Supprimer une session',
        description: 'Supprimer une session de formation',
        sort_order: 303
      },

      // ==================== CERTIFICATES ====================
      {
        module: 'training',
        menu: 'certificates',
        action: 'download',
        code: 'training.certificates.download',
        label: 'Télécharger un certificat',
        description: 'Télécharger le fichier PDF d\'un certificat',
        sort_order: 364
      },
      {
        module: 'training',
        menu: 'certificates',
        action: 'delete',
        code: 'training.certificates.delete',
        label: 'Supprimer un certificat',
        description: 'Supprimer un certificat généré',
        sort_order: 365
      },

      // ==================== CERTIFICATE TEMPLATES (Séparation folder/template) ====================
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'rename_folder',
        code: 'training.certificate_templates.rename_folder',
        label: 'Renommer un dossier de templates',
        description: 'Renommer un dossier contenant des templates de certificats',
        sort_order: 384
      },
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'rename_template',
        code: 'training.certificate_templates.rename_template',
        label: 'Renommer un template de certificat',
        description: 'Renommer un template de certificat individuel',
        sort_order: 385
      },
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'delete_folder',
        code: 'training.certificate_templates.delete_folder',
        label: 'Supprimer un dossier de templates',
        description: 'Supprimer un dossier de templates (doit être vide)',
        sort_order: 386
      },
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'delete_template',
        code: 'training.certificate_templates.delete_template',
        label: 'Supprimer un template de certificat',
        description: 'Supprimer un template de certificat individuel',
        sort_order: 387
      },
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'create_folder',
        code: 'training.certificate_templates.create_folder',
        label: 'Créer un dossier de templates',
        description: 'Créer un nouveau dossier pour organiser les templates',
        sort_order: 381
      },
      {
        module: 'training',
        menu: 'certificate_templates',
        action: 'create_template',
        code: 'training.certificate_templates.create_template',
        label: 'Créer un template de certificat',
        description: 'Créer un nouveau template de certificat',
        sort_order: 382
      },
    ];

    console.log(`Inserting ${newPermissions.length} new permissions...`);

    let insertedCount = 0;
    let existingCount = 0;

    for (const perm of newPermissions) {
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

    for (const perm of newPermissions) {
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

        // Assign to gerant (all permissions)
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

    console.log('\n=== Migration 059 completed successfully! ===');
    console.log(`Summary:`);
    console.log(`  - Inserted ${insertedCount} new permissions`);
    console.log(`  - Found ${existingCount} existing permissions`);
    console.log(`  - Total new permissions: ${newPermissions.length}`);
    console.log(`\n📋 Chevauchements résolus:`);
    console.log(`  - accounting.declarations: fill_data vs edit_metadata séparés`);
    console.log(`  - certificate_templates: folder vs template actions séparées`);
    console.log(`\n🔐 Boutons maintenant protégés:`);
    console.log(`  - CalculationSheetsList: 8 boutons`);
    console.log(`  - CorpsFormation: 3 boutons`);
    console.log(`  - Sessions: 3 boutons`);
    console.log(`  - CertificatesManagement: 2 boutons`);

    res.json({
      success: true,
      message: 'Migration 059 executed successfully',
      details: {
        inserted: insertedCount,
        existing: existingCount,
        total: newPermissions.length,
        permissions: newPermissions.map(p => p.code),
        overlapsFixed: [
          'accounting.declarations: fill_data vs edit_metadata',
          'certificate_templates: folder vs template actions'
        ],
        buttonsProtected: {
          CalculationSheetsList: 8,
          CorpsFormation: 3,
          Sessions: 3,
          CertificatesManagement: 2
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 059 failed:', error);

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
