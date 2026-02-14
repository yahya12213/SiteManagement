import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET statistiques complètes du dashboard
// Protected: Requires authentication and dashboard view permission
router.get('/dashboard-stats',
  authenticateToken,
  requirePermission('accounting.dashboard.view_page'),
  async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Statistiques par statut
    const statusStats = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM professor_declarations
      GROUP BY status
    `);

    const stats = {
      total: 0,
      brouillon: 0,
      a_declarer: 0,
      soumise: 0,
      en_cours: 0,
      approuvee: 0,
      refusee: 0,
    };

    statusStats.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    // 2. Fiches expirées (end_date < aujourd'hui ET status != 'approuvee')
    const expiredQuery = await pool.query(`
      SELECT
        COUNT(*) as total_expired,
        COUNT(*) FILTER (WHERE end_date::date < (CURRENT_DATE - INTERVAL '30 days')) as expired_critical,
        COUNT(*) FILTER (WHERE end_date::date >= (CURRENT_DATE - INTERVAL '30 days') AND end_date::date < (CURRENT_DATE - INTERVAL '7 days')) as expired_warning,
        COUNT(*) FILTER (WHERE end_date::date >= (CURRENT_DATE - INTERVAL '7 days') AND end_date::date < CURRENT_DATE) as expired_info
      FROM professor_declarations
      WHERE end_date::date < CURRENT_DATE
        AND status != 'approuvee'
    `);

    const expired = expiredQuery.rows[0];

    // 3. Déclarations arrivant à échéance (end_date dans 7 jours AND status != 'approuvee')
    const expiringQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM professor_declarations
      WHERE end_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
        AND status != 'approuvee'
    `);

    const expiring = parseInt(expiringQuery.rows[0].count);

    // 4. Déclarations en retard de traitement (submitted_at < 7 jours AND status = 'soumise')
    const lateProcessingQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM professor_declarations
      WHERE submitted_at < (CURRENT_TIMESTAMP - INTERVAL '7 days')
        AND status = 'soumise'
    `);

    const lateProcessing = parseInt(lateProcessingQuery.rows[0].count);

    // 5. Taux d'approbation (approuvees / (approuvees + refusees)) * 100
    const approvalRate = stats.approuvee + stats.refusee > 0
      ? ((stats.approuvee / (stats.approuvee + stats.refusee)) * 100).toFixed(1)
      : 0;

    // 6. Délai moyen de traitement (temps entre submitted_at et reviewed_at)
    const avgProcessingQuery = await pool.query(`
      SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 86400)::numeric, 1) as avg_days
      FROM professor_declarations
      WHERE submitted_at IS NOT NULL
        AND reviewed_at IS NOT NULL
    `);

    const avgProcessingTime = avgProcessingQuery.rows[0].avg_days || 0;

    // 7. Revenus totaux (somme des charges de toutes les fiches approuvées)
    // Note: form_data est un JSON, on cherche le champ "total_charges" ou similaire
    const revenueQuery = await pool.query(`
      SELECT
        SUM(
          CASE
            WHEN form_data::jsonb ? 'F100'
            THEN CAST(form_data::jsonb->>'F100' AS NUMERIC)
            ELSE 0
          END
        ) as total_revenue
      FROM professor_declarations
      WHERE status = 'approuvee'
    `);

    const totalRevenue = revenueQuery.rows[0].total_revenue || 0;

    // 8. Top 3 segments
    const topSegmentsQuery = await pool.query(`
      SELECT
        s.name,
        COUNT(pd.id) as count
      FROM professor_declarations pd
      JOIN segments s ON pd.segment_id = s.id
      GROUP BY s.id, s.name
      ORDER BY count DESC
      LIMIT 3
    `);

    const topSegments = topSegmentsQuery.rows;

    // 9. Top 5 villes
    const topCitiesQuery = await pool.query(`
      SELECT
        c.name,
        COUNT(pd.id) as count
      FROM professor_declarations pd
      JOIN cities c ON pd.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT 5
    `);

    const topCities = topCitiesQuery.rows;

    // 10. Top 5 professeurs les plus actifs
    const topProfessorsQuery = await pool.query(`
      SELECT
        p.full_name,
        COUNT(pd.id) as count
      FROM professor_declarations pd
      JOIN profiles p ON pd.professor_id = p.id
      WHERE p.role = 'professor'
      GROUP BY p.id, p.full_name
      ORDER BY count DESC
      LIMIT 5
    `);

    const topProfessors = topProfessorsQuery.rows;

    // Retourner toutes les statistiques
    res.json({
      statusStats: stats,
      alerts: {
        expired: {
          total: parseInt(expired.total_expired),
          critical: parseInt(expired.expired_critical),
          warning: parseInt(expired.expired_warning),
          info: parseInt(expired.expired_info),
        },
        expiring: expiring,
        lateProcessing: lateProcessing,
      },
      metrics: {
        approvalRate: parseFloat(approvalRate),
        avgProcessingTime: parseFloat(avgProcessingTime),
        totalRevenue: parseFloat(totalRevenue),
      },
      rankings: {
        topSegments,
        topCities,
        topProfessors,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
