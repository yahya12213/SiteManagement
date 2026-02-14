/**
 * Migration 140: Initialiser les lignes de pointage quotidiennes
 *
 * Endpoint pour exécuter manuellement le job d'initialisation des lignes
 * de pointage pour tous les employés actifs.
 *
 * Ceci est utile pour:
 * - Initialiser les lignes pour aujourd'hui (après déploiement)
 * - Re-exécuter en cas de problème
 */

import express from 'express';
import { initializeDailyAttendance } from '../jobs/daily-attendance-init.js';

const router = express.Router();

// Run endpoint - exécute l'initialisation
router.post('/run', async (req, res) => {
  try {
    console.log('Migration 140: Initializing daily attendance records...');
    const result = await initializeDailyAttendance();

    res.json({
      success: true,
      message: `Lignes de pointage créées pour ${result.date}`,
      data: result,
      changes: [
        `Date: ${result.date}`,
        `${result.created} lignes créées`,
        `${result.existing} existaient déjà`,
        `${result.specialDays} jours spéciaux (weekend, férié, congé, etc.)`,
        `${result.total} employés traités`
      ]
    });
  } catch (error) {
    console.error('Migration 140 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que le job daily-attendance-init.js existe et que la BDD est accessible'
    });
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      applied: true,
      message: 'Job d\'initialisation quotidienne disponible - peut être exécuté à tout moment'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
