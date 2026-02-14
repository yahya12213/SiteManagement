import pool from './src/config/database.js';

async function diagnose() {
    try {
        console.log('--- TABLE SCHEMAS ---');
        const tables = ['profiles', 'roles', 'permissions', 'role_permissions', 'user_roles'];
        for (const table of tables) {
            try {
                const result = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
                console.log(`\nTable: ${table}`);
                console.table(result.rows);
            } catch (e) {
                console.log(`Table ${table} not found or error: ${e.message}`);
            }
        }

        console.log('\n--- PERMISSIONS SAMPLE (Top 20) ---');
        const perms = await pool.query('SELECT code, name, module FROM permissions LIMIT 20');
        console.table(perms.rows);

        console.log('\n--- TOTAL PERMISSIONS COUNT ---');
        const count = await pool.query('SELECT COUNT(*) FROM permissions');
        console.log(`Total: ${count.rows[0].count}`);

    } catch (error) {
        console.error('Diagnosis failed:', error);
    } finally {
        process.exit();
    }
}

diagnose();
