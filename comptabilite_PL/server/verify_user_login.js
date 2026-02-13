
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

async function verifyLogin(username, password) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT * FROM profiles WHERE username = $1', [username]);

        if (res.rowCount === 0) {
            console.log(`❌ User "${username}" not found.`);
            return;
        }

        const user = res.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            console.log(`✅ Login SUCCESS for user "${username}"!`);
        } else {
            console.log(`❌ Login FAILED for user "${username}" (password mismatch).`);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

verifyLogin('admin', 'Admin!7X9#mK2$nP');
verifyLogin('khalidfathi', 'Khalid@8Y3%qL5&w');
