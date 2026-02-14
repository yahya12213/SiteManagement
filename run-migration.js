// Script to run the migration to fix sheet associations
// This will fix the "Charge Centre Prolean" appearing for "Sidi Slimane" issue

import https from 'https';

// Replace with your Railway URL
const RAILWAY_URL = 'comptabilite-pl-production.up.railway.app'; // Update this if different

const options = {
  hostname: RAILWAY_URL,
  port: 443,
  path: '/api/migration-fix-segments-and-sheets/run',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🚀 Running migration to fix sheet associations...');
console.log(`📍 URL: https://${RAILWAY_URL}/api/migration-fix-segments-and-sheets/run`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Migration response:', data);

    // Now run diagnostic to verify
    console.log('\n🔍 Running diagnostic to verify fixes...');
    runDiagnostic();
  });
});

req.on('error', (error) => {
  console.error('❌ Error running migration:', error);
  console.log('\n💡 Alternative: Use curl or Postman to make a POST request to:');
  console.log(`   https://${RAILWAY_URL}/api/migration-fix-segments-and-sheets/run`);
});

req.end();

function runDiagnostic() {
  https.get(`https://${RAILWAY_URL}/api/calculation-sheets/diagnostic`, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const diagnostic = JSON.parse(data);
        console.log('\n📊 Diagnostic Results:');

        // Check "Charge Centre Prolean" specifically
        const chargeCentre = diagnostic.sheets?.find(s => s.title.includes('Charge Centre Prolean'));
        if (chargeCentre) {
          console.log('\n🔍 "Charge Centre Prolean" associations:');
          console.log('   Cities:', chargeCentre.cities || 'None');
          console.log('   Segments:', chargeCentre.segments || 'None');

          const hasSidiSlimane = chargeCentre.cities?.some(c => c.includes('Sidi Slimane'));
          if (hasSidiSlimane) {
            console.log('   ⚠️  PROBLEM: Still associated with Sidi Slimane!');
          } else {
            console.log('   ✅ GOOD: Not associated with Sidi Slimane');
          }
        }

        // Check "Prolean Fiche de calcule"
        const proleanFiche = diagnostic.sheets?.find(s => s.title === 'Prolean Fiche de calcule');
        if (proleanFiche) {
          console.log('\n🔍 "Prolean Fiche de calcule" associations:');
          console.log('   Cities:', proleanFiche.cities || 'None');
          console.log('   Segments:', proleanFiche.segments || 'None');
        }
      } catch (e) {
        console.log('Raw diagnostic data:', data);
      }
    });
  }).on('error', (error) => {
    console.error('Error running diagnostic:', error);
  });
}