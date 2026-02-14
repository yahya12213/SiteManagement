import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function runSystemCheck() {
    console.log('🔍 RAILWAY SYSTEM DIAGNOSTICS');
    console.log('='.repeat(60));
    console.log('\n📅 Timestamp:', new Date().toISOString());
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

    const results = {
        database: { status: 'unknown', details: {} },
        adminUser: { status: 'unknown', details: {} },
        tables: { status: 'unknown', details: {} },
        passwordTest: { status: 'unknown', details: {} }
    };

    // 1. DATABASE CONNECTION TEST
    console.log('\n' + '='.repeat(60));
    console.log('1️⃣  DATABASE CONNECTION TEST');
    console.log('='.repeat(60));
    try {
        const dbUrl = process.env.DATABASE_URL;
        const dbHost = dbUrl?.split('@')[1]?.split('/')[0];
        console.log('📍 Database Host:', dbHost);

        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Database connection: SUCCESS');
        console.log('⏰ Database time:', result.rows[0].current_time);
        console.log('🐘 PostgreSQL version:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);
        results.database.status = 'connected';
        results.database.details = result.rows[0];
    } catch (error) {
        console.log('❌ Database connection: FAILED');
        console.log('Error:', error.message);
        results.database.status = 'failed';
        results.database.error = error.message;
        return results; // Stop if DB connection fails
    }

    // 2. TABLES CHECK
    console.log('\n' + '='.repeat(60));
    console.log('2️⃣  TABLES EXISTENCE CHECK');
    console.log('='.repeat(60));
    try {
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'roles', 'permissions', 'role_permissions')
      ORDER BY table_name
    `);

        const existingTables = tablesResult.rows.map(r => r.table_name);
        const requiredTables = ['profiles', 'roles', 'permissions', 'role_permissions'];

        console.log('📊 Required tables:', requiredTables.join(', '));
        console.log('✅ Existing tables:', existingTables.join(', '));

        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        if (missingTables.length > 0) {
            console.log('⚠️  Missing tables:', missingTables.join(', '));
            results.tables.status = 'incomplete';
            results.tables.missing = missingTables;
        } else {
            console.log('✅ All required tables exist');
            results.tables.status = 'complete';
        }
        results.tables.existing = existingTables;
    } catch (error) {
        console.log('❌ Tables check: FAILED');
        console.log('Error:', error.message);
        results.tables.status = 'failed';
        results.tables.error = error.message;
    }

    // 3. ADMIN USER CHECK
    console.log('\n' + '='.repeat(60));
    console.log('3️⃣  ADMIN USER CHECK');
    console.log('='.repeat(60));
    try {
        const adminResult = await pool.query(`
      SELECT 
        id, 
        username, 
        role, 
        role_id,
        full_name,
        LENGTH(password) as password_length,
        SUBSTRING(password, 1, 7) as password_hash_prefix,
        created_at
      FROM profiles 
      WHERE username = 'admin'
    `);

        if (adminResult.rows.length === 0) {
            console.log('❌ Admin user: NOT FOUND');
            results.adminUser.status = 'not_found';
        } else {
            const admin = adminResult.rows[0];
            console.log('✅ Admin user: FOUND');
            console.log('   ID:', admin.id);
            console.log('   Username:', admin.username);
            console.log('   Role:', admin.role);
            console.log('   Role ID:', admin.role_id);
            console.log('   Full Name:', admin.full_name);
            console.log('   Password Hash Length:', admin.password_length);
            console.log('   Password Hash Prefix:', admin.password_hash_prefix);
            console.log('   Created:', admin.created_at);
            results.adminUser.status = 'found';
            results.adminUser.details = admin;
        }
    } catch (error) {
        console.log('❌ Admin user check: FAILED');
        console.log('Error:', error.message);
        results.adminUser.status = 'failed';
        results.adminUser.error = error.message;
    }

    // 4. PASSWORD VERIFICATION TEST
    console.log('\n' + '='.repeat(60));
    console.log('4️⃣  PASSWORD VERIFICATION TEST');
    console.log('='.repeat(60));
    try {
        const testPassword = 'Admin@2026';
        console.log('🔐 Testing password:', testPassword);

        const userResult = await pool.query(
            'SELECT id, username, password FROM profiles WHERE username = $1',
            ['admin']
        );

        if (userResult.rows.length === 0) {
            console.log('❌ Cannot test password: Admin user not found');
            results.passwordTest.status = 'user_not_found';
        } else {
            const user = userResult.rows[0];
            const isValid = await bcrypt.compare(testPassword, user.password);

            if (isValid) {
                console.log('✅ Password verification: SUCCESS');
                console.log('   The password "Admin@2026" matches the hash in database');
                results.passwordTest.status = 'valid';
            } else {
                console.log('❌ Password verification: FAILED');
                console.log('   The password "Admin@2026" does NOT match the hash in database');
                console.log('   This means the password in the database is different!');
                results.passwordTest.status = 'invalid';
            }
        }
    } catch (error) {
        console.log('❌ Password test: FAILED');
        console.log('Error:', error.message);
        results.passwordTest.status = 'failed';
        results.passwordTest.error = error.message;
    }

    // 5. USERS COUNT
    console.log('\n' + '='.repeat(60));
    console.log('5️⃣  USERS STATISTICS');
    console.log('='.repeat(60));
    try {
        const countResult = await pool.query('SELECT COUNT(*) as total FROM profiles');
        const roleCountResult = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM profiles 
      GROUP BY role 
      ORDER BY count DESC
    `);

        console.log('👥 Total users:', countResult.rows[0].total);
        console.log('📊 Users by role:');
        roleCountResult.rows.forEach(row => {
            console.log(`   - ${row.role || 'NULL'}: ${row.count}`);
        });
    } catch (error) {
        console.log('❌ Users statistics: FAILED');
        console.log('Error:', error.message);
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log('Database Connection:', results.database.status === 'connected' ? '✅ OK' : '❌ FAILED');
    console.log('Required Tables:', results.tables.status === 'complete' ? '✅ OK' : '⚠️  INCOMPLETE');
    console.log('Admin User:', results.adminUser.status === 'found' ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('Password Test:', results.passwordTest.status === 'valid' ? '✅ VALID' : '❌ INVALID');

    console.log('\n' + '='.repeat(60));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(60));

    if (results.passwordTest.status === 'invalid') {
        console.log('⚠️  PASSWORD MISMATCH DETECTED!');
        console.log('   The password in the database does NOT match "Admin@2026"');
        console.log('   Action: Run setup-admin-railway.js again to reset password');
    } else if (results.passwordTest.status === 'valid') {
        console.log('✅ Password is correct in database');
        console.log('   If login still fails, check:');
        console.log('   1. Frontend API URL configuration');
        console.log('   2. Railway service logs for errors');
        console.log('   3. CORS settings');
    }

    await pool.end();
    console.log('\n✅ Diagnostics complete\n');

    return results;
}

runSystemCheck().catch(console.error);
