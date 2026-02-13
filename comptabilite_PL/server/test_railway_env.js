
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:kMfsYpEZqZorPiMaUPvQnOoBqysrEjQx@maglev.proxy.rlwy.net:17589/railway';

async function test() {
    console.log('Testing connection to:', connectionString.replace(/:[^:@]+@/, ':****@'));
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully to .env.railway DB!');
        const res = await client.query('SELECT NOW()');
        console.log('Time:', res.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

test();
