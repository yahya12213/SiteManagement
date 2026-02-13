#!/usr/bin/env node

/**
 * Script d'audit des permissions
 *
 * Ce script analyse statiquement tous les fichiers de routes pour identifier :
 * 1. Routes sans authentification
 * 2. Routes avec authenticateToken mais sans vérification de permission
 * 3. Routes protégées correctement
 *
 * IMPORTANT : Ce script est en lecture seule et ne modifie AUCUN fichier
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Statistiques globales
const stats = {
  totalRoutes: 0,
  protectedRoutes: 0,
  authenticatedOnlyRoutes: 0,
  publicRoutes: 0,
  unprotectedRoutes: [],
  protectedRoutesList: [],
  filesScanned: 0
};

// Patterns à rechercher
const ROUTE_PATTERN = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const AUTH_PATTERN = /authenticateToken/;
const PERMISSION_PATTERN = /requirePermission|checkPermission|checkAnyPermission/;

// Pattern pour détecter multiline route definitions
const ROUTE_FULL_PATTERN = /router\.(get|post|put|delete|patch)\s*\([^)]*\)/gs;

/**
 * Scanner un fichier de routes
 */
function scanRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  stats.filesScanned++;

  // Extraire toutes les définitions de routes
  const lines = content.split('\n');
  let currentRouteInfo = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);

    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const routePath = routeMatch[2];

      // Capturer tout le bloc de définition de route (jusqu'à trouver "async" ou "function")
      let routeBlock = '';
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        routeBlock += lines[j] + '\n';
        if (lines[j].includes('async') || lines[j].includes('function') || lines[j].includes('=>')) {
          break;
        }
      }

      const hasAuth = AUTH_PATTERN.test(routeBlock);
      const hasPermission = PERMISSION_PATTERN.test(routeBlock);

      const route = {
        method,
        path: routePath,
        file: fileName,
        line: i + 1,
        hasAuth,
        hasPermission
      };

      stats.totalRoutes++;

      if (hasAuth && hasPermission) {
        stats.protectedRoutes++;
        stats.protectedRoutesList.push(route);
      } else if (hasAuth && !hasPermission) {
        stats.authenticatedOnlyRoutes++;
        stats.unprotectedRoutes.push({
          ...route,
          issue: 'AUTHENTICATED_ONLY',
          severity: 'MEDIUM',
          message: 'Route authentifiée mais sans vérification de permission'
        });
      } else {
        stats.publicRoutes++;

        // Vérifier si c'est intentionnel (routes de login, health check, etc.)
        const isIntentional =
          routePath.includes('/login') ||
          routePath.includes('/register') ||
          routePath.includes('/health') ||
          routePath.includes('/ping') ||
          method === 'OPTIONS';

        if (!isIntentional) {
          stats.unprotectedRoutes.push({
            ...route,
            issue: 'NO_AUTHENTICATION',
            severity: 'CRITICAL',
            message: 'Route publique sans authentification'
          });
        }
      }
    }
  }
}

/**
 * Scanner récursivement le dossier des routes
 */
function scanRoutesDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanRoutesDirectory(filePath);
    } else if (file.endsWith('.js') && !file.includes('.test.') && !file.includes('migration-')) {
      try {
        scanRouteFile(filePath);
      } catch (error) {
        console.error(`Erreur lors de l'analyse de ${file}:`, error.message);
      }
    }
  }
}

/**
 * Afficher le rapport
 */
