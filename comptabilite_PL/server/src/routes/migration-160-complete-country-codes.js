/**
 * Migration 160: Ajouter tous les indicatifs telephoniques du monde
 *
 * Cette migration complete la table country_phone_config avec tous les pays
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Liste complete des pays avec leurs indicatifs et longueurs nationales
const COUNTRIES = [
  { code: '93', country: 'Afghanistan', length: 9, region: 'Asia' },
  { code: '27', country: 'Afrique du Sud', length: 9, region: 'Africa' },
  { code: '355', country: 'Albanie', length: 9, region: 'Europe' },
  { code: '213', country: 'Algerie', length: 9, region: 'Africa' },
  { code: '49', country: 'Allemagne', length: 10, region: 'Europe' },
  { code: '376', country: 'Andorre', length: 6, region: 'Europe' },
  { code: '244', country: 'Angola', length: 9, region: 'Africa' },
  { code: '1268', country: 'Antigua-et-Barbuda', length: 7, region: 'Americas' },
  { code: '966', country: 'Arabie saoudite', length: 9, region: 'Asia' },
  { code: '54', country: 'Argentine', length: 10, region: 'Americas' },
  { code: '374', country: 'Armenie', length: 8, region: 'Asia' },
  { code: '61', country: 'Australie', length: 9, region: 'Oceania' },
  { code: '43', country: 'Autriche', length: 10, region: 'Europe' },
  { code: '994', country: 'Azerbaidjan', length: 9, region: 'Asia' },
  { code: '1242', country: 'Bahamas', length: 7, region: 'Americas' },
  { code: '973', country: 'Bahrein', length: 8, region: 'Asia' },
  { code: '880', country: 'Bangladesh', length: 10, region: 'Asia' },
  { code: '1246', country: 'Barbade', length: 7, region: 'Americas' },
  { code: '32', country: 'Belgique', length: 9, region: 'Europe' },
  { code: '501', country: 'Belize', length: 7, region: 'Americas' },
  { code: '229', country: 'Benin', length: 8, region: 'Africa' },
  { code: '975', country: 'Bhoutan', length: 8, region: 'Asia' },
  { code: '375', country: 'Bielorussie', length: 9, region: 'Europe' },
  { code: '95', country: 'Birmanie (Myanmar)', length: 9, region: 'Asia' },
  { code: '591', country: 'Bolivie', length: 8, region: 'Americas' },
  { code: '387', country: 'Bosnie-Herzegovine', length: 8, region: 'Europe' },
  { code: '267', country: 'Botswana', length: 8, region: 'Africa' },
  { code: '55', country: 'Bresil', length: 11, region: 'Americas' },
  { code: '673', country: 'Brunei', length: 7, region: 'Asia' },
  { code: '359', country: 'Bulgarie', length: 9, region: 'Europe' },
  { code: '226', country: 'Burkina Faso', length: 8, region: 'Africa' },
  { code: '257', country: 'Burundi', length: 8, region: 'Africa' },
  { code: '855', country: 'Cambodge', length: 9, region: 'Asia' },
  { code: '237', country: 'Cameroun', length: 9, region: 'Africa' },
  { code: '1', country: 'Canada / USA', length: 10, region: 'Americas' },
  { code: '238', country: 'Cap-Vert', length: 7, region: 'Africa' },
  { code: '236', country: 'Centrafrique', length: 8, region: 'Africa' },
  { code: '56', country: 'Chili', length: 9, region: 'Americas' },
  { code: '86', country: 'Chine', length: 11, region: 'Asia' },
  { code: '357', country: 'Chypre', length: 8, region: 'Europe' },
  { code: '57', country: 'Colombie', length: 10, region: 'Americas' },
  { code: '269', country: 'Comores', length: 7, region: 'Africa' },
  { code: '242', country: 'Congo (Brazzaville)', length: 9, region: 'Africa' },
  { code: '243', country: 'Congo (RDC)', length: 9, region: 'Africa' },
  { code: '850', country: 'Coree du Nord', length: 9, region: 'Asia' },
  { code: '82', country: 'Coree du Sud', length: 10, region: 'Asia' },
  { code: '506', country: 'Costa Rica', length: 8, region: 'Americas' },
  { code: '225', country: 'Cote d\'Ivoire', length: 10, region: 'Africa' },
  { code: '385', country: 'Croatie', length: 9, region: 'Europe' },
  { code: '53', country: 'Cuba', length: 8, region: 'Americas' },
  { code: '45', country: 'Danemark', length: 8, region: 'Europe' },
  { code: '253', country: 'Djibouti', length: 8, region: 'Africa' },
  { code: '1767', country: 'Dominique', length: 7, region: 'Americas' },
  { code: '20', country: 'Egypte', length: 10, region: 'Africa' },
  { code: '971', country: 'Emirats arabes unis', length: 9, region: 'Asia' },
  { code: '593', country: 'Equateur', length: 9, region: 'Americas' },
  { code: '291', country: 'Erythree', length: 7, region: 'Africa' },
  { code: '34', country: 'Espagne', length: 9, region: 'Europe' },
  { code: '372', country: 'Estonie', length: 8, region: 'Europe' },
  { code: '268', country: 'Eswatini', length: 8, region: 'Africa' },
  { code: '251', country: 'Ethiopie', length: 9, region: 'Africa' },
  { code: '679', country: 'Fidji', length: 7, region: 'Oceania' },
  { code: '358', country: 'Finlande', length: 10, region: 'Europe' },
  { code: '33', country: 'France', length: 9, region: 'Europe' },
  { code: '241', country: 'Gabon', length: 7, region: 'Africa' },
  { code: '220', country: 'Gambie', length: 7, region: 'Africa' },
  { code: '995', country: 'Georgie', length: 9, region: 'Asia' },
  { code: '233', country: 'Ghana', length: 9, region: 'Africa' },
  { code: '30', country: 'Grece', length: 10, region: 'Europe' },
  { code: '1473', country: 'Grenade', length: 7, region: 'Americas' },
  { code: '502', country: 'Guatemala', length: 8, region: 'Americas' },
  { code: '224', country: 'Guinee', length: 9, region: 'Africa' },
  { code: '240', country: 'Guinee equatoriale', length: 9, region: 'Africa' },
  { code: '245', country: 'Guinee-Bissau', length: 7, region: 'Africa' },
  { code: '592', country: 'Guyana', length: 7, region: 'Americas' },
  { code: '509', country: 'Haiti', length: 8, region: 'Americas' },
  { code: '504', country: 'Honduras', length: 8, region: 'Americas' },
  { code: '36', country: 'Hongrie', length: 9, region: 'Europe' },
  { code: '91', country: 'Inde', length: 10, region: 'Asia' },
  { code: '62', country: 'Indonesie', length: 10, region: 'Asia' },
  { code: '964', country: 'Irak', length: 10, region: 'Asia' },
  { code: '98', country: 'Iran', length: 10, region: 'Asia' },
  { code: '353', country: 'Irlande', length: 9, region: 'Europe' },
  { code: '354', country: 'Islande', length: 7, region: 'Europe' },
  { code: '972', country: 'Israel', length: 9, region: 'Asia' },
  { code: '39', country: 'Italie', length: 10, region: 'Europe' },
  { code: '1876', country: 'Jamaique', length: 7, region: 'Americas' },
  { code: '81', country: 'Japon', length: 10, region: 'Asia' },
  { code: '962', country: 'Jordanie', length: 9, region: 'Asia' },
  { code: '7', country: 'Kazakhstan / Russie', length: 10, region: 'Asia' },
  { code: '254', country: 'Kenya', length: 9, region: 'Africa' },
  { code: '996', country: 'Kirghizistan', length: 9, region: 'Asia' },
  { code: '686', country: 'Kiribati', length: 5, region: 'Oceania' },
  { code: '965', country: 'Koweit', length: 8, region: 'Asia' },
  { code: '856', country: 'Laos', length: 9, region: 'Asia' },
  { code: '266', country: 'Lesotho', length: 8, region: 'Africa' },
  { code: '371', country: 'Lettonie', length: 8, region: 'Europe' },
  { code: '961', country: 'Liban', length: 8, region: 'Asia' },
  { code: '231', country: 'Liberia', length: 8, region: 'Africa' },
  { code: '218', country: 'Libye', length: 9, region: 'Africa' },
  { code: '423', country: 'Liechtenstein', length: 7, region: 'Europe' },
  { code: '370', country: 'Lituanie', length: 8, region: 'Europe' },
  { code: '352', country: 'Luxembourg', length: 9, region: 'Europe' },
  { code: '389', country: 'Macedoine du Nord', length: 8, region: 'Europe' },
  { code: '261', country: 'Madagascar', length: 9, region: 'Africa' },
  { code: '60', country: 'Malaisie', length: 9, region: 'Asia' },
  { code: '265', country: 'Malawi', length: 9, region: 'Africa' },
  { code: '960', country: 'Maldives', length: 7, region: 'Asia' },
  { code: '223', country: 'Mali', length: 8, region: 'Africa' },
  { code: '356', country: 'Malte', length: 8, region: 'Europe' },
  { code: '212', country: 'Maroc', length: 9, region: 'Africa' },
  { code: '230', country: 'Maurice', length: 8, region: 'Africa' },
  { code: '222', country: 'Mauritanie', length: 8, region: 'Africa' },
  { code: '52', country: 'Mexique', length: 10, region: 'Americas' },
  { code: '691', country: 'Micronesie', length: 7, region: 'Oceania' },
  { code: '373', country: 'Moldavie', length: 8, region: 'Europe' },
  { code: '377', country: 'Monaco', length: 8, region: 'Europe' },
  { code: '976', country: 'Mongolie', length: 8, region: 'Asia' },
  { code: '382', country: 'Montenegro', length: 8, region: 'Europe' },
  { code: '258', country: 'Mozambique', length: 9, region: 'Africa' },
  { code: '264', country: 'Namibie', length: 9, region: 'Africa' },
  { code: '674', country: 'Nauru', length: 7, region: 'Oceania' },
  { code: '977', country: 'Nepal', length: 10, region: 'Asia' },
  { code: '505', country: 'Nicaragua', length: 8, region: 'Americas' },
  { code: '227', country: 'Niger', length: 8, region: 'Africa' },
  { code: '234', country: 'Nigeria', length: 10, region: 'Africa' },
  { code: '47', country: 'Norvege', length: 8, region: 'Europe' },
  { code: '64', country: 'Nouvelle-Zelande', length: 9, region: 'Oceania' },
  { code: '968', country: 'Oman', length: 8, region: 'Asia' },
  { code: '256', country: 'Ouganda', length: 9, region: 'Africa' },
  { code: '998', country: 'Ouzbekistan', length: 9, region: 'Asia' },
  { code: '92', country: 'Pakistan', length: 10, region: 'Asia' },
  { code: '680', country: 'Palaos', length: 7, region: 'Oceania' },
  { code: '970', country: 'Palestine', length: 9, region: 'Asia' },
  { code: '507', country: 'Panama', length: 8, region: 'Americas' },
  { code: '675', country: 'Papouasie-Nouvelle-Guinee', length: 8, region: 'Oceania' },
  { code: '595', country: 'Paraguay', length: 9, region: 'Americas' },
  { code: '31', country: 'Pays-Bas', length: 9, region: 'Europe' },
  { code: '51', country: 'Perou', length: 9, region: 'Americas' },
  { code: '63', country: 'Philippines', length: 10, region: 'Asia' },
  { code: '48', country: 'Pologne', length: 9, region: 'Europe' },
  { code: '351', country: 'Portugal', length: 9, region: 'Europe' },
  { code: '974', country: 'Qatar', length: 8, region: 'Asia' },
  { code: '1809', country: 'Republique dominicaine', length: 7, region: 'Americas' },
  { code: '420', country: 'Republique tcheque', length: 9, region: 'Europe' },
  { code: '40', country: 'Roumanie', length: 9, region: 'Europe' },
  { code: '44', country: 'Royaume-Uni', length: 10, region: 'Europe' },
  { code: '250', country: 'Rwanda', length: 9, region: 'Africa' },
  { code: '1869', country: 'Saint-Kitts-et-Nevis', length: 7, region: 'Americas' },
  { code: '1784', country: 'Saint-Vincent-et-les-Grenadines', length: 7, region: 'Americas' },
  { code: '1758', country: 'Sainte-Lucie', length: 7, region: 'Americas' },
  { code: '677', country: 'Salomon', length: 7, region: 'Oceania' },
  { code: '503', country: 'Salvador', length: 8, region: 'Americas' },
  { code: '685', country: 'Samoa', length: 7, region: 'Oceania' },
  { code: '239', country: 'Sao Tome-et-Principe', length: 7, region: 'Africa' },
  { code: '221', country: 'Senegal', length: 9, region: 'Africa' },
  { code: '381', country: 'Serbie', length: 9, region: 'Europe' },
  { code: '248', country: 'Seychelles', length: 7, region: 'Africa' },
  { code: '232', country: 'Sierra Leone', length: 8, region: 'Africa' },
  { code: '65', country: 'Singapour', length: 8, region: 'Asia' },
  { code: '421', country: 'Slovaquie', length: 9, region: 'Europe' },
  { code: '386', country: 'Slovenie', length: 8, region: 'Europe' },
  { code: '252', country: 'Somalie', length: 8, region: 'Africa' },
  { code: '249', country: 'Soudan', length: 9, region: 'Africa' },
  { code: '211', country: 'Soudan du Sud', length: 9, region: 'Africa' },
  { code: '94', country: 'Sri Lanka', length: 9, region: 'Asia' },
  { code: '46', country: 'Suede', length: 9, region: 'Europe' },
  { code: '41', country: 'Suisse', length: 9, region: 'Europe' },
  { code: '597', country: 'Suriname', length: 7, region: 'Americas' },
  { code: '963', country: 'Syrie', length: 9, region: 'Asia' },
  { code: '992', country: 'Tadjikistan', length: 9, region: 'Asia' },
  { code: '255', country: 'Tanzanie', length: 9, region: 'Africa' },
  { code: '235', country: 'Tchad', length: 8, region: 'Africa' },
  { code: '66', country: 'Thailande', length: 9, region: 'Asia' },
  { code: '670', country: 'Timor oriental', length: 8, region: 'Asia' },
  { code: '228', country: 'Togo', length: 8, region: 'Africa' },
  { code: '676', country: 'Tonga', length: 7, region: 'Oceania' },
  { code: '1868', country: 'Trinite-et-Tobago', length: 7, region: 'Americas' },
  { code: '216', country: 'Tunisie', length: 8, region: 'Africa' },
  { code: '993', country: 'Turkmenistan', length: 8, region: 'Asia' },
  { code: '90', country: 'Turquie', length: 10, region: 'Asia' },
  { code: '688', country: 'Tuvalu', length: 5, region: 'Oceania' },
  { code: '380', country: 'Ukraine', length: 9, region: 'Europe' },
  { code: '598', country: 'Uruguay', length: 8, region: 'Americas' },
  { code: '678', country: 'Vanuatu', length: 7, region: 'Oceania' },
  { code: '379', country: 'Vatican', length: 10, region: 'Europe' },
  { code: '58', country: 'Venezuela', length: 10, region: 'Americas' },
  { code: '84', country: 'Vietnam', length: 9, region: 'Asia' },
  { code: '967', country: 'Yemen', length: 9, region: 'Asia' },
  { code: '260', country: 'Zambie', length: 9, region: 'Africa' },
  { code: '263', country: 'Zimbabwe', length: 9, region: 'Africa' },
];

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('Migration 160: Ajout de tous les indicatifs telephoniques du monde');

    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    let errors = [];

    for (const country of COUNTRIES) {
      try {
        // Utiliser INSERT ... ON CONFLICT pour update si existe
        const result = await client.query(`
          INSERT INTO country_phone_config (country_code, country, expected_national_length, region)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (country_code) DO UPDATE SET
            country = EXCLUDED.country,
            expected_national_length = EXCLUDED.expected_national_length,
            region = EXCLUDED.region
          RETURNING (xmax = 0) AS inserted
        `, [country.code, country.country, country.length, country.region]);

        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        errors.push({ country: country.country, code: country.code, error: err.message });
      }
    }

    await client.query('COMMIT');

    // Compter le total
    const countResult = await client.query('SELECT COUNT(*) as total FROM country_phone_config');

    console.log(`Migration 160 terminee: ${inserted} inseres, ${updated} mis a jour`);

    res.json({
      success: true,
      message: 'Migration 160 executee avec succes',
      stats: {
        inserted,
        updated,
        errors: errors.length,
        total: parseInt(countResult.rows[0].total)
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur migration 160:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Route pour voir les pays actuellement supportes
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT region, COUNT(*) as count
      FROM country_phone_config
      GROUP BY region
      ORDER BY region
    `);

    const total = await pool.query('SELECT COUNT(*) as total FROM country_phone_config');

    res.json({
      total: parseInt(total.rows[0].total),
      by_region: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
