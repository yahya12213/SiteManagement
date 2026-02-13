import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkTemplatePermission() {
  const client = await pool.connect();

  try {
    console.log('=== Diagnostic: training.certificate_templates.create permission ===\n');

    // 1. Check if permission exists
    console.log('Step 1: Checking if permission exists in database...');
    const permResult = await client.query(`
      SELECT id, code, label, module, menu, action, description
      FROM permissions
      WHERE code = 'training.certificate_templates.create'
    `);

    if (permResult.rows.length === 0) {
      console.log('❌ Permission NOT FOUND in database!');
      console.log('   This is the problem - permission does not exist.\n');

      // Check what certificate template permissions DO exist
      console.log('Step 2: Checking existing certificate template permissions...');
      const existingPerms = await client.query(`
        SELECT code, label
        FROM permissions
        WHERE code LIKE '%certificate_template%'
        ORDER BY code
      `);

      if (existingPerms.rows.length > 0) {
        console.log('Found these similar permissions:');
        existingPerms.rows.forEach(p => {
          console.log(`  - ${p.code}: ${p.label}`);
        });
      } else {
        console.log('No certificate template permissions found in database!');
      }

      return;
    }

    console.log('✅ Permission EXISTS in database:');
    const perm = permResult.rows[0];
    console.log(`   ID: ${perm.id}`);
    console.log(`   Code: ${perm.code}`);
    console.log(`   Label: ${perm.label}`);
    console.log(`   Module: ${perm.module}`);
    console.log(`   Menu: ${perm.menu}`);
    console.log(`   Action: ${perm.action}`);
    console.log(`   Description: ${perm.description || 'N/A'}\n`);

    // 2. Check if permission is assigned to gérant role
    console.log('Step 2: Checking if permission is assigned to gérant role...');
    const rolePermResult = await client.query(`
      SELECT r.name as role_name, r.id as role_id
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'training.certificate_templates.create'
        AND r.name = 'gerant'
    `);

    if (rolePermResult.rows.length === 0) {
      console.log('❌ Permission NOT ASSIGNED to gérant role!');
      console.log('   This is the problem - permission exists but not assigned to gérant.\n');

      // Check which roles DO have this permission
      console.log('Step 3: Checking which roles have this permission...');
      const rolesWithPerm = await client.query(`
        SELECT r.name as role_name
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE p.code = 'training.certificate_templates.create'
        ORDER BY r.name
      `);

      if (rolesWithPerm.rows.length > 0) {
        console.log('This permission is assigned to:');
        rolesWithPerm.rows.forEach(r => {
          console.log(`  - ${r.role_name}`);
        });
      } else {
        console.log('This permission is not assigned to ANY role!');
      }

      return;
    }

    console.log('✅ Permission IS ASSIGNED to gérant role');
    console.log(`   Role ID: ${rolePermResult.rows[0].role_id}\n`);

    // 3. Check Khalid's user and permissions
    console.log('Step 3: Checking Khalid Fathi user...');
    const khalidResult = await client.query(`
      SELECT a.id, a.username, p.first_name, p.last_name, r.name as role_name
      FROM accounts a
      LEFT JOIN profiles p ON p.account_id = a.id
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE p.first_name ILIKE '%khalid%'
        AND p.last_name ILIKE '%fathi%'
    `);

    if (khalidResult.rows.length === 0) {
      console.log('❌ Khalid Fathi user not found!');
      return;
    }

    const khalid = khalidResult.rows[0];
    console.log('✅ Found Khalid Fathi:');
    console.log(`   Account ID: ${khalid.id}`);
    console.log(`   Username: ${khalid.username}`);
    console.log(`   Role: ${khalid.role_name}\n`);

    // 4. Check if permission is in his role's permission list
    console.log('Step 4: Checking if permission is in his role permissions...');
    const khalidPermCheck = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN accounts a ON a.role_id = rp.role_id
      WHERE a.id = $1
        AND p.code = 'training.certificate_templates.create'
    `, [khalid.id]);

    if (khalidPermCheck.rows.length === 0) {
      console.log('❌ Permission NOT in Khalid\'s role permissions!');
      console.log(`   Khalid's role (${khalid.role_name}) does not have this permission.\n`);
      return;
    }

    console.log('✅ Permission IS in Khalid\'s role permissions\n');

    // 5. Count all permissions for gérant role
    console.log('Step 5: Counting total permissions for gérant role...');
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE r.name = 'gerant'
    `);

    console.log(`Total permissions for gérant: ${countResult.rows[0].total}\n`);

    console.log('=== CONCLUSION ===');
    console.log('✅ Permission exists');
    console.log('✅ Permission is assigned to gérant role');
    console.log('✅ Khalid has gérant role');
    console.log('✅ Permission is in his role permissions');
    console.log('\n🔍 ISSUE: Permission is properly configured in database.');
    console.log('   Problem must be with JWT token not containing this permission.');
    console.log('   Solution: Khalid needs to logout and login again to get fresh JWT token.\n');

  } catch (error) {
    console.error('❌ Error during diagnostic:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTemplatePermission();
