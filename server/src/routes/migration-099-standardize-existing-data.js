/**
 * Migration 099: Standardize Existing Student Data
 * Applies text standardization rules to all existing student records
 *
 * Rules applied:
 * - nom, prenom, lieu_naissance: Title Case (Jean Dupont)
 * - cin: Uppercase, no spaces (T209876)
 * - email: Lowercase (john@example.com)
 * - phone, whatsapp: Digits only (0612345678)
 * - adresse: Title Case
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Title Case transformation
 * "JEAN DUPONT" -> "Jean Dupont"
 * "jean dupont" -> "Jean Dupont"
 */
function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;

  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      if (word.includes('-')) {
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('-');
      }
      if (word.includes("'")) {
        return word.split("'")
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Format CIN - Uppercase, no spaces
 * "t 209876" -> "T209876"
 */
function formatCIN(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Format email - Lowercase
 * "JOHN@GMAIL.COM" -> "john@gmail.com"
 */
function formatEmail(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().trim();
}

/**
 * Format phone - Digits and + only
 * "06 12 34 56 78" -> "0612345678"
 */
function formatPhone(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/[^\d+]/g, '').trim();
}

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 099: Standardize Existing Student Data ===\n');

    // Get all students
    const studentsResult = await client.query(`
      SELECT id, nom, prenom, cin, email, phone, whatsapp, lieu_naissance, adresse
      FROM students
    `);

    console.log(`Found ${studentsResult.rows.length} students to process\n`);

    let updatedCount = 0;
    const changes = [];

    for (const student of studentsResult.rows) {
      const updates = {};
      const originalValues = {};

      // Check and standardize each field
      if (student.nom) {
        const standardized = toTitleCase(student.nom);
        if (standardized !== student.nom) {
          updates.nom = standardized;
          originalValues.nom = student.nom;
        }
      }

      if (student.prenom) {
        const standardized = toTitleCase(student.prenom);
        if (standardized !== student.prenom) {
          updates.prenom = standardized;
          originalValues.prenom = student.prenom;
        }
      }

      if (student.cin) {
        const standardized = formatCIN(student.cin);
        if (standardized !== student.cin) {
          updates.cin = standardized;
          originalValues.cin = student.cin;
        }
      }

      if (student.email) {
        const standardized = formatEmail(student.email);
        if (standardized !== student.email) {
          updates.email = standardized;
          originalValues.email = student.email;
        }
      }

      if (student.phone) {
        const standardized = formatPhone(student.phone);
        if (standardized !== student.phone) {
          updates.phone = standardized;
          originalValues.phone = student.phone;
        }
      }

      if (student.whatsapp) {
        const standardized = formatPhone(student.whatsapp);
        if (standardized !== student.whatsapp) {
          updates.whatsapp = standardized;
          originalValues.whatsapp = student.whatsapp;
        }
      }

      if (student.lieu_naissance) {
        const standardized = toTitleCase(student.lieu_naissance);
        if (standardized !== student.lieu_naissance) {
          updates.lieu_naissance = standardized;
          originalValues.lieu_naissance = student.lieu_naissance;
        }
      }

      if (student.adresse) {
        const standardized = toTitleCase(student.adresse);
        if (standardized !== student.adresse) {
          updates.adresse = standardized;
          originalValues.adresse = student.adresse;
        }
      }

      // Apply updates if any changes needed
      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map((key, idx) => `${key} = $${idx + 2}`);
        const values = [student.id, ...Object.values(updates)];

        await client.query(
          `UPDATE students SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          values
        );

        updatedCount++;
        changes.push({
          id: student.id,
          name: `${student.prenom || ''} ${student.nom || ''}`.trim(),
          changes: Object.keys(updates).map(key => ({
            field: key,
            from: originalValues[key],
            to: updates[key]
          }))
        });

        console.log(`✓ Updated: ${student.prenom || ''} ${student.nom || ''}`);
        Object.keys(updates).forEach(key => {
          console.log(`    ${key}: "${originalValues[key]}" -> "${updates[key]}"`);
        });
      }
    }

    await client.query('COMMIT');

    console.log(`\n✅ Migration 099 completed!`);
    console.log(`   Total students: ${studentsResult.rows.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Unchanged: ${studentsResult.rows.length - updatedCount}`);

    return {
      success: true,
      message: `Standardized ${updatedCount} out of ${studentsResult.rows.length} students`,
      totalStudents: studentsResult.rows.length,
      updatedStudents: updatedCount,
      unchangedStudents: studentsResult.rows.length - updatedCount,
      changes: changes.slice(0, 20) // Return first 20 changes for display
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 099 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// POST endpoint
router.post('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /run endpoint for MigrationPanel
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration();
    res.json({ success: true, details: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET endpoint
router.get('/', async (req, res) => {
  try {
    // Preview mode - show what would change without applying
    const studentsResult = await pool.query(`
      SELECT id, nom, prenom, cin, email, phone, whatsapp, lieu_naissance, adresse
      FROM students
      LIMIT 100
    `);

    let needsUpdate = 0;

    for (const student of studentsResult.rows) {
      let hasChanges = false;

      if (student.nom && toTitleCase(student.nom) !== student.nom) hasChanges = true;
      if (student.prenom && toTitleCase(student.prenom) !== student.prenom) hasChanges = true;
      if (student.cin && formatCIN(student.cin) !== student.cin) hasChanges = true;
      if (student.email && formatEmail(student.email) !== student.email) hasChanges = true;
      if (student.phone && formatPhone(student.phone) !== student.phone) hasChanges = true;
      if (student.lieu_naissance && toTitleCase(student.lieu_naissance) !== student.lieu_naissance) hasChanges = true;

      if (hasChanges) needsUpdate++;
    }

    res.json({
      success: true,
      preview: true,
      message: `${needsUpdate} students out of ${studentsResult.rows.length} (sampled) need standardization`,
      studentsNeedingUpdate: needsUpdate,
      totalSampled: studentsResult.rows.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /status endpoint
router.get('/status', async (req, res) => {
  try {
    // Check a sample of students to see if standardization is needed
    const sampleResult = await pool.query(`
      SELECT nom, prenom, cin, lieu_naissance
      FROM students
      LIMIT 50
    `);

    let needsStandardization = 0;

    for (const student of sampleResult.rows) {
      if (student.nom && student.nom !== toTitleCase(student.nom)) needsStandardization++;
      else if (student.prenom && student.prenom !== toTitleCase(student.prenom)) needsStandardization++;
      else if (student.cin && student.cin !== formatCIN(student.cin)) needsStandardization++;
      else if (student.lieu_naissance && student.lieu_naissance !== toTitleCase(student.lieu_naissance)) needsStandardization++;
    }

    const applied = needsStandardization === 0;

    res.json({
      applied,
      status: { migrationNeeded: !applied },
      message: applied
        ? 'Migration 099 appliquée - données étudiants standardisées'
        : `Migration 099 nécessaire - ${needsStandardization} étudiants (sur ${sampleResult.rows.length} échantillonnés) ont besoin de standardisation`
    });
  } catch (error) {
    res.status(500).json({
      applied: false,
      status: { migrationNeeded: true },
      message: error.message
    });
  }
});

export default router;
