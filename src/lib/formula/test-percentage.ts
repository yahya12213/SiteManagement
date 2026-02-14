import { parseFormula } from './parser';
import { evaluateFormula } from './evaluator';

// Test du support de l'opérateur %

console.log('=== Test de l\'opérateur % ===\n');

// Test 1: Simple pourcentage
const test1 = '2%';
const parse1 = parseFormula(test1);
console.log(`Test 1: ${test1}`);
console.log('Parse result:', parse1);
if (parse1.success && parse1.ast) {
  const result1 = evaluateFormula(parse1.ast, {});
  console.log('Result:', result1.value); // Devrait être 0.02
}
console.log('');

// Test 2: FO4*2% (comme demandé par l'utilisateur)
const test2 = 'FO4*2%';
const parse2 = parseFormula(test2);
console.log(`Test 2: ${test2}`);
console.log('Parse result:', parse2);
if (parse2.success && parse2.ast) {
  const result2 = evaluateFormula(parse2.ast, { FO4: 100 });
  console.log('Result with FO4=100:', result2.value); // Devrait être 100 * 0.02 = 2
}
console.log('');

// Test 3: ((FO8/3)*2)+F7+FO6+FO7
const test3 = '((FO8/3)*2)+F7+FO6+FO7';
const parse3 = parseFormula(test3);
console.log(`Test 3: ${test3}`);
console.log('Parse result:', parse3);
if (parse3.success && parse3.ast) {
  const result3 = evaluateFormula(parse3.ast, { FO8: 30, F7: 10, FO6: 5, FO7: 15 });
  console.log('Result with FO8=30, F7=10, FO6=5, FO7=15:', result3.value); // Devrait être ((30/3)*2)+10+5+15 = 20+10+5+15 = 50
}
console.log('');

// Test 4: (FO8/3)-FO3
const test4 = '(FO8/3)-FO3';
const parse4 = parseFormula(test4);
console.log(`Test 4: ${test4}`);
console.log('Parse result:', parse4);
if (parse4.success && parse4.ast) {
  const result4 = evaluateFormula(parse4.ast, { FO8: 30, FO3: 5 });
  console.log('Result with FO8=30, FO3=5:', result4.value); // Devrait être (30/3)-5 = 10-5 = 5
}
console.log('');

// Test 5: Cas plus complexe avec %
const test5 = '100+50%';
const parse5 = parseFormula(test5);
console.log(`Test 5: ${test5}`);
console.log('Parse result:', parse5);
if (parse5.success && parse5.ast) {
  const result5 = evaluateFormula(parse5.ast, {});
  console.log('Result:', result5.value); // Devrait être 100 + 0.5 = 100.5
}
console.log('');

// Test 6: Priorité des opérateurs avec %
const test6 = '10*5%';
const parse6 = parseFormula(test6);
console.log(`Test 6: ${test6}`);
console.log('Parse result:', parse6);
if (parse6.success && parse6.ast) {
  const result6 = evaluateFormula(parse6.ast, {});
  console.log('Result:', result6.value); // Devrait être 10 * 0.05 = 0.5
}
console.log('');

console.log('=== Tests terminés ===');
