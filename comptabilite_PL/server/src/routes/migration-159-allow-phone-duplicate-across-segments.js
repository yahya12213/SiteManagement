/**
 * Migration 159: Permettre un numéro en double si le segment est différent
 *
 * AVANT: Contrainte UNIQUE simple sur phone_international
 *        → Un numéro ne peut exister qu'une seule fois (tous segments confondus)
 *
 * APRÈS: Contrainte UNIQUE composite sur (phone_international, segment_id)
 *        → Un même numéro peut exister dans différents segments
 *        → Mais pas deux fois dans le même segment
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🚀 Migration 159: Permettre les doublons de numéro entre segments différents');

    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Supprimer l'ancienne contrainte UNIQUE simple
    // ============================================================
    console.log('  📦 Step 1: Suppression de la contrainte UNIQUE simple sur phone_international...');

    // Vérifier si la contrainte existe
    const constraintCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'prospects'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%phone_international%'
    `);

    if (constraintCheck.rows.length > 0) {
      for (const row of constraintCheck.rows) {
        console.log(`    Suppression de la contrainte: ${row.constraint_name}`);
        await client.query(`
          ALTER TABLE prospects DROP CONSTRAINT IF EXISTS ${row.constraint_name}
        `);
      }
      console.log('    ✓ Contrainte(s) UNIQUE simple supprimée(s)');
    } else {
      console.log('    ⚠ Aucune contrainte UNIQUE sur phone_international trouvée');
    }

    // ============================================================
    // STEP 2: Vérifier s'il y a des doublons existants
    // ============================================================
    console.log('  📦 Step 2: Vérification des doublons existants...');

    const duplicatesCheck = await client.query(`
      SELECT phone_international, segment_id, COUNT(*) as count
      FROM prospects
      GROUP BY phone_international, segment_id
      HAVING COUNT(*) > 1
    `);

    if (duplicatesCheck.rows.length > 0) {
      console.log(`    ⚠ ${duplicatesCheck.rows.length} combinaisons phone+segment avec doublons détectées`);
      console.log('    Nettoyage: conservation du prospect le plus récent pour chaque doublon...');

      // Supprimer les doublons en gardant le plus récent (date_injection DESC)
      await client.query(`
        DELETE FROM prospects p1
        WHERE EXISTS (
          SELECT 1 FROM prospects p2
          WHERE p2.phone_international = p1.phone_international
            AND p2.segment_id = p1.segment_id
            AND p2.date_injection > p1.date_injection
        )
      `);

      console.log('    ✓ Doublons nettoyés');
    } else {
      console.log('    ✓ Aucun doublon phone+segment existant');
    }

    // ============================================================
    // STEP 3: Créer la nouvelle contrainte UNIQUE composite
    // ============================================================
    console.log('  📦 Step 3: Création de la contrainte UNIQUE composite (phone_international, segment_id)...');

    // Vérifier si la contrainte composite existe déjà
    const compositeCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'prospects'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'prospects_phone_segment_unique'
    `);

    if (compositeCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE prospects
        ADD CONSTRAINT prospects_phone_segment_unique
        UNIQUE (phone_international, segment_id)
      `);
      console.log('    ✓ Contrainte UNIQUE composite créée');
    } else {
      console.log('    ⚠ La contrainte composite existe déjà');
    }

    // ============================================================
    // STEP 4: Vérification finale
    // ============================================================
    console.log('  📦 Step 4: Vérification finale...');

    const finalCheck = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'prospects'
        AND constraint_type = 'UNIQUE'
    `);

    console.log('    Contraintes UNIQUE actuelles:');
    for (const row of finalCheck.rows) {
      console.log(`      - ${row.constraint_name}`);
    }

    await client.query('COMMIT');

    console.log('✅ Migration 159 terminée avec succès!');
    console.log('');
    console.log('📋 Comportement après migration:');
    console.log('   - Même numéro dans segments DIFFÉRENTS → AUTORISÉ');
    console.log('   - Même numéro dans le MÊME segment → BLOQUÉ (ou réinjecté si >24h)');

    res.json({
      success: true,
      message: 'Migration 159 exécutée avec succès',
      changes: [
        'Suppression de la contrainte UNIQUE simple sur phone_international',
        'Création de la contrainte UNIQUE composite (phone_international, segment_id)'
      ],
      behavior: {
        same_phone_different_segment: 'AUTORISÉ',
        same_phone_same_segment: 'BLOQUÉ (ou réinjecté si >24h)'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration 159:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Route pour vérifier l'état de la migration
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'prospects'
        AND constraint_type = 'UNIQUE'
    `);

    const hasCompositeConstraint = result.rows.some(
      r => r.constraint_name === 'prospects_phone_segment_unique'
    );

    const hasSimpleConstraint = result.rows.some(
      r => r.constraint_name === 'prospects_phone_international_key'
    );

    res.json({
      migrated: hasCompositeConstraint && !hasSimpleConstraint,
      constraints: result.rows,
      details: {
        hasCompositeConstraint,
        hasSimpleConstraint
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
