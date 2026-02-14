import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

async function checkPermissionsSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        console.log('\n📊 Checking permissions table schema...');
        const schemaResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'permissions'
            ORDER BY ordinal_position;
        `);

        console.log('Columns in permissions table:');
        schemaResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n📊 Checking permissions count...');
        const countResult = await client.query('SELECT COUNT(*) as count FROM permissions');
        console.log(`Total permissions: ${countResult.rows[0].count}`);

        console.log('\n📊 Sample permissions (first 10):');
        const sampleResult = await client.query('SELECT code, name, module, menu, action FROM permissions LIMIT 10');
        sampleResult.rows.forEach(perm => {
            console.log(`  - ${perm.code} | ${perm.name || 'N/A'} | ${perm.module}.${perm.menu}.${perm.action}`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

checkPermissionsSchema();
