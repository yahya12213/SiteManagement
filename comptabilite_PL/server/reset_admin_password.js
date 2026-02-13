
import pool from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();
        console.log('✅ Connected.');

        const username = 'admin';
        const newPassword = 'admin123';

        // Hash the password
        console.log(`🔒 Hashing password "${newPassword}"...`);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user
        console.log(`📝 Updating password for user "${username}"...`);
        const result = await client.query(
            'UPDATE profiles SET password = $1 WHERE username = $2 RETURNING id, username',
            [hashedPassword, username]
        );

        if (result.rowCount > 0) {
            console.log(`✅ Password for "${username}" has been reset successfully.`);
            console.log('User ID:', result.rows[0].id);
        } else {
            console.error(`❌ User "${username}" not found in profiles table.`);

            // Attempt to find by email or list users if admin not found
            const allUsers = await client.query('SELECT username FROM profiles LIMIT 5');
            console.log('Existing users:', allUsers.rows.map(u => u.username));
        }

        client.release();
    } catch (err) {
        console.error('❌ Error resetting password:', err);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
