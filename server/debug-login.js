
import pool from './src/config/database.js';

async function checkUsers() {
    try {
        console.log('Testing connection using app configuration...');
        const client = await pool.connect();
        console.log('✅ Connected successfully!');

        const tables = ['users', 'profiles'];

        for (const tableName of tables) {
            console.log(`\nChecking table "${tableName}"...`);
            const tableRes = await client.query(`
          SELECT exists (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = $1
          );
        `, [tableName]);

            if (!tableRes.rows[0].exists) {
                console.log(`❌ Table "${tableName}" does not exist.`);
            } else {
                console.log(`✅ Table "${tableName}" exists.`);
                // List users
                try {
                    const res = await client.query(`SELECT * FROM ${tableName} LIMIT 5`);
                    console.log(`Found ${res.rowCount} records:`);
                    if (res.rowCount > 0) {
                        console.table(res.rows.map(row => {
                            // Mask password
                            const safeRow = { ...row };
                            if (safeRow.password) safeRow.password = '********';
                            return safeRow;
                        }));
                    }
                } catch (queryErr) {
                    console.error(`Error querying ${tableName}:`, queryErr.message);
                }
            }
        }

        client.release();
    } catch (err) {
        console.error('❌ Database connection error:', err);
    } finally {
        await pool.end();
    }
}

checkUsers();
