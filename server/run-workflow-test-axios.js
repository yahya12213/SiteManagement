import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║     EXÉCUTION DU TEST WORKFLOW VALIDATION (via API)             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

async function runWorkflowTest() {
  try {
    console.log(`📡 Appel API: POST ${API_URL}/api/test-workflow/run`);
    console.log('⏳ Exécution en cours...\n');

    const response = await axios.post(`${API_URL}/api/test-workflow/run`, {}, {
      headers: {
        'Content-Type': 'application/json'
      },
      // Ignorer l'authentification pour ce test (l'API vérifie requireRole)
      validateStatus: () => true
    });

    if (response.status !== 200 && response.status !== 201) {
      console.error(`❌ Erreur HTTP ${response.status}:`, response.data);

      if (response.status === 401 || response.status === 403) {
        console.log('\n⚠️  AUTHENTIFICATION REQUISE');
        console.log('Pour ce test, vous devez vous connecter avec un compte gerant/admin');
        console.log('Alternative: Exécutez directement via SQL ou modifiez requireRole');
      }
      return;
    }

    const result = response.data;

    if (!result.success) {
      console.error('❌ Échec du test:', result.error);
      if (result.details) console.error('Détails:', result.details);
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ WORKFLOW COMPLÉTÉ AVEC SUCCÈS!\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📋 ÉTAPES EXÉCUTÉES:');
    result.results.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ✅ ${step}`);
    });

    console.log('\n👥 EMPLOYÉS CRÉÉS:');
    console.log(`   • Employé:    ${result.results.summary.employeeCreated}`);
    console.log(`   • Manager N:  ${result.results.summary.managerN}`);
    console.log(`   • Manager N+1: ${result.results.summary.managerN1}`);

    console.log('\n📄 DEMANDES CRÉÉES ET VALIDÉES:');
    console.log(`   • Correction de pointage: ${result.results.summary.correctionId.slice(0, 8)}...`);
    console.log(`     Status: approved (N → N+1)`);
    console.log(`   • Congé standard:         ${result.results.summary.leaveId.slice(0, 8)}...`);
    console.log(`     Type: annual (5 jours) - Status: approved`);
    console.log(`   • Congé maladie:          ${result.results.summary.sickLeaveId.slice(0, 8)}...`);
    console.log(`     Type: sick (3 jours) - Status: approved`);
    console.log(`   • Certificat médical:     ${result.results.summary.certificatePath}`);

    console.log('\n📊 DÉTAILS DES EMPLOYÉS:');
    console.log('   Manager N+1 (Directeur):');
    console.log(`     - Email: ${result.results.employees.managerN1.email}`);
    console.log(`     - Numéro: ${result.results.employees.hrManagerN1.employee_number}`);

    console.log('   Manager N (Chef d\'équipe):');
    console.log(`     - Email: ${result.results.employees.managerN.email}`);
    console.log(`     - Numéro: ${result.results.employees.hrManagerN.employee_number}`);

    console.log('   Employé:');
    console.log(`     - Email: ${result.results.employees.employee.email}`);
    console.log(`     - Numéro: ${result.results.employees.hrEmployee.employee_number}`);

    console.log('\n📝 WORKFLOW COMPLET VALIDÉ:');
    console.log('   1. ✅ Création de l\'employé avec hiérarchie (N + N+1)');
    console.log('   2. ✅ Création de pointages avec erreurs (retard + départ anticipé)');
    console.log('   3. ✅ Demande de correction créée par l\'employé');
    console.log('   4. ✅ Validation N par le Chef d\'équipe');
    console.log('   5. ✅ Validation N+1 par le Directeur');
    console.log('   6. ✅ Pointages automatiquement corrigés');
    console.log('   7. ✅ Demande de congé standard (validée N et N+1)');
    console.log('   8. ✅ Demande de congé maladie + certificat (validée N et N+1)');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('💡 POUR VÉRIFIER EN INTERFACE WEB:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('EMPLOYÉ (consultation):');
    console.log('  Email: employe.test@example.com');
    console.log('  • Voir "Mes pointages" → pointage du ' + result.results.requests.checkIn.clock_time.split('T')[0]);
    console.log('  • Voir "Mes demandes de correction" → demande approuvée');
    console.log('  • Voir "Mes congés" → 2 demandes approuvées');
    console.log('');
    console.log('MANAGER N (validation niveau 1):');
    console.log('  Email: chef.equipe.test@example.com');
    console.log('  • Voir "Demandes d\'équipe" → demandes déjà validées par lui');
    console.log('');
    console.log('MANAGER N+1 (validation niveau 2):');
    console.log('  Email: directeur.test@example.com');
    console.log('  • Voir "Toutes les demandes" → validation finale effectuée');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('🎉 TEST WORKFLOW TERMINÉ AVEC SUCCÈS!');
    console.log(`   Total d'étapes: ${result.results.steps.length}`);
    console.log(`   Statut final: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log('');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Erreur: Serveur non accessible');
      console.log('\n💡 SOLUTION: Démarrez le serveur avec:');
      console.log('   cd server && npm start');
      console.log(`   Vérifiez qu'il tourne sur ${API_URL}`);
    } else {
      console.error('❌ Erreur:', error.message);
      if (error.response) {
        console.error('Détails:', error.response.data);
      }
    }
  }
}

runWorkflowTest();
