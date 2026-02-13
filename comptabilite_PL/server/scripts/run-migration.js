/**
 * Script pour exécuter une migration SQL sur Railway
 * Usage: node scripts/run-migration.js <migration-file>
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration(migrationFile) {
  try {
    const migrationPath = path.join(__dirname, '../../supabase/migrations', migrationFile);
    console.log(`Reading migration: ${migrationPath}`);

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    console.log('SQL:', sql);
    console.log('---');

    await pool.query(sql);

    console.log('✅ Migration executed successfully!');

    // Verify the constraint
    const result = await pool.query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'hr_attendance_records_source_check'
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Constraint updated:');
      console.log(result.rows[0].definition);
    }

  } catch (error) {
    console.error('❌ Error executing migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const migrationFile = process.argv[2] || '20260118000001_add_correction_source.sql';
runMigration(migrationFile);
