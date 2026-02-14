import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

/**
 * Migration: Corps de Formation & Packs
 *
 * Ajoute :
 * 1. Table corps_formation
 * 2. Modification table formations (corps_formation_id, is_pack, certificate_template_id)
 * 3. Table formation_pack_items (many-to-many pour les packs)
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Migration Corps de Formation - Démarrage...');

    // 1. Créer la table corps_formation
    console.log('📦 Création table corps_formation...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS corps_formation (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table corps_formation créée');

    // 2. Vérifier si les colonnes existent déjà dans formations
    const checkColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formations'
      AND column_name IN ('corps_formation_id', 'is_pack', 'certificate_template_id')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);

    // 2.1 Ajouter corps_formation_id si n'existe pas
    if (!existingColumns.includes('corps_formation_id')) {
      console.log('🔗 Ajout colonne corps_formation_id à formations...');
      await client.query(`
        ALTER TABLE formations
        ADD COLUMN corps_formation_id TEXT REFERENCES corps_formation(id) ON DELETE RESTRICT
      `);
      console.log('✅ Colonne corps_formation_id ajoutée');
    } else {
      console.log('⏭️  Colonne corps_formation_id existe déjà');
    }

    // 2.2 Ajouter is_pack si n'existe pas
    if (!existingColumns.includes('is_pack')) {
      console.log('📦 Ajout colonne is_pack à formations...');
      await client.query(`
        ALTER TABLE formations
        ADD COLUMN is_pack BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Colonne is_pack ajoutée');
    } else {
      console.log('⏭️  Colonne is_pack existe déjà');
    }

    // 2.3 Vérifier si certificate_template_id existe déjà
    if (!existingColumns.includes('certificate_template_id')) {
      console.log('🎓 Ajout colonne certificate_template_id à formations...');
      await client.query(`
        ALTER TABLE formations
        ADD COLUMN certificate_template_id TEXT
      `);
      console.log('✅ Colonne certificate_template_id ajoutée');
    } else {
      console.log('⏭️  Colonne certificate_template_id existe déjà');
    }

    // 3. Créer la table formation_pack_items
    console.log('🎁 Création table formation_pack_items...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS formation_pack_items (
        id TEXT PRIMARY KEY,
        pack_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
        formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pack_id, formation_id),
        CHECK (pack_id != formation_id)
      )
    `);
    console.log('✅ Table formation_pack_items créée');

    // 4. Créer un index pour améliorer les performances
    console.log('⚡ Création des index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_formations_corps
      ON formations(corps_formation_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pack_items_pack
      ON formation_pack_items(pack_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pack_items_formation
      ON formation_pack_items(formation_id)
    `);
    console.log('✅ Index créés');

    await client.query('COMMIT');
    console.log('✅ Migration Corps de Formation terminée avec succès');

    res.json({
      success: true,
      message: 'Migration Corps de Formation effectuée avec succès',
      tables_created: ['corps_formation', 'formation_pack_items'],
      columns_added: ['formations.corps_formation_id', 'formations.is_pack', 'formations.certificate_template_id']
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la migration',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Route pour vérifier le statut de la migration
router.get('/status', async (req, res) => {
  try {
    // Vérifier si les tables existent
    const tablesCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('corps_formation', 'formation_pack_items')
    `);

    // Vérifier si les colonnes existent
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formations'
      AND column_name IN ('corps_formation_id', 'is_pack', 'certificate_template_id')
    `);

    const tablesExist = tablesCheck.rows.map(r => r.table_name);
    const columnsExist = columnsCheck.rows.map(r => r.column_name);

    const isComplete =
      tablesExist.includes('corps_formation') &&
      tablesExist.includes('formation_pack_items') &&
      columnsExist.includes('corps_formation_id') &&
      columnsExist.includes('is_pack') &&
      columnsExist.includes('certificate_template_id');

    res.json({
      success: true,
      migration_complete: isComplete,
      tables: {
        corps_formation: tablesExist.includes('corps_formation'),
        formation_pack_items: tablesExist.includes('formation_pack_items')
      },
      columns: {
        corps_formation_id: columnsExist.includes('corps_formation_id'),
        is_pack: columnsExist.includes('is_pack'),
        certificate_template_id: columnsExist.includes('certificate_template_id')
      }
    });

  } catch (error) {
    console.error('Erreur vérification migration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
