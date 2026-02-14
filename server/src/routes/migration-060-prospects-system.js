/**
 * Migration 060 - Système de Gestion des Prospects
 *
 * Fonctionnalités :
 * - Normalisation internationale des téléphones (150+ pays)
 * - Affectation automatique intelligente
 * - Qualification avec timer
 * - Moteur de décision (nettoyage)
 * - Réinjection des prospects
 * - RBAC + SBAC
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Prospects System Migration 060...');
    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Table de configuration des pays
    // ============================================================
    console.log('  📦 Creating country_phone_config table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS country_phone_config (
        country_code TEXT PRIMARY KEY,
        country TEXT NOT NULL,
        expected_national_length INTEGER NOT NULL,
        region TEXT NOT NULL
      )
    `);

    // ============================================================
    // STEP 2: Insertion des pays (150+ pays)
    // ============================================================
    console.log('  📦 Seeding country phone configurations...');

    const countries = [
      // AFRIQUE
      ['20', 'Egypt', 10, 'Africa'],
      ['212', 'Morocco', 9, 'Africa'],
      ['213', 'Algeria', 9, 'Africa'],
      ['216', 'Tunisia', 8, 'Africa'],
      ['218', 'Libya', 9, 'Africa'],
      ['221', 'Senegal', 9, 'Africa'],
      ['222', 'Mauritania', 8, 'Africa'],
      ['223', 'Mali', 8, 'Africa'],
      ['224', 'Guinea', 9, 'Africa'],
      ['225', 'Ivory Coast', 8, 'Africa'],
      ['226', 'Burkina Faso', 8, 'Africa'],
      ['227', 'Niger', 8, 'Africa'],
      ['228', 'Togo', 8, 'Africa'],
      ['229', 'Benin', 8, 'Africa'],
      ['230', 'Mauritius', 7, 'Africa'],
      ['231', 'Liberia', 8, 'Africa'],
      ['232', 'Sierra Leone', 8, 'Africa'],
      ['233', 'Ghana', 9, 'Africa'],
      ['234', 'Nigeria', 10, 'Africa'],
      ['235', 'Chad', 8, 'Africa'],
      ['236', 'Central African Republic', 8, 'Africa'],
      ['237', 'Cameroon', 9, 'Africa'],
      ['238', 'Cape Verde', 7, 'Africa'],
      ['239', 'Sao Tome & Principe', 7, 'Africa'],
      ['240', 'Equatorial Guinea', 9, 'Africa'],
      ['241', 'Gabon', 8, 'Africa'],
      ['242', 'Republic of Congo', 9, 'Africa'],
      ['243', 'DR Congo', 9, 'Africa'],
      ['244', 'Angola', 9, 'Africa'],
      ['245', 'Guinea-Bissau', 7, 'Africa'],
      ['246', 'BIOT (Diego Garcia)', 7, 'Africa'],
      ['248', 'Seychelles', 7, 'Africa'],
      ['249', 'Sudan', 9, 'Africa'],
      ['250', 'Rwanda', 9, 'Africa'],
      ['251', 'Ethiopia', 9, 'Africa'],
      ['252', 'Somalia', 9, 'Africa'],
      ['253', 'Djibouti', 8, 'Africa'],
      ['254', 'Kenya', 9, 'Africa'],
      ['255', 'Tanzania', 9, 'Africa'],
      ['256', 'Uganda', 9, 'Africa'],
      ['257', 'Burundi', 8, 'Africa'],
      ['258', 'Mozambique', 9, 'Africa'],
      ['260', 'Zambia', 9, 'Africa'],
      ['261', 'Madagascar', 9, 'Africa'],
      ['262', 'Réunion / Mayotte', 9, 'Africa'],
      ['263', 'Zimbabwe', 9, 'Africa'],
      ['264', 'Namibia', 8, 'Africa'],
      ['265', 'Malawi', 9, 'Africa'],
      ['266', 'Lesotho', 8, 'Africa'],
      ['267', 'Botswana', 8, 'Africa'],
      ['268', 'Eswatini', 7, 'Africa'],
      ['269', 'Comoros', 7, 'Africa'],

      // EUROPE
      ['30', 'Greece', 10, 'Europe'],
      ['31', 'Netherlands', 9, 'Europe'],
      ['32', 'Belgium', 9, 'Europe'],
      ['33', 'France', 9, 'Europe'],
      ['34', 'Spain', 9, 'Europe'],
      ['36', 'Hungary', 9, 'Europe'],
      ['39', 'Italy', 10, 'Europe'],
      ['40', 'Romania', 9, 'Europe'],
      ['41', 'Switzerland', 9, 'Europe'],
      ['43', 'Austria', 10, 'Europe'],
      ['44', 'United Kingdom', 10, 'Europe'],
      ['45', 'Denmark', 8, 'Europe'],
      ['46', 'Sweden', 9, 'Europe'],
      ['47', 'Norway', 8, 'Europe'],
      ['48', 'Poland', 9, 'Europe'],
      ['49', 'Germany', 10, 'Europe'],
      ['351', 'Portugal', 9, 'Europe'],
      ['352', 'Luxembourg', 9, 'Europe'],
      ['353', 'Ireland', 9, 'Europe'],
      ['354', 'Iceland', 7, 'Europe'],
      ['355', 'Albania', 9, 'Europe'],
      ['356', 'Malta', 8, 'Europe'],
      ['357', 'Cyprus', 8, 'Europe'],
      ['358', 'Finland', 9, 'Europe'],
      ['359', 'Bulgaria', 9, 'Europe'],
      ['370', 'Lithuania', 8, 'Europe'],
      ['371', 'Latvia', 8, 'Europe'],
      ['372', 'Estonia', 7, 'Europe'],
      ['373', 'Moldova', 8, 'Europe'],
      ['374', 'Armenia', 8, 'Europe'],
      ['375', 'Belarus', 9, 'Europe'],
      ['376', 'Andorra', 6, 'Europe'],
      ['377', 'Monaco', 8, 'Europe'],
      ['378', 'San Marino', 10, 'Europe'],
      ['380', 'Ukraine', 9, 'Europe'],
      ['381', 'Serbia', 9, 'Europe'],
      ['382', 'Montenegro', 8, 'Europe'],
      ['383', 'Kosovo', 8, 'Europe'],
      ['385', 'Croatia', 9, 'Europe'],
      ['386', 'Slovenia', 8, 'Europe'],
      ['387', 'Bosnia', 8, 'Europe'],
      ['389', 'North Macedonia', 8, 'Europe'],

      // ASIE / MOYEN-ORIENT
      ['60', 'Malaysia', 9, 'Asia'],
      ['61', 'Australia', 9, 'Oceania'],
      ['62', 'Indonesia', 10, 'Asia'],
      ['63', 'Philippines', 10, 'Asia'],
      ['64', 'New Zealand', 8, 'Oceania'],
      ['65', 'Singapore', 8, 'Asia'],
      ['66', 'Thailand', 9, 'Asia'],
      ['81', 'Japan', 10, 'Asia'],
      ['82', 'South Korea', 9, 'Asia'],
      ['84', 'Vietnam', 9, 'Asia'],
      ['86', 'China', 11, 'Asia'],
      ['90', 'Turkey', 10, 'Asia'],
      ['91', 'India', 10, 'Asia'],
      ['92', 'Pakistan', 10, 'Asia'],
      ['93', 'Afghanistan', 9, 'Asia'],
      ['94', 'Sri Lanka', 9, 'Asia'],
      ['95', 'Myanmar', 9, 'Asia'],
      ['98', 'Iran', 10, 'Asia'],
      ['961', 'Lebanon', 8, 'Asia'],
      ['962', 'Jordan', 8, 'Asia'],
      ['963', 'Syria', 9, 'Asia'],
      ['964', 'Iraq', 10, 'Asia'],
      ['965', 'Kuwait', 8, 'Asia'],
      ['966', 'Saudi Arabia', 9, 'Asia'],
      ['967', 'Yemen', 9, 'Asia'],
      ['968', 'Oman', 8, 'Asia'],
      ['970', 'Palestine', 9, 'Asia'],
      ['971', 'UAE', 9, 'Asia'],
      ['972', 'Israel', 9, 'Asia'],
      ['973', 'Bahrain', 8, 'Asia'],
      ['974', 'Qatar', 8, 'Asia'],
      ['975', 'Bhutan', 8, 'Asia'],
      ['976', 'Mongolia', 8, 'Asia'],
      ['977', 'Nepal', 10, 'Asia'],
      ['994', 'Azerbaijan', 9, 'Asia'],
      ['995', 'Georgia', 9, 'Asia'],
      ['996', 'Kyrgyzstan', 9, 'Asia'],
      ['998', 'Uzbekistan', 9, 'Asia'],

      // AMÉRIQUES
      ['1', 'USA / Canada', 10, 'Americas'],
      ['52', 'Mexico', 10, 'Americas'],
      ['53', 'Cuba', 8, 'Americas'],
      ['54', 'Argentina', 10, 'Americas'],
      ['55', 'Brazil', 10, 'Americas'],
      ['56', 'Chile', 9, 'Americas'],
      ['57', 'Colombia', 10, 'Americas'],
      ['58', 'Venezuela', 10, 'Americas'],
      ['501', 'Belize', 7, 'Americas'],
      ['502', 'Guatemala', 8, 'Americas'],
      ['503', 'El Salvador', 8, 'Americas'],
      ['504', 'Honduras', 8, 'Americas'],
      ['505', 'Nicaragua', 8, 'Americas'],
      ['506', 'Costa Rica', 8, 'Americas'],
      ['507', 'Panama', 8, 'Americas'],
      ['508', 'Saint-Pierre & Miquelon', 6, 'Americas'],
      ['509', 'Haiti', 8, 'Americas'],
      ['590', 'Guadeloupe / St-Martin', 9, 'Americas'],
      ['591', 'Bolivia', 8, 'Americas'],
      ['592', 'Guyana', 7, 'Americas'],
      ['593', 'Ecuador', 9, 'Americas'],
      ['594', 'French Guiana', 9, 'Americas'],
      ['595', 'Paraguay', 9, 'Americas'],
      ['596', 'Martinique', 9, 'Americas'],
      ['597', 'Suriname', 7, 'Americas'],
      ['598', 'Uruguay', 8, 'Americas'],
      ['599', 'Caribbean Netherlands', 7, 'Americas'],

      // OCÉANIE (complément)
      ['670', 'East Timor', 7, 'Oceania'],
      ['672', 'Norfolk Island', 6, 'Oceania'],
      ['673', 'Brunei', 7, 'Oceania'],
      ['674', 'Nauru', 7, 'Oceania'],
      ['675', 'Papua New Guinea', 8, 'Oceania'],
      ['676', 'Tonga', 5, 'Oceania'],
      ['677', 'Solomon Islands', 7, 'Oceania'],
      ['678', 'Vanuatu', 7, 'Oceania'],
      ['679', 'Fiji', 7, 'Oceania'],
      ['680', 'Palau', 7, 'Oceania'],
      ['681', 'Wallis & Futuna', 6, 'Oceania'],
      ['682', 'Cook Islands', 5, 'Oceania'],
      ['683', 'Niue', 4, 'Oceania'],
      ['685', 'Samoa', 7, 'Oceania'],
      ['686', 'Kiribati', 5, 'Oceania'],
      ['687', 'New Caledonia', 6, 'Oceania'],
      ['688', 'Tuvalu', 5, 'Oceania'],
      ['689', 'French Polynesia', 6, 'Oceania'],
      ['690', 'Tokelau', 4, 'Oceania'],
      ['691', 'Micronesia', 7, 'Oceania'],
      ['692', 'Marshall Islands', 7, 'Oceania'],
    ];

    for (const [code, country, length, region] of countries) {
      await client.query(`
        INSERT INTO country_phone_config (country_code, country, expected_national_length, region)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (country_code) DO NOTHING
      `, [code, country, length, region]);
    }

    console.log(`  ✅ Inserted ${countries.length} country configurations`);

    // ============================================================
    // STEP 3: Table prospects
    // ============================================================
    console.log('  📦 Creating prospects table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,

        -- Numéros de téléphone
        phone_raw TEXT,
        phone_international TEXT NOT NULL UNIQUE,
        country_code TEXT REFERENCES country_phone_config(country_code),
        country TEXT,
        statut_validation_numero TEXT DEFAULT 'valide',

        -- Informations du prospect
        nom TEXT,
        prenom TEXT,
        cin TEXT,

        -- Localisation et affectation
        segment_id TEXT REFERENCES segments(id) NOT NULL,
        ville_id TEXT REFERENCES cities(id) NOT NULL,
        assigned_to TEXT REFERENCES profiles(id),

        -- Statut et suivi
        statut_contact TEXT DEFAULT 'non contacté',

        -- RDV
        date_rdv DATE,
        rdv_centre_ville_id TEXT REFERENCES cities(id),

        -- Injection et nettoyage
        date_injection TIMESTAMP NOT NULL DEFAULT NOW(),
        decision_nettoyage TEXT,

        -- Métadonnées
        commentaire TEXT,
        is_auto_assigned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT REFERENCES profiles(id)
      )
    `);

    // Créer les index
    console.log('  📦 Creating indexes on prospects table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prospects_phone_intl ON prospects(phone_international);
      CREATE INDEX IF NOT EXISTS idx_prospects_country ON prospects(country_code);
      CREATE INDEX IF NOT EXISTS idx_prospects_segment ON prospects(segment_id);
      CREATE INDEX IF NOT EXISTS idx_prospects_ville ON prospects(ville_id);
      CREATE INDEX IF NOT EXISTS idx_prospects_assigned ON prospects(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_prospects_statut ON prospects(statut_contact);
      CREATE INDEX IF NOT EXISTS idx_prospects_decision ON prospects(decision_nettoyage);
      CREATE INDEX IF NOT EXISTS idx_prospects_date_injection ON prospects(date_injection DESC);
    `);

    // ============================================================
    // STEP 4: Table prospect_call_history
    // ============================================================
    console.log('  📦 Creating prospect_call_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospect_call_history (
        id TEXT PRIMARY KEY,
        prospect_id TEXT REFERENCES prospects(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES profiles(id),
        call_start TIMESTAMP NOT NULL,
        call_end TIMESTAMP,
        duration_seconds INTEGER,
        status_before TEXT,
        status_after TEXT,
        commentaire TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_history_prospect ON prospect_call_history(prospect_id);
      CREATE INDEX IF NOT EXISTS idx_call_history_user ON prospect_call_history(user_id);
    `);

    // ============================================================
    // STEP 5: Table prospect_notifications
    // ============================================================
    console.log('  📦 Creating prospect_notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospect_notifications (
        id TEXT PRIMARY KEY,
        prospect_id TEXT REFERENCES prospects(id) ON DELETE CASCADE,
        assigned_to TEXT REFERENCES profiles(id),
        type TEXT NOT NULL,
        scheduled_for DATE NOT NULL,
        sent_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notif_user ON prospect_notifications(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_notif_scheduled ON prospect_notifications(scheduled_for);
    `);

    // ============================================================
    // STEP 6: Ville spéciale "Sans Ville"
    // ============================================================
    console.log('  📦 Creating "Sans Ville" special city...');
    // Récupérer le premier segment_id pour éviter contrainte NOT NULL
    const firstSegment = await client.query(`SELECT id FROM segments LIMIT 1`);
    if (firstSegment.rows.length > 0) {
      await client.query(`
        INSERT INTO cities (id, name, code, segment_id)
        VALUES ('city-sans-ville', 'Sans Ville', 'SV', $1)
        ON CONFLICT (id) DO NOTHING
      `, [firstSegment.rows[0].id]);
    } else {
      console.log('  ⚠️ No segment found, skipping "Sans Ville" creation');
    }

    // ============================================================
    // STEP 7: Fonction normalize_phone_international
    // ============================================================
    console.log('  📦 Creating normalize_phone_international function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION normalize_phone_international(raw_phone TEXT)
      RETURNS TABLE (
        phone_international TEXT,
        country_code TEXT,
        country TEXT,
        is_valid BOOLEAN,
        error_message TEXT
      ) AS $$
      DECLARE
        cleaned TEXT;
        national_number TEXT;
        detected_code TEXT;
        expected_len INTEGER;
        country_name TEXT;
      BEGIN
        -- Étape 1: Nettoyage (espaces, tirets, parenthèses, points)
        cleaned := REGEXP_REPLACE(raw_phone, '[\\s\\-\\(\\)\\.]', '', 'g');

        -- Étape 2: Détection du pays

        -- Cas A: Commence par "+"
        IF cleaned LIKE '+%' THEN
          cleaned := SUBSTRING(cleaned FROM 2);  -- Enlever le +

          -- Essayer de matcher les codes de 1 à 3 chiffres (du plus long au plus court)
          FOR i IN REVERSE 3..1 LOOP
            detected_code := SUBSTRING(cleaned FROM 1 FOR i);

            SELECT cpc.expected_national_length, cpc.country
            INTO expected_len, country_name
            FROM country_phone_config cpc
            WHERE cpc.country_code = detected_code;

            IF FOUND THEN
              national_number := SUBSTRING(cleaned FROM i + 1);
              EXIT;
            END IF;
          END LOOP;

          IF detected_code IS NULL THEN
            RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, false,
              'Indicatif pays non reconnu';
            RETURN;
          END IF;

        -- Cas B: Ne commence pas par "+"
        ELSE
          -- Essayer de détecter un code pays au début (1-3 chiffres)
          FOR i IN REVERSE 3..1 LOOP
            detected_code := SUBSTRING(cleaned FROM 1 FOR i);

            SELECT cpc.expected_national_length, cpc.country
            INTO expected_len, country_name
            FROM country_phone_config cpc
            WHERE cpc.country_code = detected_code;

            IF FOUND THEN
              national_number := SUBSTRING(cleaned FROM i + 1);
              EXIT;
            END IF;
          END LOOP;

          -- Si aucun code détecté et commence par "0" → Numéro marocain national
          IF detected_code IS NULL AND cleaned LIKE '0%' THEN
            detected_code := '212';
            country_name := 'Morocco';
            expected_len := 9;
            national_number := SUBSTRING(cleaned FROM 2);  -- Enlever le 0
          ELSIF detected_code IS NULL THEN
            RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, false,
              'Format de numéro non reconnu';
            RETURN;
          END IF;
        END IF;

        -- Étape 3: Validation de la longueur nationale
        IF LENGTH(national_number) != expected_len THEN
          RETURN QUERY SELECT NULL::TEXT, detected_code, country_name, false,
            FORMAT('Longueur invalide pour %s: attendu %s chiffres, reçu %s',
              country_name, expected_len, LENGTH(national_number));
          RETURN;
        END IF;

        -- Étape 4: Vérifier que national_number ne contient que des chiffres
        IF national_number !~ '^[0-9]+$' THEN
          RETURN QUERY SELECT NULL::TEXT, detected_code, country_name, false,
            'Le numéro contient des caractères non numériques';
          RETURN;
        END IF;

        -- Étape 5: Construction du numéro international
        RETURN QUERY SELECT
          '+' || detected_code || national_number,
          detected_code,
          country_name,
          true,
          NULL::TEXT;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // ============================================================
    // STEP 8: Fonction apply_cleaning_decision
    // ============================================================
    console.log('  📦 Creating apply_cleaning_decision function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION apply_cleaning_decision(
        p_date_rdv DATE,
        p_statut_contact TEXT,
        p_date_injection TIMESTAMP
      )
      RETURNS TEXT AS $$
      DECLARE
        today DATE := CURRENT_DATE;
        is_negative BOOLEAN;
        statut_lower TEXT;
      BEGIN
        -- Normaliser le statut (minuscules, sans accents)
        statut_lower := LOWER(COALESCE(p_statut_contact, ''));

        -- Déterminer si c'est un statut négatif
        is_negative := statut_lower IN (
          'contacté sans rdv',
          'contacté sans réponse',
          'contacte sans reponse',
          'boîte vocale',
          'boite vocale',
          'à recontacter',
          'a recontacter'
        );

        -- CAS AVEC date_rdv
        IF p_date_rdv IS NOT NULL THEN
          -- Règle 1: RDV futur ou aujourd'hui → laisser
          IF p_date_rdv >= today THEN
            RETURN 'laisser';
          END IF;

          -- Règle 2: RDV dépassé de plus de 7 jours → supprimer
          IF p_date_rdv < today - INTERVAL '7 days' THEN
            RETURN 'supprimer';
          END IF;

          -- Règle 3: RDV entre -7j et aujourd'hui, statut négatif → supprimer
          IF p_date_rdv >= today - INTERVAL '7 days' AND p_date_rdv < today THEN
            IF is_negative THEN
              RETURN 'supprimer';
            END IF;

            -- Règle 4 & 5: statut pas négatif, vérifier date_injection
            IF p_date_injection IS NOT NULL THEN
              IF p_date_injection < NOW() - INTERVAL '3 days' THEN
                RETURN 'supprimer';  -- Ancien
              ELSE
                RETURN 'laisser';    -- Récent
              END IF;
            ELSE
              RETURN 'a_revoir_manuelle';
            END IF;
          END IF;

        -- CAS SANS date_rdv
        ELSE
          -- Règle 6: Statut négatif → supprimer
          IF is_negative THEN
            RETURN 'supprimer';
          END IF;

          -- Règle 7 & 8: Pas de statut négatif, vérifier date_injection
          IF p_date_injection IS NOT NULL THEN
            IF p_date_injection < NOW() - INTERVAL '3 days' THEN
              RETURN 'supprimer';  -- Ancien sans activité
            ELSE
              RETURN 'laisser';    -- Récent
            END IF;
          ELSE
            -- Règle 9: Pas de date_injection exploitable
            RETURN 'a_revoir_manuelle';
          END IF;
        END IF;

        -- Zone grise par défaut
        RETURN 'a_revoir_manuelle';
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // ============================================================
    // STEP 9: Trigger update_prospect_decision
    // ============================================================
    console.log('  📦 Creating trigger for automatic decision calculation...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_prospect_decision()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.decision_nettoyage := apply_cleaning_decision(
          NEW.date_rdv,
          NEW.statut_contact,
          NEW.date_injection
        );
        NEW.updated_at := NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_decision ON prospects;

      CREATE TRIGGER trigger_update_decision
        BEFORE INSERT OR UPDATE OF date_rdv, statut_contact, date_injection
        ON prospects
        FOR EACH ROW
        EXECUTE FUNCTION update_prospect_decision();
    `);

    // ============================================================
    // STEP 10: Permissions RBAC
    // ============================================================
    console.log('  📦 Creating prospects permissions...');

    const permissions = [
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'view_page',
        code: 'commercialisation.prospects.view_page',
        label: 'Voir la page prospects',
        description: 'Accès à la page de gestion des prospects'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'create',
        code: 'commercialisation.prospects.create',
        label: 'Créer un prospect',
        description: 'Ajouter un nouveau prospect'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'call',
        code: 'commercialisation.prospects.call',
        label: 'Appeler un prospect',
        description: 'Appeler et qualifier un prospect'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'update',
        code: 'commercialisation.prospects.update',
        label: 'Mettre à jour un prospect',
        description: 'Modifier les informations d\'un prospect'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'delete',
        code: 'commercialisation.prospects.delete',
        label: 'Supprimer un prospect',
        description: 'Supprimer un prospect définitivement'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'export',
        code: 'commercialisation.prospects.export',
        label: 'Exporter les prospects',
        description: 'Exporter la liste des prospects en CSV'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'import',
        code: 'commercialisation.prospects.import',
        label: 'Importer des prospects',
        description: 'Importer des prospects en masse'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'assign',
        code: 'commercialisation.prospects.assign',
        label: 'Affecter manuellement un prospect',
        description: 'Réaffecter un prospect à une autre assistante'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'reinject',
        code: 'commercialisation.prospects.reinject',
        label: 'Réinjecter un prospect',
        description: 'Réinjecter un prospect ancien pour le retravailler'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'clean',
        code: 'commercialisation.prospects.clean',
        label: 'Nettoyer les prospects (batch)',
        description: 'Lancer le nettoyage batch des prospects obsolètes'
      },
      {
        module: 'commercialisation',
        menu: 'prospects',
        action: 'view_all',
        code: 'commercialisation.prospects.view_all',
        label: 'Voir tous les prospects (tous segments/villes)',
        description: 'Voir tous les prospects sans restriction SBAC'
      }
    ];

    for (const perm of permissions) {
      const existing = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())`,
          [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description]
        );
      }
    }

    console.log(`  ✅ Created ${permissions.length} permissions`);

    // ============================================================
    // STEP 11: Assigner toutes les permissions à l'admin
    // ============================================================
    console.log('  📦 Assigning all prospects permissions to admin role...');

    const adminRole = await client.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );

    if (adminRole.rows.length > 0) {
      const adminRoleId = adminRole.rows[0].id;

      for (const perm of permissions) {
        const permResult = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [perm.code]
        );

        if (permResult.rows.length > 0) {
          const permId = permResult.rows[0].id;

          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [adminRoleId, permId]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration 060 completed successfully!');

    res.json({
      success: true,
      message: 'Prospects system migration completed',
      details: {
        countries: countries.length,
        permissions: permissions.length,
        tables: ['country_phone_config', 'prospects', 'prospect_call_history', 'prospect_notifications'],
        functions: ['normalize_phone_international', 'apply_cleaning_decision'],
        triggers: ['trigger_update_decision']
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 060 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// GET /status - Check if migration has been applied
router.get('/status', async (req, res) => {
  try {
    // Check if the main tables exist
    const tableCheck = await pool.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prospects') as prospects_exists,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'country_phone_config') as config_exists
    `);

    const tablesExist = tableCheck.rows[0].prospects_exists && tableCheck.rows[0].config_exists;

    if (!tablesExist) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'Migration needed - Prospects tables do not exist'
      });
    }

    // Check if country data is seeded
    const countryCount = await pool.query('SELECT COUNT(*) as count FROM country_phone_config');
    const hasCountries = parseInt(countryCount.rows[0].count) > 0;

    if (!hasCountries) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'Migration needed - Country phone configurations not seeded'
      });
    }

    // Migration is applied
    res.json({
      status: {
        migrationNeeded: false,
        applied: true,
        countries: parseInt(countryCount.rows[0].count)
      },
      message: `Migration 060 already applied (${countryCount.rows[0].count} countries configured)`
    });

  } catch (error) {
    console.error('Error checking migration 060 status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
