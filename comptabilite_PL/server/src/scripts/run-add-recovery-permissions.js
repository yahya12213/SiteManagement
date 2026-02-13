/**
 * Script pour ajouter les permissions de récupération d'heures
 * Usage: node server/src/scripts/run-add-recovery-permissions.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  host: process.env.PGHOST || 'maglev.proxy.rlwy.net',
  port: process.env.PGPORT || 17589,
  database: process.env.PGDATABASE || 'railway',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'kMfsYpEZqZorPiMaUPvQnOoBqysrEjQx',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runScript() {
  const client = await pool.connect();

  try {
    console.log('🔗 Connexion à la base de données...');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'add-recovery-permissions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Exécution du script SQL...\n');

    // Exécuter le script
    const result = await client.query(sql);

    console.log('✅ Script exécuté avec succès!\n');
    console.log('📊 Résultats:');

    // Afficher les résultats de la dernière requête (SELECT de vérification)
    if (result.rows && result.rows.length > 0) {
      console.log('\nRôles ayant les permissions de récupération:');
      console.log('─'.repeat(80));
      result.rows.forEach(row => {
        console.log(`${row.role_name.padEnd(30)} | ${row.permission_code}`);
      });
      console.log('─'.repeat(80));
      console.log(`Total: ${result.rows.length} attributions de permissions\n`);
    } else {
      console.log('\nℹ️  Aucune attribution de permissions (peut-être déjà existantes)\n');
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution du script:', error.message);
    console.error('Détails:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter le script
runScript()
  .then(() => {
    console.log('✨ Terminé!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
