#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pool, { testConnection } from './database.js';

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'comptabilite-pl',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  {
    name: 'list_prospects',
    description: 'Liste les prospects avec filtres optionnels. Retourne les informations de base des prospects.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        segment: {
          type: 'string',
          description: 'Filtrer par nom de segment (ex: "Formation Initiale")',
        },
        ville: {
          type: 'string',
          description: 'Filtrer par nom de ville (ex: "Casablanca")',
        },
        statut: {
          type: 'string',
          enum: ['non contacté', 'contacté avec rdv', 'contacté sans rdv', 'inscrit'],
          description: 'Filtrer par statut de contact',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats (défaut: 50, max: 200)',
        },
        offset: {
          type: 'number',
          description: 'Nombre de résultats à sauter pour la pagination',
        },
      },
    },
  },
  {
    name: 'search_prospects',
    description: 'Recherche un prospect par numéro de téléphone, nom ou prénom.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Texte à rechercher (téléphone, nom ou prénom)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_prospect',
    description: 'Obtient les détails complets d\'un prospect par son ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'ID du prospect (8 chiffres)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_prospect_calls',
    description: 'Obtient l\'historique des appels d\'un prospect.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prospect_id: {
          type: 'string',
          description: 'ID du prospect',
        },
      },
      required: ['prospect_id'],
    },
  },
  {
    name: 'get_stats',
    description: 'Obtient les statistiques globales des prospects (total, par statut, taux de conversion).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        segment: {
          type: 'string',
          description: 'Filtrer par segment (optionnel)',
        },
        ville: {
          type: 'string',
          description: 'Filtrer par ville (optionnel)',
        },
        date_from: {
          type: 'string',
          description: 'Date de début (format: YYYY-MM-DD)',
        },
        date_to: {
          type: 'string',
          description: 'Date de fin (format: YYYY-MM-DD)',
        },
      },
    },
  },
  {
    name: 'get_stats_by_segment',
    description: 'Obtient les statistiques groupées par segment.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_stats_by_ville',
    description: 'Obtient les statistiques groupées par ville.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_stats_by_assistant',
    description: 'Obtient les statistiques groupées par assistante commerciale.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_cleaning_stats',
    description: 'Obtient les statistiques de nettoyage des prospects (à garder, à supprimer, à revoir).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_ecart_details',
    description: 'Obtient les écarts entre les inscriptions dans les sessions de formation et les prospects marqués "inscrit".',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_segments',
    description: 'Liste tous les segments disponibles.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_villes',
    description: 'Liste toutes les villes disponibles.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_assistants',
    description: 'Liste toutes les assistantes commerciales.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'analyze_health',
    description: 'Calcule un score de santé commerciale (0-100) basé sur les indicateurs clés.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_recommendations',
    description: 'Génère des recommandations automatiques basées sur l\'analyse des données.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'test_connection',
    description: 'Teste la connexion à la base de données.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function listProspects(args: {
  segment?: string;
  ville?: string;
  statut?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(args.limit || 50, 200);
  const offset = args.offset || 0;

  let query = `
    SELECT
      p.id,
      p.phone_international,
      p.nom,
      p.prenom,
      p.statut_contact,
      p.date_rdv,
      p.date_injection,
      s.name as segment_name,
      c.name as ville_name,
      pr.full_name as assigned_to_name
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    LEFT JOIN cities c ON p.ville_id = c.id
    LEFT JOIN profiles pr ON p.assigned_to = pr.id
    WHERE 1=1
  `;

  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (args.segment) {
    query += ` AND LOWER(s.name) LIKE LOWER($${paramIndex})`;
    params.push(`%${args.segment}%`);
    paramIndex++;
  }

  if (args.ville) {
    query += ` AND LOWER(c.name) LIKE LOWER($${paramIndex})`;
    params.push(`%${args.ville}%`);
    paramIndex++;
  }

  if (args.statut) {
    query += ` AND p.statut_contact = $${paramIndex}`;
    params.push(args.statut);
    paramIndex++;
  }

  query += ` ORDER BY p.date_injection DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            count: result.rows.length,
            offset,
            limit,
            prospects: result.rows,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function searchProspects(query: string) {
  const searchQuery = `
    SELECT
      p.id,
      p.phone_international,
      p.nom,
      p.prenom,
      p.statut_contact,
      p.date_rdv,
      s.name as segment_name,
      c.name as ville_name
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    LEFT JOIN cities c ON p.ville_id = c.id
    WHERE
      p.phone_international ILIKE $1
      OR p.phone_raw ILIKE $1
      OR p.nom ILIKE $1
      OR p.prenom ILIKE $1
    ORDER BY p.date_injection DESC
    LIMIT 20
  `;

  const result = await pool.query(searchQuery, [`%${query}%`]);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            query,
            count: result.rows.length,
            prospects: result.rows,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getProspect(id: string) {
  const result = await pool.query(
    `
    SELECT
      p.*,
      s.name as segment_name,
      c.name as ville_name,
      rdv_c.name as rdv_centre_name,
      pr.full_name as assigned_to_name,
      cr.full_name as created_by_name
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    LEFT JOIN cities c ON p.ville_id = c.id
    LEFT JOIN cities rdv_c ON p.rdv_centre_ville_id = rdv_c.id
    LEFT JOIN profiles pr ON p.assigned_to = pr.id
    LEFT JOIN profiles cr ON p.created_by = cr.id
    WHERE p.id = $1
  `,
    [id]
  );

  if (result.rows.length === 0) {
    return {
      content: [{ type: 'text' as const, text: `Prospect avec ID "${id}" non trouvé.` }],
    };
  }

  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(result.rows[0], null, 2) },
    ],
  };
}

async function getProspectCalls(prospectId: string) {
  const result = await pool.query(
    `
    SELECT
      pch.id,
      pch.call_start,
      pch.call_end,
      pch.duration_seconds,
      pch.status_before,
      pch.status_after,
      pch.commentaire,
      pr.full_name as user_name
    FROM prospect_call_history pch
    LEFT JOIN profiles pr ON pch.user_id = pr.id
    WHERE pch.prospect_id = $1
    ORDER BY pch.call_start DESC
  `,
    [prospectId]
  );

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            prospect_id: prospectId,
            total_calls: result.rows.length,
            total_duration: result.rows.reduce(
              (sum, r) => sum + (r.duration_seconds || 0),
              0
            ),
            calls: result.rows,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getStats(args: {
  segment?: string;
  ville?: string;
  date_from?: string;
  date_to?: string;
}) {
  let whereClause = '1=1';
  const params: string[] = [];
  let paramIndex = 1;

  if (args.segment) {
    whereClause += ` AND s.name ILIKE $${paramIndex}`;
    params.push(`%${args.segment}%`);
    paramIndex++;
  }

  if (args.ville) {
    whereClause += ` AND c.name ILIKE $${paramIndex}`;
    params.push(`%${args.ville}%`);
    paramIndex++;
  }

  if (args.date_from) {
    whereClause += ` AND p.date_injection >= $${paramIndex}`;
    params.push(args.date_from);
    paramIndex++;
  }

  if (args.date_to) {
    whereClause += ` AND p.date_injection <= $${paramIndex}`;
    params.push(args.date_to);
    paramIndex++;
  }

  const result = await pool.query(
    `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE p.statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE p.statut_contact = 'contacté sans rdv') as sans_rdv,
      COUNT(*) FILTER (WHERE p.statut_contact = 'inscrit') as inscrits
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    LEFT JOIN cities c ON p.ville_id = c.id
    WHERE ${whereClause}
  `,
    params
  );

  const stats = result.rows[0];
  const total = parseInt(stats.total);
  const inscrits = parseInt(stats.inscrits);
  const avecRdv = parseInt(stats.avec_rdv);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total,
            non_contactes: parseInt(stats.non_contactes),
            avec_rdv: avecRdv,
            sans_rdv: parseInt(stats.sans_rdv),
            inscrits,
            taux_rdv: total > 0 ? ((avecRdv / total) * 100).toFixed(1) + '%' : '0%',
            taux_conversion:
              total > 0 ? ((inscrits / total) * 100).toFixed(1) + '%' : '0%',
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getStatsBySegment() {
  const result = await pool.query(`
    SELECT
      s.name as segment,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE p.statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE p.statut_contact = 'inscrit') as inscrits
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    GROUP BY s.id, s.name
    ORDER BY COUNT(*) DESC
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ segments: result.rows }, null, 2),
      },
    ],
  };
}

