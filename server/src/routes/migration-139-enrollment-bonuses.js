/**
 * Migration 139: Tables pour les primes d'inscription
 *
 * Crée:
 * - hr_enrollment_bonus_rates: Configuration des taux par type de formation
 * - hr_enrollment_bonuses: Primes attribuées aux employés
 *
 * Les conseillers/secrétaires reçoivent des primes variables selon le type de formation.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 139: Création des tables primes d\'inscription...');

    // Table de configuration des taux par formation
    console.log('  - Création de hr_enrollment_bonus_rates...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_enrollment_bonus_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        formation_type TEXT NOT NULL UNIQUE,
        formation_label TEXT NOT NULL,
        bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insérer les taux par défaut
    await client.query(`
      INSERT INTO hr_enrollment_bonus_rates (formation_type, formation_label, bonus_amount, description) VALUES
        ('licence', 'Licence', 100.00, 'Prime pour inscription en Licence'),
        ('master', 'Master', 150.00, 'Prime pour inscription en Master'),
        ('doctorat', 'Doctorat', 200.00, 'Prime pour inscription en Doctorat'),
        ('formation_continue', 'Formation Continue', 75.00, 'Prime pour inscription en formation continue'),
        ('certificat', 'Certificat', 50.00, 'Prime pour inscription en certificat')
      ON CONFLICT (formation_type) DO NOTHING
    `);

    console.log('  - Table hr_enrollment_bonus_rates créée avec taux par défaut');

    // Table des primes attribuées
    console.log('  - Création de hr_enrollment_bonuses...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_enrollment_bonuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        enrollment_id UUID,
        student_name TEXT NOT NULL,
        student_cin TEXT,
        formation_type TEXT NOT NULL,
        formation_name TEXT,
        academic_year TEXT,
        bonus_amount DECIMAL(10,2) NOT NULL,
        enrollment_date DATE NOT NULL,
        payroll_period_id UUID REFERENCES hr_payroll_periods(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'paid', 'cancelled')),
        validated_by TEXT REFERENCES profiles(id),
        validated_at TIMESTAMP,
        paid_in_period_id UUID REFERENCES hr_payroll_periods(id),
        notes TEXT,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('  - Table hr_enrollment_bonuses créée');

    // Créer les index
    console.log('  - Création des index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollment_bonuses_employee ON hr_enrollment_bonuses(employee_id);
      CREATE INDEX IF NOT EXISTS idx_enrollment_bonuses_status ON hr_enrollment_bonuses(status);
      CREATE INDEX IF NOT EXISTS idx_enrollment_bonuses_period ON hr_enrollment_bonuses(payroll_period_id);
      CREATE INDEX IF NOT EXISTS idx_enrollment_bonuses_date ON hr_enrollment_bonuses(enrollment_date);
      CREATE INDEX IF NOT EXISTS idx_enrollment_bonuses_paid_period ON hr_enrollment_bonuses(paid_in_period_id);
    `);

    // Créer trigger updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_enrollment_bonus_rates_updated_at ON hr_enrollment_bonus_rates;
      CREATE TRIGGER update_hr_enrollment_bonus_rates_updated_at
        BEFORE UPDATE ON hr_enrollment_bonus_rates
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_enrollment_bonuses_updated_at ON hr_enrollment_bonuses;
      CREATE TRIGGER update_hr_enrollment_bonuses_updated_at
        BEFORE UPDATE ON hr_enrollment_bonuses
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);

    console.log('  - Index et triggers créés');

    // Ajouter les permissions
    console.log('  - Ajout des permissions...');
    await client.query(`
      INSERT INTO permissions (module, menu, action, code, label, description, sort_order, permission_type) VALUES
        ('hr', 'primes_inscription', 'view', 'hr.enrollment_bonuses.view', 'Voir les primes', 'Voir la liste des primes d''inscription', 1, 'page'),
        ('hr', 'primes_inscription', 'create', 'hr.enrollment_bonuses.create', 'Créer une prime', 'Ajouter une nouvelle prime d''inscription', 2, 'bouton'),
        ('hr', 'primes_inscription', 'validate', 'hr.enrollment_bonuses.validate', 'Valider les primes', 'Valider les primes pour la paie', 3, 'bouton'),
        ('hr', 'primes_inscription', 'config', 'hr.enrollment_bonuses.config', 'Configurer les taux', 'Modifier les taux de primes par formation', 4, 'bouton')
      ON CONFLICT (code) DO NOTHING
    `);

    await client.query('COMMIT');

    // Récupérer les stats
    const rates = await client.query('SELECT COUNT(*) FROM hr_enrollment_bonus_rates');

    res.json({
      success: true,
      message: 'Migration 139 completed: Tables primes d\'inscription créées',
      changes: [
        'Table hr_enrollment_bonus_rates créée',
        'Table hr_enrollment_bonuses créée',
        `${rates.rows[0].count} taux de primes configurés par défaut`,
        'Index et triggers créés',
        'Permissions ajoutées'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 139 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que les tables hr_employees et hr_payroll_periods existent'
    });
  } finally {
    client.release();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    const tablesCheck = await pool.query(`
      SELECT
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hr_enrollment_bonus_rates') as rates_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hr_enrollment_bonuses') as bonuses_exists
    `);

    const { rates_exists, bonuses_exists } = tablesCheck.rows[0];
    const applied = rates_exists && bonuses_exists;

    let stats = null;
    if (applied) {
      const ratesCount = await pool.query('SELECT COUNT(*) FROM hr_enrollment_bonus_rates WHERE is_active = true');
      const bonusesCount = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'validated') as validated,
          COUNT(*) FILTER (WHERE status = 'paid') as paid
        FROM hr_enrollment_bonuses
      `);

      stats = {
        active_rates: parseInt(ratesCount.rows[0].count),
        ...bonusesCount.rows[0]
      };
    }

    res.json({
      success: true,
      applied,
      tables: {
        hr_enrollment_bonus_rates: rates_exists,
        hr_enrollment_bonuses: bonuses_exists
      },
      stats,
      message: applied
        ? 'Migration appliquée - Tables primes inscription disponibles'
        : 'Migration non appliquée'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rollback
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rollback Migration 139...');

    await client.query('DROP TABLE IF EXISTS hr_enrollment_bonuses CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_enrollment_bonus_rates CASCADE');
    await client.query(`DELETE FROM permissions WHERE code LIKE 'hr.enrollment_bonuses%'`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 139 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
