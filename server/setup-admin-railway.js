import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function setupAdmin() {
    try {
        console.log('🔧 Setting up admin user on Railway database...');
        console.log('📍 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

        // Configuration - CHANGE THESE VALUES
        const ADMIN_USERNAME = 'admin';
        const ADMIN_PASSWORD = 'Admin@2026'; // CHANGE THIS TO YOUR DESIRED PASSWORD
        const ADMIN_FULL_NAME = 'System Administrator';

        console.log('\n📝 Admin credentials to set:');
        console.log('   Username:', ADMIN_USERNAME);
        console.log('   Password:', ADMIN_PASSWORD);
        console.log('   Full Name:', ADMIN_FULL_NAME);
        console.log('\n⚠️  Make sure to change the password in this script before running!\n');

        // Check if profiles table exists
        const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
      ) as exists
    `);

        if (!tableCheck.rows[0].exists) {
            console.error('❌ Error: profiles table does not exist!');
            console.log('💡 You may need to run migrations first.');
            process.exit(1);
        }

        // Check if admin user already exists
        const existingUser = await pool.query(
            'SELECT id, username, role FROM profiles WHERE username = $1',
            [ADMIN_USERNAME]
        );

        if (existingUser.rows.length > 0) {
            console.log('👤 Admin user already exists:', existingUser.rows[0]);
            console.log('\n🔄 Updating password...');

            // Update existing user's password
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await pool.query(
                'UPDATE profiles SET password = $1, role = $2, full_name = $3 WHERE username = $4',
                [hashedPassword, 'admin', ADMIN_FULL_NAME, ADMIN_USERNAME]
            );

            console.log('✅ Admin password updated successfully!');
        } else {
            console.log('➕ Creating new admin user...');

            // Create new admin user
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

            // Check if roles table exists and get admin role_id
            let roleId = null;
            try {
                const roleCheck = await pool.query(
                    "SELECT id FROM roles WHERE name = 'admin' LIMIT 1"
                );
                if (roleCheck.rows.length > 0) {
                    roleId = roleCheck.rows[0].id;
                    console.log('📋 Found admin role_id:', roleId);
                }
            } catch (err) {
                console.log('⚠️  Roles table not found, creating user without role_id');
            }

            const result = await pool.query(
                `INSERT INTO profiles (username, password, full_name, role, role_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id, username, role`,
                [ADMIN_USERNAME, hashedPassword, ADMIN_FULL_NAME, 'admin', roleId]
            );

            console.log('✅ Admin user created successfully!');
            console.log('👤 User details:', result.rows[0]);
        }

        // Verify the user can be found
        console.log('\n🔍 Verifying admin user...');
        const verification = await pool.query(
            'SELECT id, username, role, role_id, full_name, created_at FROM profiles WHERE username = $1',
            [ADMIN_USERNAME]
        );

        if (verification.rows.length > 0) {
            console.log('✅ Verification successful!');
            console.log('📊 Admin user details:');
            console.log(verification.rows[0]);
            console.log('\n🎉 You can now login with:');
            console.log('   Username:', ADMIN_USERNAME);
            console.log('   Password:', ADMIN_PASSWORD);
        } else {
            console.log('❌ Verification failed - user not found!');
        }

    } catch (error) {
        console.error('❌ Error setting up admin:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
        console.log('\n✅ Database connection closed.');
    }
}

// Run the setup
setupAdmin();
