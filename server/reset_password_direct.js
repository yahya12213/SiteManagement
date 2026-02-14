
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

async function resetPasswords() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        const updates = [
            { username: 'admin', password: 'Admin!7X9#mK2$nP', full_name: 'Administrateur', role: 'admin' },
            { username: 'khalidfathi', password: 'Khalid@8Y3%qL5&w', full_name: 'Khalid Fathi', role: 'admin' }
        ];

        for (const u of updates) {
            console.log(`🔒 Hashing password for "${u.username}"...`);
            const hashedPassword = await bcrypt.hash(u.password, 10);

            console.log(`📝 Processing user "${u.username}"...`);
            // Try UPDATE first
            const updateRes = await client.query(
                'UPDATE profiles SET password = $1, full_name = $3, role = $4 WHERE username = $2 RETURNING id',
                [hashedPassword, u.username, u.full_name, u.role]
            );

            if (updateRes.rowCount > 0) {
                console.log(`✅ Updated existing user "${u.username}"`);
            } else {
                console.log(`✨ Creating new user "${u.username}"...`);
                // Insert if not found
                // Generating a simple ID since ID is TEXT. Usually nanoid or uuid, but for seed we can use timestamp + random or just username
                const newId = `user_${u.username}_${Date.now()}`;
                await client.query(
                    'INSERT INTO profiles (id, username, password, full_name, role) VALUES ($1, $2, $3, $4, $5)',
                    [newId, u.username, hashedPassword, u.full_name, u.role]
                );
                console.log(`✅ Created user "${u.username}"`);
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

resetPasswords();