async function getStatsByVille() {
  const result = await pool.query(`
    SELECT
      c.name as ville,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE p.statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE p.statut_contact = 'inscrit') as inscrits
    FROM prospects p
    LEFT JOIN cities c ON p.ville_id = c.id
    GROUP BY c.id, c.name
    ORDER BY COUNT(*) DESC
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ villes: result.rows }, null, 2),
      },
    ],
  };
}

async function getStatsByAssistant() {
  const result = await pool.query(`
    SELECT
      pr.full_name as assistant,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE p.statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE p.statut_contact = 'inscrit') as inscrits
    FROM prospects p
    LEFT JOIN profiles pr ON p.assigned_to = pr.id
    WHERE p.assigned_to IS NOT NULL
    GROUP BY pr.id, pr.full_name
    ORDER BY COUNT(*) DESC
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ assistants: result.rows }, null, 2),
      },
    ],
  };
}

async function getCleaningStats() {
  const result = await pool.query(`
    SELECT
      decision_nettoyage,
      COUNT(*) as count
    FROM prospects
    GROUP BY decision_nettoyage
    ORDER BY count DESC
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            decisions: result.rows,
            total: result.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getEcartDetails() {
  // Prospects marked as "inscrit" but not in sessions
  const ecartProspect = await pool.query(`
    SELECT
      p.id,
      p.phone_international,
      p.nom,
      p.prenom,
      s.name as segment_name,
      c.name as ville_name
    FROM prospects p
    LEFT JOIN segments s ON p.segment_id = s.id
    LEFT JOIN cities c ON p.ville_id = c.id
    WHERE p.statut_contact = 'inscrit'
    AND NOT EXISTS (
      SELECT 1 FROM session_students ss
      WHERE ss.phone = p.phone_international
    )
    LIMIT 50
  `);

  // Students in sessions but not in prospects
  const ecartSession = await pool.query(`
    SELECT
      ss.id,
      ss.phone,
      ss.first_name,
      ss.last_name,
      fs.name as session_name
    FROM session_students ss
    LEFT JOIN formation_sessions fs ON ss.session_id = fs.id
    WHERE NOT EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.phone_international = ss.phone
      AND p.statut_contact = 'inscrit'
    )
    LIMIT 50
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            ecart_prospect: {
              description:
                'Prospects marqués "inscrit" mais absents des sessions',
              count: ecartProspect.rows.length,
              items: ecartProspect.rows,
            },
            ecart_session: {
              description:
                'Étudiants dans les sessions mais non marqués "inscrit" dans prospects',
              count: ecartSession.rows.length,
              items: ecartSession.rows,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function listSegments() {
  const result = await pool.query(`
    SELECT id, name, code, description
    FROM segments
    WHERE deleted_at IS NULL
    ORDER BY name
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ segments: result.rows }, null, 2),
      },
    ],
  };
}

async function listVilles() {
  const result = await pool.query(`
    SELECT id, name, code
    FROM cities
    WHERE deleted_at IS NULL
    ORDER BY name
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ villes: result.rows }, null, 2),
      },
    ],
  };
}

