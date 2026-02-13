import pool from '../config/database.js';

/**
 * Migration pour corriger:
 * 1. Les segments sans couleur (qui causent l'erreur JavaScript)
 * 2. L'association incorrecte de "Charge Centre Prolean" avec Sidi Slimane
 */

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Corriger les segments sans couleur
    console.log('🎨 Vérification des segments sans couleur...');

    const segmentsWithoutColor = await client.query(
      'SELECT id, name FROM segments WHERE color IS NULL OR color = \'\''
    );

    if (segmentsWithoutColor.rows.length > 0) {
      console.log(`  → ${segmentsWithoutColor.rows.length} segment(s) sans couleur trouvé(s)`);

      // Mettre à jour avec une couleur par défaut bleue
      const updateResult = await client.query(
        'UPDATE segments SET color = $1 WHERE color IS NULL OR color = \'\'',
        ['#3B82F6']
      );

      console.log(`  ✓ ${updateResult.rowCount} segment(s) mis à jour avec la couleur par défaut #3B82F6`);
    } else {
      console.log('  ✓ Tous les segments ont déjà une couleur');
    }

    // 2. Vérifier et corriger "Charge Centre Prolean"
    console.log('\n📋 Vérification de "Charge Centre Prolean"...');

    // Trouver la fiche "Charge Centre Prolean"
    const chargeSheetResult = await client.query(
      "SELECT id, title FROM calculation_sheets WHERE title LIKE '%Charge Centre Prolean%'"
    );

    if (chargeSheetResult.rows.length > 0) {
      const sheet = chargeSheetResult.rows[0];
      console.log(`  → Fiche trouvée: "${sheet.title}" (ID: ${sheet.id})`);

      // Vérifier si Sidi Slimane est incorrectement associée
      const sidiSlimaneResult = await client.query(
        `SELECT csc.sheet_id, c.name, c.id
         FROM calculation_sheet_cities csc
         JOIN cities c ON c.id = csc.city_id
         WHERE csc.sheet_id = $1 AND c.name = 'Sidi Slimane'`,
        [sheet.id]
      );

      if (sidiSlimaneResult.rows.length > 0) {
        console.log(`  ⚠️ Association incorrecte trouvée avec Sidi Slimane`);

        // Supprimer l'association incorrecte
        const deleteResult = await client.query(
          `DELETE FROM calculation_sheet_cities
           WHERE sheet_id = $1
           AND city_id IN (SELECT id FROM cities WHERE name = 'Sidi Slimane')`,
          [sheet.id]
        );

        console.log(`  ✓ Association incorrecte supprimée (${deleteResult.rowCount} ligne(s))`);
      } else {
        console.log('  ✓ Pas d\'association incorrecte avec Sidi Slimane');
      }

      // Vérifier que "Charge Centre" est bien associée
      const chargeCentreResult = await client.query(
        `SELECT csc.sheet_id, c.name, c.id
         FROM calculation_sheet_cities csc
         JOIN cities c ON c.id = csc.city_id
         WHERE csc.sheet_id = $1 AND c.name = 'Charge Centre'`,
        [sheet.id]
      );

      if (chargeCentreResult.rows.length === 0) {
        console.log(`  ⚠️ "Charge Centre" n'est pas associée à la fiche`);

        // Trouver l'ID de la ville "Charge Centre"
        const chargeCentreCity = await client.query(
          "SELECT id FROM cities WHERE name = 'Charge Centre' LIMIT 1"
        );

        if (chargeCentreCity.rows.length > 0) {
          // Ajouter l'association
          await client.query(
            'INSERT INTO calculation_sheet_cities (sheet_id, city_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [sheet.id, chargeCentreCity.rows[0].id]
          );
          console.log(`  ✓ Association avec "Charge Centre" ajoutée`);
        }
      } else {
        console.log('  ✓ "Charge Centre" est déjà correctement associée');
      }

      // Afficher les villes actuellement associées
      const currentCities = await client.query(
        `SELECT c.name
         FROM calculation_sheet_cities csc
         JOIN cities c ON c.id = csc.city_id
         WHERE csc.sheet_id = $1
         ORDER BY c.name`,
        [sheet.id]
      );

      console.log(`  📍 Villes associées après correction: ${currentCities.rows.map(r => r.name).join(', ')}`);
    } else {
      console.log('  ℹ️ Fiche "Charge Centre Prolean" non trouvée');
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration terminée avec succès');

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Route pour exécuter la migration
import express from 'express';
const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('🚀 Démarrage de la migration de correction...');
    const result = await runMigration();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;