// Test du moteur de formules
import { parseFormula } from './parser';
import { evaluateFormula } from './evaluator';
import { calculateAllValues } from './dependency';
import { DEFAULT_CALCULATION_TEMPLATE } from './defaultTemplate';

// Test 1: Parser simple
console.log('=== Test 1: Parser ===');
const parseTest1 = parseFormula('2 + 3 * 4');
console.log('Expression: 2 + 3 * 4');
console.log('Parse success:', parseTest1.success);
console.log('AST:', JSON.stringify(parseTest1.ast, null, 2));

// Test 2: Parser avec fonction
console.log('\n=== Test 2: Parser avec fonction ===');
const parseTest2 = parseFormula('SUM(10, 20, 30)');
console.log('Expression: SUM(10, 20, 30)');
console.log('Parse success:', parseTest2.success);

// Test 3: Évaluation simple
console.log('\n=== Test 3: Évaluation ===');
if (parseTest1.success && parseTest1.ast) {
  const evalResult = evaluateFormula(parseTest1.ast);
  console.log('Résultat: 2 + 3 * 4 =', evalResult.value); // Devrait être 14
}

// Test 4: Évaluation avec contexte
console.log('\n=== Test 4: Évaluation avec références ===');
const parseTest4 = parseFormula('HEURES_REAL * TARIF_H');
if (parseTest4.success && parseTest4.ast) {
  const evalResult = evaluateFormula(parseTest4.ast, {
    HEURES_REAL: 20,
    TARIF_H: 200,
  });
  console.log('HEURES_REAL=20, TARIF_H=200');
  console.log('Résultat: HEURES_REAL * TARIF_H =', evalResult.value); // Devrait être 4000
}

// Test 5: Test avec le template par défaut
console.log('\n=== Test 5: Calcul complet avec template ===');
const testValues = {
  HEURES_REAL: 20,
  TARIF_H: 200,
  FRAIS_SALLE: 100,
  FRAIS_SUPPORTS: 50,
  FRAIS_DEPL: 50,
  TAUX_CENTRE: 30,
  AVANCE_PROF: 500,
  PENALITES: 0,
  IR_PROF: 200,
  CNSS_PROF: 0,
};

const results = calculateAllValues(DEFAULT_CALCULATION_TEMPLATE.fields, testValues);

console.log('Valeurs saisies:', testValues);
console.log('\nRésultats calculés:');
console.log('MONTANT_BRUT =', results.MONTANT_BRUT, '(attendu: 4000)');
console.log('FRAIS_TOTAL =', results.FRAIS_TOTAL, '(attendu: 200)');
console.log('BASE_PARTAGE =', results.BASE_PARTAGE, '(attendu: 3800)');
console.log('PART_CENTRE =', results.PART_CENTRE, '(attendu: 1140)');
console.log('PART_PROF_BRUTE =', results.PART_PROF_BRUTE, '(attendu: 2660)');
console.log('RETENUES_PROF =', results.RETENUES_PROF, '(attendu: 700)');
console.log('PART_PROF_NET =', results.PART_PROF_NET, '(attendu: 1960)');

// Test 6: Détection d'erreurs
console.log('\n=== Test 6: Détection d\'erreurs ===');
const divZeroTest = parseFormula('10 / 0');
if (divZeroTest.success && divZeroTest.ast) {
  const result = evaluateFormula(divZeroTest.ast);
  console.log('10 / 0 =', result.value); // Devrait être #DIV/0!
}

const refErrorTest = parseFormula('VALEUR_INEXISTANTE + 10');
if (refErrorTest.success && refErrorTest.ast) {
  const result = evaluateFormula(refErrorTest.ast, {});
  console.log('VALEUR_INEXISTANTE + 10 =', result.value); // Devrait être #REF!
}

console.log('\n=== Tests terminés ===');
