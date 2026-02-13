import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 112: Supprimer les permissions anglaises (garder les françaises)
// Cette migration:
// 1. Identifie les permissions anglaises qui ont un équivalent français
// 2. Migre les role_permissions vers la permission française
// 3. Supprime les permissions anglaises

// Mapping des codes anglais vers français
const EN_TO_FR_MAPPING = {
  // === GESTION COMPTABLE ===
  'accounting.segments.view_page': 'gestion_comptable.segments.voir',
  'accounting.segments.view': 'gestion_comptable.segments.voir_liste',
  'accounting.segments.create': 'gestion_comptable.segments.creer',
  'accounting.segments.edit': 'gestion_comptable.segments.modifier',
  'accounting.segments.delete': 'gestion_comptable.segments.supprimer',

  'accounting.declarations.view_page': 'gestion_comptable.declarations.voir',
  'accounting.declarations.view': 'gestion_comptable.declarations.voir_liste',
  'accounting.declarations.create': 'gestion_comptable.declarations.creer',
  'accounting.declarations.edit': 'gestion_comptable.declarations.modifier',
  'accounting.declarations.delete': 'gestion_comptable.declarations.supprimer',
  'accounting.declarations.submit': 'gestion_comptable.declarations.soumettre',
  'accounting.declarations.approve': 'gestion_comptable.declarations.approuver',
  'accounting.declarations.reject': 'gestion_comptable.declarations.rejeter',
  'accounting.declarations.view_all': 'gestion_comptable.declarations.voir_toutes',
  'accounting.declarations.fill': 'gestion_comptable.declarations.remplir',

  'accounting.paiements.view_page': 'gestion_comptable.paiements.voir',
  'accounting.paiements.view': 'gestion_comptable.paiements.voir_liste',
  'accounting.paiements.create': 'gestion_comptable.paiements.creer',
  'accounting.paiements.edit': 'gestion_comptable.paiements.modifier',
  'accounting.paiements.delete': 'gestion_comptable.paiements.supprimer',
  'accounting.paiements.process': 'gestion_comptable.paiements.traiter',

  'accounting.retenues.view_page': 'gestion_comptable.retenues.voir',
  'accounting.retenues.view': 'gestion_comptable.retenues.voir_liste',
  'accounting.retenues.create': 'gestion_comptable.retenues.creer',
  'accounting.retenues.edit': 'gestion_comptable.retenues.modifier',
  'accounting.retenues.delete': 'gestion_comptable.retenues.supprimer',

  // === FORMATION ===
  'training.sessions.view_page': 'formation.sessions.voir',
  'training.sessions.view': 'formation.sessions.voir_liste',
  'training.sessions.create': 'formation.sessions.creer',
  'training.sessions.edit': 'formation.sessions.modifier',
  'training.sessions.delete': 'formation.sessions.supprimer',

  'training.courses.view_page': 'formation.cours.voir',
  'training.courses.view': 'formation.cours.voir_liste',
  'training.courses.create': 'formation.cours.creer',
  'training.courses.edit': 'formation.cours.modifier',
  'training.courses.delete': 'formation.cours.supprimer',

  'training.trainers.view_page': 'formation.formateurs.voir',
  'training.trainers.view': 'formation.formateurs.voir_liste',
  'training.trainers.create': 'formation.formateurs.creer',
  'training.trainers.edit': 'formation.formateurs.modifier',
  'training.trainers.delete': 'formation.formateurs.supprimer',

  'training.registrations.view_page': 'formation.inscriptions.voir',
  'training.registrations.view': 'formation.inscriptions.voir_liste',
  'training.registrations.create': 'formation.inscriptions.creer',
  'training.registrations.edit': 'formation.inscriptions.modifier',
  'training.registrations.delete': 'formation.inscriptions.supprimer',
  'training.registrations.approve': 'formation.inscriptions.approuver',

  // === RESSOURCES HUMAINES ===
  'hr.employees.view_page': 'ressources_humaines.employes.voir',
  'hr.employees.view': 'ressources_humaines.employes.voir_liste',
  'hr.employees.create': 'ressources_humaines.employes.creer',
  'hr.employees.edit': 'ressources_humaines.employes.modifier',
  'hr.employees.delete': 'ressources_humaines.employes.supprimer',

  'hr.contracts.view_page': 'ressources_humaines.contrats.voir',
  'hr.contracts.view': 'ressources_humaines.contrats.voir_liste',
  'hr.contracts.create': 'ressources_humaines.contrats.creer',
  'hr.contracts.edit': 'ressources_humaines.contrats.modifier',
  'hr.contracts.delete': 'ressources_humaines.contrats.supprimer',

  'hr.leaves.view_page': 'ressources_humaines.conges.voir',
  'hr.leaves.view': 'ressources_humaines.conges.voir_liste',
  'hr.leaves.create': 'ressources_humaines.conges.creer',
  'hr.leaves.edit': 'ressources_humaines.conges.modifier',
  'hr.leaves.delete': 'ressources_humaines.conges.supprimer',
  'hr.leaves.approve': 'ressources_humaines.conges.approuver',

  'hr.payroll.view_page': 'ressources_humaines.paie.voir',
  'hr.payroll.view': 'ressources_humaines.paie.voir_liste',
  'hr.payroll.create': 'ressources_humaines.paie.creer',
  'hr.payroll.edit': 'ressources_humaines.paie.modifier',
  'hr.payroll.process': 'ressources_humaines.paie.traiter',

  'hr.schedule.view_page': 'ressources_humaines.emploi_temps.voir',
  'hr.schedule.view': 'ressources_humaines.emploi_temps.voir_liste',
  'hr.schedule.create': 'ressources_humaines.emploi_temps.creer',
  'hr.schedule.edit': 'ressources_humaines.emploi_temps.modifier',
  'hr.schedule.delete': 'ressources_humaines.emploi_temps.supprimer',

  // === COMMERCIALISATION ===
  'commercialisation.prospects.view_page': 'commercialisation.prospects.voir',
  'commercialisation.prospects.view': 'commercialisation.prospects.voir_liste',
  'commercialisation.prospects.create': 'commercialisation.prospects.creer',
  'commercialisation.prospects.edit': 'commercialisation.prospects.modifier',
  'commercialisation.prospects.delete': 'commercialisation.prospects.supprimer',
  'commercialisation.prospects.convert': 'commercialisation.prospects.convertir',

  // === ADMINISTRATION ===
  'admin.users.view_page': 'administration.utilisateurs.voir',
  'admin.users.view': 'administration.utilisateurs.voir_liste',
  'admin.users.create': 'administration.utilisateurs.creer',
  'admin.users.edit': 'administration.utilisateurs.modifier',
  'admin.users.delete': 'administration.utilisateurs.supprimer',

  'admin.roles.view_page': 'administration.roles.voir',
  'admin.roles.view': 'administration.roles.voir_liste',
  'admin.roles.create': 'administration.roles.creer',
  'admin.roles.edit': 'administration.roles.modifier',
  'admin.roles.delete': 'administration.roles.supprimer',

  'admin.settings.view_page': 'administration.parametres.voir',
  'admin.settings.view': 'administration.parametres.voir_liste',
  'admin.settings.edit': 'administration.parametres.modifier',

  // === REPORTING ===
  'reporting.reports.view_page': 'reporting.rapports.voir',
  'reporting.reports.view': 'reporting.rapports.voir_liste',
  'reporting.reports.create': 'reporting.rapports.creer',
  'reporting.reports.export': 'reporting.rapports.exporter',

  'reporting.dashboard.view_page': 'reporting.tableau_bord.voir',
  'reporting.dashboard.view': 'reporting.tableau_bord.voir_liste',
};

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 112: Suppression des permissions anglaises ===');

    let migratedRolePermissions = 0;
    let deletedPermissions = 0;
    let skippedNoFrench = 0;
    let skippedNoEnglish = 0;

    for (const [enCode, frCode] of Object.entries(EN_TO_FR_MAPPING)) {
      // Vérifier si la permission anglaise existe
      const enResult = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [enCode]
      );

      if (enResult.rows.length === 0) {
        skippedNoEnglish++;
        continue;
      }

      const enId = enResult.rows[0].id;

      // Vérifier si la permission française existe
      const frResult = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [frCode]
      );

      if (frResult.rows.length === 0) {
        console.log(`⚠️ Permission FR manquante: ${frCode} (EN: ${enCode})`);
        skippedNoFrench++;
        continue;
      }

      const frId = frResult.rows[0].id;

      console.log(`\n📋 ${enCode} → ${frCode}`);
      console.log(`   EN ID: ${enId} → FR ID: ${frId}`);

      // Migrer les role_permissions de EN vers FR
      // D'abord, compter les role_permissions à migrer
      const rpCount = await client.query(
        'SELECT COUNT(*) FROM role_permissions WHERE permission_id = $1',
        [enId]
      );
      const count = parseInt(rpCount.rows[0].count);

      if (count > 0) {
        // Migrer vers FR (sauf si déjà existant pour ce role)
        await client.query(`
          UPDATE role_permissions
          SET permission_id = $1
          WHERE permission_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp2
            WHERE rp2.role_id = role_permissions.role_id
            AND rp2.permission_id = $1
          )
        `, [frId, enId]);

        // Supprimer les role_permissions restants (doublons)
        await client.query(
          'DELETE FROM role_permissions WHERE permission_id = $1',
          [enId]
        );

        console.log(`   ✅ Migré ${count} role_permissions`);
        migratedRolePermissions += count;
      }

      // Supprimer la permission anglaise
      await client.query('DELETE FROM permissions WHERE id = $1', [enId]);
      deletedPermissions++;
      console.log(`   🗑️ Permission EN supprimée`);
    }

    // Compter les permissions restantes
    const countResult = await client.query('SELECT COUNT(*) FROM permissions');
    const remainingCount = parseInt(countResult.rows[0].count);

    await client.query('COMMIT');

    console.log('\n=== Migration 112 terminée ===');
    console.log(`✅ Role_permissions migrés: ${migratedRolePermissions}`);
    console.log(`🗑️ Permissions EN supprimées: ${deletedPermissions}`);
    console.log(`⏭️ Ignorées (pas de FR): ${skippedNoFrench}`);
    console.log(`⏭️ Ignorées (pas de EN): ${skippedNoEnglish}`);
    console.log(`📊 Permissions restantes: ${remainingCount}`);

    res.json({
      success: true,
      message: 'Migration 112 exécutée avec succès',
      stats: {
        migratedRolePermissions,
        deletedPermissions,
        skippedNoFrench,
        skippedNoEnglish,
        remainingPermissions: remainingCount
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur Migration 112:', error);
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
    // Compter combien de permissions anglaises existent encore
    const enCodes = Object.keys(EN_TO_FR_MAPPING);
    const placeholders = enCodes.map((_, i) => `$${i + 1}`).join(', ');

    const result = await client.query(
      `SELECT COUNT(*) as english_count FROM permissions WHERE code IN (${placeholders})`,
      enCodes
    );

    const englishCount = parseInt(result.rows[0].english_count);
    const totalResult = await client.query('SELECT COUNT(*) FROM permissions');
    const totalCount = parseInt(totalResult.rows[0].count);

    const needsMigration = englishCount > 0;

    res.json({
      success: true,
      applied: !needsMigration,
      status: {
        migrationNeeded: needsMigration,
        englishPermissions: englishCount,
        totalPermissions: totalCount
      },
      message: needsMigration
        ? `${englishCount} permissions anglaises à supprimer`
        : `Aucune permission anglaise - ${totalCount} permissions françaises`
    });

  } catch (error) {
    console.error('Erreur status Migration 112:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Route de preview
router.get('/preview', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    const preview = [];

    for (const [enCode, frCode] of Object.entries(EN_TO_FR_MAPPING)) {
      const enResult = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [enCode]
      );

      const frResult = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [frCode]
      );

      if (enResult.rows.length > 0) {
        const enId = enResult.rows[0].id;
        const frId = frResult.rows.length > 0 ? frResult.rows[0].id : null;

        const rpCount = await client.query(
          'SELECT COUNT(*) FROM role_permissions WHERE permission_id = $1',
          [enId]
        );

        preview.push({
          englishCode: enCode,
          frenchCode: frCode,
          englishId: enId,
          frenchId: frId,
          frenchExists: frId !== null,
          rolePermissionsToMigrate: parseInt(rpCount.rows[0].count),
          action: frId ? 'MIGRATE_AND_DELETE' : 'SKIP_NO_FRENCH'
        });
      }
    }

    const totalResult = await client.query('SELECT COUNT(*) FROM permissions');

    res.json({
      success: true,
      preview: {
        totalPermissions: parseInt(totalResult.rows[0].count),
        englishPermissionsFound: preview.length,
        permissionsToDelete: preview.filter(p => p.frenchExists).length,
        permissionsToSkip: preview.filter(p => !p.frenchExists).length,
        details: preview
      }
    });

  } catch (error) {
    console.error('Erreur preview Migration 112:', error);
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
