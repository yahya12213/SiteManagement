import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function extractData() {
  console.log('🔍 Chargement de la base de données SQLite...');

  const SQL = await initSqlJs();
  const dbPath = 'C:\\Users\\pc\\Downloads\\accounting_2025-10-21.db';
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const data = {
    profiles: [],
    segments: [],
    cities: [],
    professor_segments: [],
    professor_cities: [],
    calculation_sheets: [],
    calculation_sheet_segments: [],
    calculation_sheet_cities: [],
    professor_declarations: []
  };

  // Helper pour extraire les données d'une table
  function extractTable(tableName) {
    try {
      const result = db.exec(`SELECT * FROM ${tableName}`);
      if (!result || result.length === 0) {
        console.log(`⚠️  Table ${tableName} est vide`);
        return [];
      }

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    } catch (error) {
      console.log(`⚠️  Table ${tableName} n'existe pas ou erreur:`, error.message);
      return [];
    }
  }

  // Extraire toutes les tables
  console.log('📊 Extraction des données...\n');

  data.profiles = extractTable('profiles');
  console.log(`✓ profiles: ${data.profiles.length} lignes`);

  data.segments = extractTable('segments');
  console.log(`✓ segments: ${data.segments.length} lignes`);

  data.cities = extractTable('cities');
  console.log(`✓ cities: ${data.cities.length} lignes`);

  data.professor_segments = extractTable('professor_segments');
  console.log(`✓ professor_segments: ${data.professor_segments.length} lignes`);

  data.professor_cities = extractTable('professor_cities');
  console.log(`✓ professor_cities: ${data.professor_cities.length} lignes`);

  data.calculation_sheets = extractTable('calculation_sheets');
  console.log(`✓ calculation_sheets: ${data.calculation_sheets.length} lignes`);

  data.calculation_sheet_segments = extractTable('calculation_sheet_segments');
  console.log(`✓ calculation_sheet_segments: ${data.calculation_sheet_segments.length} lignes`);

  data.calculation_sheet_cities = extractTable('calculation_sheet_cities');
  console.log(`✓ calculation_sheet_cities: ${data.calculation_sheet_cities.length} lignes`);

  data.professor_declarations = extractTable('professor_declarations');
  console.log(`✓ professor_declarations: ${data.professor_declarations.length} lignes`);

  db.close();

  // Sauvegarder en JSON pour inspection
  const outputPath = path.join(process.cwd(), 'scripts', 'extracted-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\n💾 Données extraites sauvegardées dans: ${outputPath}`);

  return data;
}

// Fonction pour générer le SQL
function generateSQL(data) {
  console.log('\n🔨 Génération du fichier SQL...');

  let sql = `-- Migration générée automatiquement depuis accounting_2025-10-21.db
-- Date: ${new Date().toISOString()}

-- Désactiver temporairement les contraintes de clés étrangères
SET session_replication_role = replica;

`;

  // Helper pour échapper les valeurs SQL
  function escapeSql(value) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    // Échapper les guillemets simples
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  // Mapper les colonnes de l'ancien schéma vers le nouveau
  function mapColumns(tableName, record) {
    const mapped = { ...record };

    if (tableName === 'profiles') {
      // password_hash -> password
      if (mapped.password_hash !== undefined) {
        mapped.password = mapped.password_hash;
        delete mapped.password_hash;
      }
      // Supprimer updated_at qui n'existe pas dans le nouveau schéma
      delete mapped.updated_at;
    }

    if (tableName === 'segments') {
      // Supprimer logo_url si présent (pas dans le nouveau schéma)
      delete mapped.logo_url;
    }

    if (tableName === 'cities') {
      // Supprimer code si présent (pas dans le nouveau schéma)
      delete mapped.code;
    }

    if (tableName === 'calculation_sheets') {
      // Supprimer segment_id et city_id (on utilise les tables de jonction)
      delete mapped.segment_id;
      delete mapped.city_id;
      // Supprimer updated_at
      delete mapped.updated_at;
    }

    if (tableName === 'professor_declarations') {
      // Supprimer updated_at
      delete mapped.updated_at;
    }

    // Tables de jonction : supprimer id et created_at
    if (tableName === 'professor_segments' ||
        tableName === 'professor_cities' ||
        tableName === 'calculation_sheet_segments' ||
        tableName === 'calculation_sheet_cities') {
      delete mapped.id;
      delete mapped.created_at;
    }

    return mapped;
  }

  // Fonction pour générer les INSERT d'une table
  function generateInserts(tableName, records) {
    if (records.length === 0) {
      return `-- Table ${tableName}: Aucune donnée\n`;
    }

    let inserts = `-- Table ${tableName}: ${records.length} enregistrements\n`;

    records.forEach(record => {
      const mappedRecord = mapColumns(tableName, record);
      const columns = Object.keys(mappedRecord).join(', ');
      const values = Object.values(mappedRecord).map(escapeSql).join(', ');
      inserts += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
    });

    return inserts + '\n';
  }

  // Ordre d'insertion (respecter les clés étrangères)
  sql += generateInserts('profiles', data.profiles);
  sql += generateInserts('segments', data.segments);
  sql += generateInserts('cities', data.cities);
  sql += generateInserts('professor_segments', data.professor_segments);
  sql += generateInserts('professor_cities', data.professor_cities);
  sql += generateInserts('calculation_sheets', data.calculation_sheets);
  sql += generateInserts('calculation_sheet_segments', data.calculation_sheet_segments);
  sql += generateInserts('calculation_sheet_cities', data.calculation_sheet_cities);
  sql += generateInserts('professor_declarations', data.professor_declarations);

  sql += `\n-- Réactiver les contraintes de clés étrangères
SET session_replication_role = DEFAULT;

-- Mettre à jour les séquences si nécessaire
-- (Supabase gère cela automatiquement avec les UUID)
`;

  return sql;
}

// Exécution principale
extractData()
  .then(data => {
    const sql = generateSQL(data);
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20250101000001_import_data.sql');

    // Créer le dossier migrations s'il n'existe pas
    const dir = path.dirname(sqlPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(sqlPath, sql);
    console.log(`✅ Fichier SQL généré: ${sqlPath}`);
    console.log('\n📝 Prochaine étape: Appliquer la migration avec "supabase db reset"');
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