async function listAssistants() {
  const result = await pool.query(`
    SELECT id, full_name, email
    FROM profiles
    WHERE role IN ('assistant', 'manager', 'admin')
    ORDER BY full_name
  `);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ assistants: result.rows }, null, 2),
      },
    ],
  };
}

async function analyzeHealth() {
  // Get current month stats
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE statut_contact = 'inscrit') as inscrits
    FROM prospects
    WHERE date_injection >= date_trunc('month', CURRENT_DATE)
  `);

  const s = stats.rows[0];
  const total = parseInt(s.total) || 1;
  const nonContactes = parseInt(s.non_contactes) || 0;
  const avecRdv = parseInt(s.avec_rdv) || 0;
  const inscrits = parseInt(s.inscrits) || 0;

  // Calculate health score (0-100)
  let score = 50; // Base score

  // Non-contacted ratio penalty (high non-contacted = bad)
  const nonContactedRatio = nonContactes / total;
  if (nonContactedRatio > 0.7) score -= 30;
  else if (nonContactedRatio > 0.5) score -= 20;
  else if (nonContactedRatio > 0.3) score -= 10;
  else if (nonContactedRatio < 0.2) score += 10;

  // RDV rate bonus
  const rdvRate = avecRdv / total;
  if (rdvRate > 0.3) score += 20;
  else if (rdvRate > 0.2) score += 15;
  else if (rdvRate > 0.1) score += 10;
  else if (rdvRate < 0.05) score -= 10;

  // Conversion rate bonus
  const conversionRate = inscrits / total;
  if (conversionRate > 0.1) score += 20;
  else if (conversionRate > 0.05) score += 10;
  else if (conversionRate < 0.01) score -= 10;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            score,
            interpretation:
              score >= 80
                ? 'Excellent'
                : score >= 60
                  ? 'Bon'
                  : score >= 40
                    ? 'Moyen'
                    : score >= 20
                      ? 'Faible'
                      : 'Critique',
            metrics: {
              total,
              non_contacted_ratio: (nonContactedRatio * 100).toFixed(1) + '%',
              rdv_rate: (rdvRate * 100).toFixed(1) + '%',
              conversion_rate: (conversionRate * 100).toFixed(1) + '%',
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getRecommendations() {
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE statut_contact = 'contacté avec rdv') as avec_rdv,
      COUNT(*) FILTER (WHERE statut_contact = 'contacté sans rdv') as sans_rdv,
      COUNT(*) FILTER (WHERE statut_contact = 'inscrit') as inscrits
    FROM prospects
    WHERE date_injection >= date_trunc('month', CURRENT_DATE)
  `);

  const s = stats.rows[0];
  const total = parseInt(s.total) || 1;
  const nonContactes = parseInt(s.non_contactes) || 0;
  const avecRdv = parseInt(s.avec_rdv) || 0;
  const sansRdv = parseInt(s.sans_rdv) || 0;

  const recommendations = [];

  // Check non-contacted ratio
  if (nonContactes / total > 0.5) {
    recommendations.push({
      priority: 'HAUTE',
      category: 'Productivité',
      message: `${((nonContactes / total) * 100).toFixed(0)}% des prospects ne sont pas contactés. Augmentez le volume d'appels.`,
    });
  }

  // Check RDV rate
  if (avecRdv / total < 0.1) {
    recommendations.push({
      priority: 'HAUTE',
      category: 'Qualité',
      message: `Taux de RDV faible (${((avecRdv / total) * 100).toFixed(1)}%). Révisez le script d'appel et la qualification des leads.`,
    });
  }

  // Check sans rdv ratio
  if (sansRdv / (avecRdv + sansRdv + 1) > 0.7) {
    recommendations.push({
      priority: 'MOYENNE',
      category: 'Formation',
      message: `Beaucoup de contacts sans RDV. Formez les équipes sur les techniques de closing.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'INFO',
      category: 'Général',
      message: 'Aucun problème majeur détecté. Continuez sur cette lancée!',
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ recommendations }, null, 2),
      },
    ],
  };
}

// ============================================================================
// Request Handlers
// ============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_prospects':
        return await listProspects(args as Parameters<typeof listProspects>[0]);
      case 'search_prospects':
        return await searchProspects((args as { query: string }).query);
      case 'get_prospect':
        return await getProspect((args as { id: string }).id);
      case 'get_prospect_calls':
        return await getProspectCalls((args as { prospect_id: string }).prospect_id);
      case 'get_stats':
        return await getStats(args as Parameters<typeof getStats>[0]);
      case 'get_stats_by_segment':
        return await getStatsBySegment();
      case 'get_stats_by_ville':
        return await getStatsByVille();
      case 'get_stats_by_assistant':
        return await getStatsByAssistant();
      case 'get_cleaning_stats':
        return await getCleaningStats();
      case 'get_ecart_details':
        return await getEcartDetails();
      case 'list_segments':
        return await listSegments();
      case 'list_villes':
        return await listVilles();
      case 'list_assistants':
        return await listAssistants();
      case 'analyze_health':
        return await analyzeHealth();
      case 'get_recommendations':
        return await getRecommendations();
      case 'test_connection':
        const connected = await testConnection();
        return {
          content: [
            {
              type: 'text' as const,
              text: connected
                ? '✅ Connexion à la base de données réussie!'
                : '❌ Impossible de se connecter à la base de données.',
            },
          ],
        };
      default:
        throw new Error(`Outil inconnu: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Erreur: ${message}` }],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'prospects://stats',
        name: 'Statistiques Prospects',
        description: 'Statistiques actuelles des prospects',
        mimeType: 'application/json',
      },
      {
        uri: 'prospects://segments',
        name: 'Liste des Segments',
        description: 'Tous les segments disponibles',
        mimeType: 'application/json',
      },
      {
        uri: 'prospects://villes',
        name: 'Liste des Villes',
        description: 'Toutes les villes disponibles',
        mimeType: 'application/json',
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'prospects://stats': {
      const result = await getStats({});
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: result.content[0].text,
          },
        ],
      };
    }
    case 'prospects://segments': {
      const result = await listSegments();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: result.content[0].text,
          },
        ],
      };
    }
    case 'prospects://villes': {
      const result = await listVilles();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: result.content[0].text,
          },
        ],
      };
    }
    default:
      throw new Error(`Ressource inconnue: ${uri}`);
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  console.error('[MCP] Starting Comptabilité PL MCP Server...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Server connected and ready');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
