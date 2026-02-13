import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const hashPasswords = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔐 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Get all users with plain text passwords
    const users = await client.query('SELECT id, username, password FROM profiles');

    console.log(`\n📝 Found ${users.rows.length} users to process:\n`);

    for (const user of users.rows) {
      try {
        // Try to verify if password is already hashed
        const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');

        if (isHashed) {
          console.log(`⏭️  ${user.username}: Already hashed, skipping`);
          continue;
        }

        console.log(`🔒 Hashing password for: ${user.username}`);
        const plainPassword = user.password;
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        await client.query(
          'UPDATE profiles SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );

        console.log(`✅ ${user.username}: Password hashed successfully (was: "${plainPassword}")`);
      } catch (error) {
        console.error(`❌ Error processing ${user.username}:`, error.message);
      }
    }

    console.log('\n✅ All passwords hashed successfully!');
    console.log('\n📋 You can now login with:');
    console.log('   - admin / admin123');
    console.log('   - khalidfathi / khalidfathi');

    await client.end();
  } catch (error) {
    console.error('❌ Failed to hash passwords:', error.message);
    await client.end();
    process.exit(1);
  }
};

hashPasswords();
