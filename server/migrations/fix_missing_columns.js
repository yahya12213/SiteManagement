
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

async function fixMissingColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        console.log('📝 Adding missing columns to segments table...');
        await client.query(`
            ALTER TABLE segments 
            ADD COLUMN IF NOT EXISTS cnss_number TEXT,
            ADD COLUMN IF NOT EXISTS identifiant_fiscal TEXT,
            ADD COLUMN IF NOT EXISTS registre_commerce TEXT,
            ADD COLUMN IF NOT EXISTS ice TEXT,
            ADD COLUMN IF NOT EXISTS company_address TEXT,
            ADD COLUMN IF NOT EXISTS logo_url TEXT;
        `);
        console.log('✅ Segments table updated.');

        console.log('📝 Adding missing columns to profiles table...');
        await client.query(`
            ALTER TABLE profiles 
            ADD COLUMN IF NOT EXISTS role_id TEXT,
            ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
        `);
        console.log('✅ Profiles table updated.');

        console.log('\n✅ All missing columns added successfully!');
        console.log('You can now create segments, users, and other entities.\n');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

fixMissingColumns();
