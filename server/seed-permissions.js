import fs from 'fs';
import path from 'path';
import pool from './src/config/database.js';

const PERMISSIONS_FILE = path.resolve('../src/config/permissions.ts');

async function seed() {
    try {
        console.log('📖 Reading permissions from frontend config...');
        const content = fs.readFileSync(PERMISSIONS_FILE, 'utf8');

        // Regex to find 'module.menu.action': 'Label' or 'module.action': 'Label'
        // We look specifically inside the labels object in getPermissionLabel
        const labelMatch = content.match(/const labels: Record<string, string> = {([\s\S]+?)};/);
        if (!labelMatch) {
            throw new Error('Could not find labels object in permissions.ts');
        }

        const labelsText = labelMatch[1];
        const permRegex = /'([a-z_0-9.]+)':\s*'([^']+)'/g;

        const permissions = [];
        let match;
        while ((match = permRegex.exec(labelsText)) !== null) {
            const code = match[1];
            const label = match[2];

            const parts = code.split('.');
            let module = '', menu = '', action = '';

            if (parts.length === 3) {
                [module, menu, action] = parts;
            } else if (parts.length === 2) {
                [module, action] = parts;
                menu = action; // Fallback
            } else {
                module = parts[0];
                menu = parts[0];
                action = 'acces';
            }

            permissions.push({ code, label, module, menu, action });
        }

        console.log(`✅ Found ${permissions.length} permissions in frontend config.`);

        // Add wildcard permission if not exists
        if (!permissions.find(p => p.code === '*')) {
            permissions.unshift({
                code: '*',
                label: 'Super Admin (Toutes les permissions)',
                module: 'system',
                menu: 'all',
                action: 'wildcard'
            });
        }

        console.log('🚀 Syncing with database...');

        // Using a transaction for safety
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let inserted = 0;
            let updated = 0;

            for (const perm of permissions) {
                const result = await client.query(`
          INSERT INTO permissions (module, code, name)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE 
          SET name = EXCLUDED.name,
              module = EXCLUDED.module
          RETURNING *
        `, [perm.module, perm.code, perm.label]);

                if (result.rowCount > 0) {
                    inserted++;
                }
            }

            await client.query('COMMIT');
            console.log(`✨ Successfully synced permissions! Total: ${permissions.length} (Processed: ${inserted})`);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        process.exit();
    }
}

seed();
