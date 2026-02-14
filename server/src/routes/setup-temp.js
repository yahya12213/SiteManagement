import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Route temporaire pour créer les tables (À SUPPRIMER APRÈS UTILISATION!)
router.post('/setup-database', async (req, res) => {
  try {
    console.log('📦 Setting up database tables...');

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

      -- Table des sessions de formation
      CREATE TABLE IF NOT EXISTS formation_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        formation_id TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        segment_id TEXT,
        city_id TEXT,
        instructor_id TEXT,
        max_capacity INTEGER,
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE SET NULL,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL,
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
        FOREIGN KEY (instructor_id) REFERENCES profiles(id) ON DELETE SET NULL
      );

      -- Table des inscriptions aux sessions de formation
      CREATE TABLE IF NOT EXISTS formation_enrollments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'enrolled' CHECK(status IN ('enrolled', 'completed', 'dropped')),
        notes TEXT,
        FOREIGN KEY (session_id) REFERENCES formation_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
        UNIQUE(session_id, student_id)
      );

      -- Table des formations en ligne
      CREATE TABLE IF NOT EXISTS formations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10, 2),
        duration_hours INTEGER,
        level TEXT CHECK(level IN ('debutant', 'intermediaire', 'avance')),
        thumbnail_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
        passing_score_percentage INTEGER DEFAULT 80,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des modules de formation (étapes/chapitres)
      CREATE TABLE IF NOT EXISTS formation_modules (
        id TEXT PRIMARY KEY,
        formation_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL,
        prerequisite_module_id TEXT,
        module_type TEXT NOT NULL CHECK(module_type IN ('video', 'test', 'document')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,
        FOREIGN KEY (prerequisite_module_id) REFERENCES formation_modules(id) ON DELETE SET NULL
      );

      -- Table des vidéos des modules
      CREATE TABLE IF NOT EXISTS module_videos (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        title TEXT NOT NULL,
        youtube_url TEXT NOT NULL,
        duration_seconds INTEGER,
        description TEXT,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES formation_modules(id) ON DELETE CASCADE
      );

      -- Table des tests des modules
      CREATE TABLE IF NOT EXISTS module_tests (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        passing_score INTEGER DEFAULT 80,
        time_limit_minutes INTEGER,
        max_attempts INTEGER,
        show_correct_answers BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES formation_modules(id) ON DELETE CASCADE
      );

      -- Table des questions de test
      CREATE TABLE IF NOT EXISTS test_questions (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK(question_type IN ('multiple_choice')),
        points INTEGER DEFAULT 1,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (test_id) REFERENCES module_tests(id) ON DELETE CASCADE
      );

      -- Table des choix de réponse
      CREATE TABLE IF NOT EXISTS question_choices (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        choice_text TEXT NOT NULL,
        is_correct BOOLEAN DEFAULT false,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE
      );

      -- Insérer un admin par défaut
      INSERT INTO profiles (id, username, password, full_name, role)
      VALUES ('admin_1', 'admin', '$2a$10$XQZ9cKZJ6rPzN.z5w5vZDeH8YnZ1vQxZJ7XZ7qJzN1vQxZJ7XZ7qJ', 'Administrateur', 'admin')
      ON CONFLICT (username) DO NOTHING;
    `;

    await pool.query(schema);

    // Vérifier les tables créées
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`✅ Created ${result.rows.length} tables successfully!`);

    res.json({
      success: true,
      message: 'Database tables created successfully!',
      tables: result.rows.map(r => r.table_name)
    });

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour nettoyer et réimporter les données
router.post('/reset-data', async (req, res) => {
  try {
    console.log('🧹 Cleaning and reimporting data...');

    // Supprimer tous les profils (cascade va supprimer les relations)
    await pool.query('DELETE FROM profiles');
    console.log('✅ Profiles cleared');

    res.json({
      success: true,
      message: 'Data cleared. Now run migration and hash scripts.'
    });

  } catch (error) {
    console.error('❌ Error resetting data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour importer TOUTES les données depuis le fichier SQL + hash passwords
router.post('/import-all-data', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🚀 Reading SQL file...');

    // Lire le fichier SQL
    const sqlPath = join(__dirname, '../scripts/migrate-data.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('🚀 Starting complete data import from SQL file...');
    await client.query('BEGIN');

    // Exécuter le fichier SQL complet
    await client.query(sql);
    console.log('✅ All data imported from SQL file');

    // Hasher les mots de passe
    const users = await client.query('SELECT id, username, password FROM profiles');
    for (const user of users.rows) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await client.query('UPDATE profiles SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
      console.log(`✅ ${user.username}: Password hashed`);
    }

    await client.query('COMMIT');

    // Vérifier les données
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM profiles) as profiles,
        (SELECT COUNT(*) FROM segments) as segments,
        (SELECT COUNT(*) FROM cities) as cities,
        (SELECT COUNT(*) FROM calculation_sheets) as sheets,
        (SELECT COUNT(*) FROM professor_segments) as prof_segments,
        (SELECT COUNT(*) FROM professor_cities) as prof_cities,
        (SELECT COUNT(*) FROM calculation_sheet_segments) as sheet_segments,
        (SELECT COUNT(*) FROM calculation_sheet_cities) as sheet_cities
    `);

    console.log('✅ All data imported and passwords hashed!');

    res.json({
      success: true,
      message: 'All data imported from SQL file and passwords hashed!',
      counts: counts.rows[0],
      credentials: {
        admin: 'admin / admin123',
        professor: 'khalidfathi / khalidfathi'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

export default router;
