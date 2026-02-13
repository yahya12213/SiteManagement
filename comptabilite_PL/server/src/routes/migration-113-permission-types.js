import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 113: Ajouter colonne permission_type pour classifier les permissions
// Types: menu, sous_menu, page, bouton

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 113: Ajout colonne permission_type ===');

    // Étape 1: Vérifier si la colonne existe déjà
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'permissions' AND column_name = 'permission_type'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('La colonne permission_type existe déjà');
    } else {
      // Étape 2: Ajouter la colonne avec contrainte CHECK
      await client.query(`
        ALTER TABLE permissions
        ADD COLUMN permission_type TEXT
        CHECK (permission_type IN ('menu', 'sous_menu', 'page', 'bouton'))
      `);
      console.log('✅ Colonne permission_type ajoutée');
    }

    // Étape 3: Classifier les permissions existantes
    // Logique:
    // - action = 'acces' sans menu spécifique → menu
    // - action = 'acces' avec menu → sous_menu
    // - action contient 'voir', 'view', 'voir_liste', 'voir_page' → page
    // - autres (creer, modifier, supprimer, approuver, etc.) → bouton

    const updateResult = await client.query(`
      UPDATE permissions SET permission_type = CASE
        -- Menu: accès à une section principale (pas de sous-menu spécifique)
        WHEN action = 'acces' AND (menu IS NULL OR menu = '' OR menu = '_section') THEN 'menu'

        -- Sous-menu: accès à un sous-menu spécifique
        WHEN action = 'acces' THEN 'sous_menu'

        -- Page: actions de visualisation
        WHEN action IN ('voir', 'voir_liste', 'voir_page', 'voir_toutes', 'view', 'view_page', 'view_list') THEN 'page'

        -- Bouton: toutes les autres actions (créer, modifier, supprimer, etc.)
        ELSE 'bouton'
      END
      WHERE permission_type IS NULL
    `);

    console.log(`✅ ${updateResult.rowCount} permissions classifiées`);

    // Étape 4: Créer un index pour les requêtes par type
    const indexCheck = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'permissions' AND indexname = 'idx_permissions_type'
    `);

    if (indexCheck.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_permissions_type ON permissions(permission_type)
      `);
      console.log('✅ Index idx_permissions_type créé');
    }

    // Statistiques
    const stats = await client.query(`
      SELECT permission_type, COUNT(*) as count
      FROM permissions
      GROUP BY permission_type
      ORDER BY
        CASE permission_type
          WHEN 'menu' THEN 1
          WHEN 'sous_menu' THEN 2
          WHEN 'page' THEN 3
          WHEN 'bouton' THEN 4
        END
    `);

    console.log('\n📊 Répartition des permissions par type:');
    stats.rows.forEach(row => {
      const icon = {
        'menu': '📁',
        'sous_menu': '📂',
        'page': '📄',
        'bouton': '🔘'
      }[row.permission_type] || '❓';
      console.log(`   ${icon} ${row.permission_type}: ${row.count}`);
    });

    await client.query('COMMIT');

    const totalResult = await client.query('SELECT COUNT(*) FROM permissions');

    res.json({
      success: true,
      message: 'Migration 113 exécutée avec succès',
      stats: {
        totalPermissions: parseInt(totalResult.rows[0].count),
        byType: stats.rows.reduce((acc, row) => {
          acc[row.permission_type] = parseInt(row.count);
          return acc;
        }, {})
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur Migration 113:', error);
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
    // Vérifier si la colonne existe
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'permissions' AND column_name = 'permission_type'
    `);

    const columnExists = columnCheck.rows.length > 0;

    let unclassifiedCount = 0;
    let stats = [];

    if (columnExists) {
      // Compter les permissions non classifiées
      const unclassified = await client.query(`
        SELECT COUNT(*) FROM permissions WHERE permission_type IS NULL
      `);
      unclassifiedCount = parseInt(unclassified.rows[0].count);

      // Statistiques par type
      const statsResult = await client.query(`
        SELECT permission_type, COUNT(*) as count
        FROM permissions
        GROUP BY permission_type
        ORDER BY permission_type
      `);
      stats = statsResult.rows;
    }

    const needsMigration = !columnExists || unclassifiedCount > 0;

    res.json({
      success: true,
      applied: !needsMigration,
      status: {
        columnExists,
        unclassifiedCount,
        stats: stats.reduce((acc, row) => {
          acc[row.permission_type || 'null'] = parseInt(row.count);
          return acc;
        }, {})
      },
      message: !columnExists
        ? 'Colonne permission_type manquante - Migration requise'
        : unclassifiedCount > 0
          ? `${unclassifiedCount} permissions non classifiées - Migration requise`
          : 'Toutes les permissions sont classifiées'
    });

  } catch (error) {
    console.error('Erreur status Migration 113:', error);
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
    // Simuler la classification sans modifier
    const preview = await client.query(`
      SELECT
        code,
        module,
        menu,
        action,
        label,
        CASE
          WHEN action = 'acces' AND (menu IS NULL OR menu = '' OR menu = '_section') THEN 'menu'
          WHEN action = 'acces' THEN 'sous_menu'
          WHEN action IN ('voir', 'voir_liste', 'voir_page', 'voir_toutes', 'view', 'view_page', 'view_list') THEN 'page'
          ELSE 'bouton'
        END as predicted_type
      FROM permissions
      ORDER BY module, menu, action
      LIMIT 50
    `);

    // Statistiques prédites
    const stats = await client.query(`
      SELECT
        CASE
          WHEN action = 'acces' AND (menu IS NULL OR menu = '' OR menu = '_section') THEN 'menu'
          WHEN action = 'acces' THEN 'sous_menu'
          WHEN action IN ('voir', 'voir_liste', 'voir_page', 'voir_toutes', 'view', 'view_page', 'view_list') THEN 'page'
          ELSE 'bouton'
        END as predicted_type,
        COUNT(*) as count
      FROM permissions
      GROUP BY predicted_type
      ORDER BY
        CASE predicted_type
          WHEN 'menu' THEN 1
          WHEN 'sous_menu' THEN 2
          WHEN 'page' THEN 3
          WHEN 'bouton' THEN 4
        END
    `);

    res.json({
      success: true,
      preview: {
        samplePermissions: preview.rows,
        predictedStats: stats.rows.reduce((acc, row) => {
          acc[row.predicted_type] = parseInt(row.count);
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Erreur preview Migration 113:', error);
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
