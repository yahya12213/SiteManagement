/**
 * Database Backup Script
 * Run this before any major migration to protect your data
 * Usage: node backup-database.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'accounting_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

const BACKUP_DIR = './backups';

const createBackup = async () => {
  console.log('🔄 Starting database backup...');

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

  const client = await pool.connect();

  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tables: {}
    };

    // List of critical tables to backup
    const tablesToBackup = [
      'profiles',
      'students',
      'formations',
      'segments',
      'cities',
      'sessions_formation',
      'session_etudiants',
      'session_profs',
      'professor_segments',
      'professor_cities',
      'gerant_segments',
      'gerant_cities',
      'certificate_templates',
      'certificates',
      'student_payments',
      'corps_formation',
      'formation_pack_items'
    ];

    for (const table of tablesToBackup) {
      try {
        console.log(`  📦 Backing up table: ${table}`);
        const result = await client.query(`SELECT * FROM ${table}`);
        backup.tables[table] = {
          rowCount: result.rowCount,
          rows: result.rows
        };
        console.log(`    ✅ ${result.rowCount} rows`);
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`    ⚠️ Table ${table} does not exist, skipping`);
        } else {
          console.error(`    ❌ Error backing up ${table}:`, err.message);
        }
      }
    }

    // Save backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup saved to: ${backupFile}`);

    // Summary
    const totalRows = Object.values(backup.tables).reduce((sum, t) => sum + t.rowCount, 0);
    console.log(`📊 Total tables: ${Object.keys(backup.tables).length}`);
    console.log(`📊 Total rows: ${totalRows}`);

    return backupFile;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

const restoreBackup = async (backupFilePath) => {
  console.log(`🔄 Restoring from backup: ${backupFilePath}`);

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }

  const backup = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  console.log(`  📅 Backup timestamp: ${backup.timestamp}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Restore in reverse dependency order
    const restoreOrder = [
      'segments',
      'cities',
      'corps_formation',
      'formations',
      'profiles',
      'students',
      'sessions_formation',
      'session_etudiants',
      'session_profs',
      'professor_segments',
      'professor_cities',
      'gerant_segments',
      'gerant_cities',
      'certificate_templates',
      'certificates',
      'student_payments',
      'formation_pack_items'
    ];

    for (const table of restoreOrder) {
      if (backup.tables[table]) {
        console.log(`  🔄 Restoring table: ${table}`);
        const tableData = backup.tables[table];

        if (tableData.rows.length > 0) {
          // Clear existing data
          await client.query(`DELETE FROM ${table}`);

          // Insert backed up data
          const columns = Object.keys(tableData.rows[0]);
          const values = tableData.rows.map(row =>
            columns.map(col => row[col])
          );

          for (const row of tableData.rows) {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            await client.query(query, columns.map(col => row[col]));
          }

          console.log(`    ✅ Restored ${tableData.rowCount} rows`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Restore completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Restore failed, rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Check command line arguments
const args = process.argv.slice(2);

if (args[0] === 'restore' && args[1]) {
  restoreBackup(args[1]).catch(console.error);
} else if (args[0] === 'restore') {
  console.log('Usage: node backup-database.js restore <backup-file-path>');
} else {
  createBackup().catch(console.error);
}
