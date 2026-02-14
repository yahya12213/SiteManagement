import pg from 'pg';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Construct DATABASE_URL from environment variables
const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

console.log('Connecting to database...');

const client = new pg.Client({ connectionString: DATABASE_URL });

async function checkCertificate() {
  await client.connect();

  try {
    const result = await client.query(`
      SELECT
        c.id,
        c.student_id,
        c.session_id,
        c.certificate_number,
        c.document_type,
        c.issued_at,
        c.template_name,
        c.print_status,
        s.prenom,
        s.nom,
        s.cin
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      WHERE s.nom ILIKE '%zz%' OR s.prenom ILIKE '%zz%'
      ORDER BY c.issued_at DESC
      LIMIT 5
    `);

    console.log('\n=== Certificates for student ZZ ZZ ===\n');
    console.log('Found', result.rows.length, 'certificate(s)\n');

    result.rows.forEach((row, i) => {
      console.log(`Certificate ${i + 1}:`);
      console.log('  ID:', row.id);
      console.log('  Student:', row.prenom, row.nom, '(CIN:', row.cin + ')');
      console.log('  Student ID:', row.student_id);
      console.log('  Certificate Number:', row.certificate_number);
      console.log('  Session ID:', row.session_id || '❌ NULL');
      console.log('  Document Type:', row.document_type || '❌ NULL');
      console.log('  Template Name:', row.template_name || 'NULL');
      console.log('  Print Status:', row.print_status || 'NULL');
      console.log('  Issued At:', row.issued_at);
      console.log('');
    });

    // If session_id is missing, suggest fix
    const missingSessionId = result.rows.filter(row => !row.session_id);
    if (missingSessionId.length > 0) {
      console.log('⚠️  WARNING: Found', missingSessionId.length, 'certificate(s) without session_id');
      console.log('This is why the modal shows "Aucun document généré"\n');
    }

  } finally {
    await client.end();
  }
}

checkCertificate().catch(err => {
  console.error('Error:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});
