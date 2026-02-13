
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

const configs = [
    { name: 'SSL RejectUnauthorized: False', ssl: { rejectUnauthorized: false } },
    { name: 'SSL: True (Strict)', ssl: true },
    { name: 'SSL: False (No SSL)', ssl: false },
    { name: 'SSL: Allow (String)', ssl: 'no-verify' } // Not valid for pg, but checking behavior
];

async function testConnections() {
    console.log('Testing connection variants...');
    console.log('URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Mask password

    for (const conf of configs) {
        console.log(`\n----------------------------------------`);
        console.log(`Testing Config: ${conf.name}`);
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: conf.ssl === 'no-verify' ? { rejectUnauthorized: false } : conf.ssl
        });

        try {
            await client.connect();
            console.log('✅ CONNECTED SUCCESSFULY!');
            const res = await client.query('SELECT NOW()');
            console.log('Query Result:', res.rows[0]);
            await client.end();
            // If successful, we can break or continue to see if others work
            // But we found a working one, so let's stick with it for the fix
            process.exit(0);
        } catch (err) {
            console.error(`❌ FAILED: ${err.message}`);
            if (err.code) console.error(`   Code: ${err.code}`);
            if (err.detail) console.error(`   Detail: ${err.detail}`);
        }
    }
}

testConnections();
