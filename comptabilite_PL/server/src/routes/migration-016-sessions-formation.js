import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 016: Système de Sessions de Formation (Classes)
 *
 * Crée les tables nécessaires pour gérer les sessions de formation:
 * - sessions_formation: Les sessions/classes de formation
 * - session_etudiants: Inscriptions des étudiants aux sessions
 * - session_professeurs: Affectation des professeurs aux sessions
 * - session_fichiers: Fichiers de tests et présences
 */

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 016: Sessions de Formation ===');

    // Table sessions_formation
    console.log('Création de la table sessions_formation...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions_formation (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        titre VARCHAR(255) NOT NULL,
        description TEXT,
        date_debut DATE,
        date_fin DATE,
        ville_id TEXT,
        segment_id TEXT,
        formation_id TEXT,
        statut VARCHAR(50) DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')),
        prix_total DECIMAL(10, 2) DEFAULT 0,
        nombre_places INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Index pour performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_ville ON sessions_formation(ville_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_segment ON sessions_formation(segment_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_formation ON sessions_formation(formation_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_statut ON sessions_formation(statut);
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_dates ON sessions_formation(date_debut, date_fin);
    `);

    // Table session_etudiants (inscriptions)
    console.log('Création de la table session_etudiants...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_etudiants (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL,
        statut_paiement VARCHAR(50) DEFAULT 'impaye' CHECK (statut_paiement IN ('paye', 'partiellement_paye', 'impaye')),
        montant_total DECIMAL(10, 2) DEFAULT 0,
        montant_paye DECIMAL(10, 2) DEFAULT 0,
        montant_du DECIMAL(10, 2) DEFAULT 0,
        date_inscription TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(session_id, student_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_etudiants_session ON session_etudiants(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_etudiants_student ON session_etudiants(student_id);
      CREATE INDEX IF NOT EXISTS idx_session_etudiants_statut ON session_etudiants(statut_paiement);
    `);

    // Table session_professeurs (affectation)
    console.log('Création de la table session_professeurs...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_professeurs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
        professeur_id TEXT NOT NULL,
        date_affectation TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(session_id, professeur_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_professeurs_session ON session_professeurs(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_professeurs_prof ON session_professeurs(professeur_id);
    `);

    // Table session_fichiers (tests et présences)
    console.log('Création de la table session_fichiers...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_fichiers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('test', 'presence')),
        titre VARCHAR(255) NOT NULL,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_fichiers_session ON session_fichiers(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_fichiers_type ON session_fichiers(type);
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 016 exécutée avec succès',
      tables_created: [
        'sessions_formation',
        'session_etudiants',
        'session_professeurs',
        'session_fichiers'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de la migration 016:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