function displayReport() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         RAPPORT D\'AUDIT DES PERMISSIONS                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('📊 STATISTIQUES GLOBALES');
  console.log('═'.repeat(60));
  console.log(`Fichiers scannés            : ${stats.filesScanned}`);
  console.log(`Routes totales détectées    : ${stats.totalRoutes}`);
  console.log(`✅ Routes protégées         : ${stats.protectedRoutes} (${Math.round(stats.protectedRoutes/stats.totalRoutes*100)}%)`);
  console.log(`🟡 Routes authentifiées     : ${stats.authenticatedOnlyRoutes} (${Math.round(stats.authenticatedOnlyRoutes/stats.totalRoutes*100)}%)`);
  console.log(`🔴 Routes publiques         : ${stats.publicRoutes} (${Math.round(stats.publicRoutes/stats.totalRoutes*100)}%)`);

  // Routes problématiques
  if (stats.unprotectedRoutes.length > 0) {
    console.log('\n\n🚨 ROUTES NON PROTÉGÉES DÉTECTÉES');
    console.log('═'.repeat(60));

    // Grouper par sévérité
    const critical = stats.unprotectedRoutes.filter(r => r.severity === 'CRITICAL');
    const medium = stats.unprotectedRoutes.filter(r => r.severity === 'MEDIUM');

    if (critical.length > 0) {
      console.log(`\n🔴 CRITIQUE (${critical.length} routes)`);
      console.log('─'.repeat(60));
      critical.forEach(route => {
        console.log(`\n  ${route.method} ${route.path}`);
        console.log(`  📁 Fichier: ${route.file}:${route.line}`);
        console.log(`  ⚠️  ${route.message}`);
      });
    }

    if (medium.length > 0) {
      console.log(`\n\n🟡 MOYEN (${medium.length} routes)`);
      console.log('─'.repeat(60));
      medium.forEach(route => {
        console.log(`\n  ${route.method} ${route.path}`);
        console.log(`  📁 Fichier: ${route.file}:${route.line}`);
        console.log(`  ⚠️  ${route.message}`);
      });
    }
  } else {
    console.log('\n\n✅ AUCUNE ROUTE NON PROTÉGÉE DÉTECTÉE');
  }

  // Recommandations
  console.log('\n\n💡 RECOMMANDATIONS');
  console.log('═'.repeat(60));

  if (critical && critical.length > 0) {
    console.log('🔴 ACTIONS IMMÉDIATES REQUISES:');
    console.log('   • Ajouter authenticateToken aux routes publiques non intentionnelles');
    console.log('   • Vérifier si ces routes doivent vraiment être publiques');
  }

  if (medium && medium.length > 0) {
    console.log('🟡 ACTIONS RECOMMANDÉES:');
    console.log('   • Ajouter requirePermission() aux routes authentifiées');
    console.log('   • Définir les permissions appropriées pour chaque route');
  }

  console.log('\n✅ BONNES PRATIQUES:');
  console.log('   • Toujours utiliser authenticateToken pour les routes privées');
  console.log('   • Ajouter requirePermission() pour le contrôle d\'accès granulaire');
  console.log('   • Documenter les routes intentionnellement publiques');

  // Score de sécurité
  const securityScore = Math.round((stats.protectedRoutes / stats.totalRoutes) * 100);
  console.log('\n\n📈 SCORE DE SÉCURITÉ');
  console.log('═'.repeat(60));

  let scoreEmoji = '🔴';
  let scoreLabel = 'CRITIQUE';

  if (securityScore >= 90) {
    scoreEmoji = '🟢';
    scoreLabel = 'EXCELLENT';
  } else if (securityScore >= 70) {
    scoreEmoji = '🟡';
    scoreLabel = 'BON';
  } else if (securityScore >= 50) {
    scoreEmoji = '🟠';
    scoreLabel = 'MOYEN';
  }

  console.log(`${scoreEmoji} ${securityScore}% - ${scoreLabel}`);

  if (securityScore < 90) {
    console.log(`\n   Objectif recommandé: 90% de routes protégées`);
    console.log(`   Routes à corriger: ${Math.ceil((90 - securityScore) / 100 * stats.totalRoutes)}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Audit terminé - ' + new Date().toLocaleString());
  console.log('═'.repeat(60) + '\n');
}

/**
 * Point d'entrée principal
 */
function main() {
  const routesDir = path.join(__dirname, '..', 'src', 'routes');

  console.log('🔍 Démarrage de l\'audit des permissions...\n');
  console.log(`📁 Analyse du dossier: ${routesDir}\n`);

  if (!fs.existsSync(routesDir)) {
    console.error('❌ Erreur: Le dossier des routes n\'existe pas');
    process.exit(1);
  }

  scanRoutesDirectory(routesDir);
  displayReport();

  // Code de sortie basé sur la sévérité
  if (critical && critical.length > 0) {
    process.exit(1); // Problèmes critiques trouvés
  } else if (medium && medium.length > 0) {
    process.exit(0); // Avertissements seulement
  } else {
    process.exit(0); // Tout est OK
  }
}

// Définir critical et medium en dehors de displayReport
let critical = [];
let medium = [];

// Exécuter
main();
