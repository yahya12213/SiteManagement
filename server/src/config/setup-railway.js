import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const setupDatabase = async () => {
  // Utiliser DATABASE_URL de Railway
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found. Please set it in Railway environment variables.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query('SELECT 1'); // Test connection
    console.log('📦 Connected to Railway PostgreSQL database...');
    console.log('Creating tables...');

    // Schéma complet
    const schema = `
      -- Table des profils (utilisateurs)
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'professor', 'gerant')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des segments
      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des villes
      CREATE TABLE IF NOT EXISTS cities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        segment_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
      );

      -- Table des segments affectés aux professeurs (many-to-many)
      CREATE TABLE IF NOT EXISTS professor_segments (
        professor_id TEXT NOT NULL,
        segment_id TEXT NOT NULL,
        PRIMARY KEY (professor_id, segment_id),
        FOREIGN KEY (professor_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
      );

      -- Table des villes affectées aux professeurs (many-to-many)
      CREATE TABLE IF NOT EXISTS professor_cities (
        professor_id TEXT NOT NULL,
        city_id TEXT NOT NULL,
        PRIMARY KEY (professor_id, city_id),
        FOREIGN KEY (professor_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
      );

      -- Table des fiches de calcul
      CREATE TABLE IF NOT EXISTS calculation_sheets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        template_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
        sheet_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des segments affectés aux fiches (many-to-many)
      CREATE TABLE IF NOT EXISTS calculation_sheet_segments (
        sheet_id TEXT NOT NULL,
        segment_id TEXT NOT NULL,
        PRIMARY KEY (sheet_id, segment_id),
        FOREIGN KEY (sheet_id) REFERENCES calculation_sheets(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
      );

      -- Table des villes affectées aux fiches (many-to-many)
      CREATE TABLE IF NOT EXISTS calculation_sheet_cities (
        sheet_id TEXT NOT NULL,
        city_id TEXT NOT NULL,
        PRIMARY KEY (sheet_id, city_id),
        FOREIGN KEY (sheet_id) REFERENCES calculation_sheets(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
      );

      -- Table des déclarations de professeurs
      CREATE TABLE IF NOT EXISTS professor_declarations (
        id TEXT PRIMARY KEY,
        professor_id TEXT NOT NULL,
        calculation_sheet_id TEXT NOT NULL,
        segment_id TEXT NOT NULL,
        city_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        form_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'brouillon' CHECK(status IN ('brouillon', 'soumise', 'en_cours', 'approuvee', 'refusee', 'a_declarer')),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (calculation_sheet_id) REFERENCES calculation_sheets(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
      );

      -- Insérer un admin par défaut
      INSERT INTO profiles (id, username, password, full_name, role)
      VALUES ('admin_1', 'admin', '$2a$10$XQZ9cKZJ6rPzN.z5w5vZDeH8YnZ1vQxZJ7XZ7qJzN1vQxZJ7XZ7qJ', 'Administrateur', 'admin')
      ON CONFLICT (username) DO NOTHING;
    `;

    await pool.query(schema);
    console.log('✅ Tables created successfully!');

    // Vérifier les tables créées
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n📊 Created ${result.rows.length} tables:`);
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n✅ Database setup complete!');
    console.log('\n📝 Default admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error(error);
    process.exit(1);
  }
};

setupDatabase();
