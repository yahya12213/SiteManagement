/**
 * Frontend Permission Scanner
 *
 * Scans all .tsx files in the frontend to detect:
 * - Unprotected routes
 * - Unprotected buttons/actions
 * - Permission usage patterns
 * - Security issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root (3 levels up from server/src/utils)
const projectRoot = path.resolve(__dirname, '../../..');
const srcDir = path.join(projectRoot, 'src');

/**
 * Recursively scan directory for .tsx files
 */
function scanDirectory(dirPath, fileList = []) {
  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and dist folders
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
          scanDirectory(filePath, fileList);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        fileList.push(filePath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dirPath}:`, error.message);
  }

  return fileList;
}

/**
 * Parse a single file and extract information
 */
function parseFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    return ast;
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract routes from AST
 */
function extractRoutes(ast, filePath) {
  const routes = [];
  const relativePath = path.relative(projectRoot, filePath);

  if (!ast) return routes;

  try {
    traverse.default(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const elementName = openingElement.name.name;

        // Check if this is a <Route> component
        if (elementName === 'Route') {
          const pathAttr = openingElement.attributes.find(
            attr => attr.name && attr.name.name === 'path'
          );

          const elementAttr = openingElement.attributes.find(
            attr => attr.name && attr.name.name === 'element'
          );

          if (pathAttr && elementAttr) {
            const routePath = pathAttr.value.value;
            const lineNumber = openingElement.loc.start.line;

            // Check if wrapped in ProtectedRoute
            let hasProtection = false;
            let permission = null;

            // Check the element attribute for ProtectedRoute
            if (elementAttr.value && elementAttr.value.expression) {
              const elementExpr = elementAttr.value.expression;

              if (elementExpr.type === 'JSXElement') {
                const elementName = elementExpr.openingElement.name.name;

                if (elementName === 'ProtectedRoute') {
                  hasProtection = true;

                  // Extract permission
                  const permAttr = elementExpr.openingElement.attributes.find(
                    attr => attr.name && attr.name.name === 'requirePermission'
                  );

                  if (permAttr && permAttr.value) {
                    permission = permAttr.value.value || permAttr.value.expression?.value;
                  }
                }
              }
            }

            routes.push({
              path: routePath,
              file: relativePath,
              line: lineNumber,
              hasProtection,
              permission
            });
          }
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Error traversing ${relativePath}:`, error.message);
  }

  return routes;
}

/**
 * Extract buttons and action handlers from AST
 */
function extractButtons(ast, filePath) {
  const buttons = [];
  const relativePath = path.relative(projectRoot, filePath);

  if (!ast) return buttons;

  try {
    traverse.default(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const elementName = openingElement.name.name || openingElement.name.property?.name;

        // Check for button elements or Button components (including ProtectedButton)
        if (elementName === 'button' || elementName === 'Button' || elementName === 'ProtectedButton') {
          // ProtectedButton is always protected
          if (elementName === 'ProtectedButton') {
            buttons.push({
              file: relativePath,
              line: openingElement.loc.start.line,
              element: elementName,
              handler: 'onClick',
              hasProtection: true
            });
            return; // Skip further processing
          }
          const onClickAttr = openingElement.attributes.find(
            attr => attr.name && ['onClick', 'onSubmit', 'onDelete'].includes(attr.name.name)
          );

          if (onClickAttr) {
            const lineNumber = openingElement.loc.start.line;

            // Try to determine if there's permission protection
            let hasProtection = false;

            // Check if parent is conditional with hasPermission
            let parentPath = path.parentPath;
            let checkDepth = 0;

            while (parentPath && checkDepth < 5) {
              // Check for ConditionalExpression or LogicalExpression with permission patterns
              if (parentPath.node.type === 'ConditionalExpression' ||
                  parentPath.node.type === 'LogicalExpression') {
                const code = filePath ? fs.readFileSync(filePath, 'utf-8') : '';
                const lines = code.split('\n');
                const contextStart = Math.max(0, lineNumber - 3);
                const contextEnd = Math.min(lines.length, lineNumber + 1);
                const context = lines.slice(contextStart, contextEnd).join('\n');

                // Multiple protection patterns to detect
                const protectionPatterns = [
                  /hasPermission/,                          // hasPermission('...')
                  /usePermission/,                          // usePermission() nearby
                  /\.(can[A-Z]\w*)\s*&&/,                   // accounting.canCreate &&
                  /\b(can[A-Z]\w*)\s*&&/,                   // canCreate &&
                  /\.(can[A-Z]\w*)\s*\?/,                   // accounting.canCreate ?
                  /\b(can[A-Z]\w*)\s*\?/,                   // canCreate ?
                ];

                if (protectionPatterns.some(pattern => pattern.test(context))) {
                  hasProtection = true;
                  break;
                }
              }

              parentPath = parentPath.parentPath;
              checkDepth++;
            }

            buttons.push({
              file: relativePath,
              line: lineNumber,
              element: elementName,
              handler: onClickAttr.name.name,
              hasProtection
            });
          }
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Error extracting buttons from ${relativePath}:`, error.message);
  }

  return buttons;
}

/**
 * Extract all permission usages from AST
 */
function extractPermissionUsages(ast, filePath) {
  const permissions = new Set();

  if (!ast) return permissions;

  try {
    traverse.default(ast, {
      // Look for string literals that match permission pattern
      StringLiteral(path) {
        const value = path.node.value;

        // Permission pattern: module.resource.action
        if (value && /^[a-z_]+\.[a-z_]+\.[a-z_]+$/.test(value)) {
          permissions.add(value);
        }
      },

      // Look for hasPermission('...') calls
      CallExpression(path) {
        const callee = path.node.callee;

        if (callee.name === 'hasPermission' ||
            callee.name === 'usePermission' ||
            callee.name === 'requirePermission') {

          const arg = path.node.arguments[0];
          if (arg && arg.type === 'StringLiteral') {
            permissions.add(arg.value);
          }
        }
      },

      // Look for JSX attributes with permissions
      JSXAttribute(path) {
        if (path.node.name.name === 'requirePermission' ||
            path.node.name.name === 'permission') {

          const value = path.node.value;
          if (value && value.type === 'StringLiteral') {
            permissions.add(value.value);
          } else if (value && value.expression && value.expression.type === 'StringLiteral') {
            permissions.add(value.expression.value);
          }
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Error extracting permissions:`, error.message);
  }

  return Array.from(permissions);
}

/**
 * Categorize issues by severity
 */
function categorizeIssues(routes, buttons) {
  const issues = [];

  // Unprotected routes are CRITICAL
  const unprotectedRoutes = routes.filter(r => !r.hasProtection);
  for (const route of unprotectedRoutes) {
    // Skip public routes
    if (!route.path.startsWith('/admin') &&
        !route.path.includes('manage') &&
        !route.path.includes('edit')) {
      continue;
    }

    issues.push({
      type: 'UNPROTECTED_ROUTE',
      severity: 'CRITICAL',
      file: route.file,
      path: route.path,
      line: route.line,
      recommendation: 'Wrap route element with <ProtectedRoute requirePermission="...">'
    });
  }

  // Unprotected buttons in admin pages are HIGH
  const unprotectedButtons = buttons.filter(b => !b.hasProtection);
  for (const button of unprotectedButtons) {
    // Only flag buttons in admin pages
    if (!button.file.includes('/admin/') && !button.file.includes('Management')) {
      continue;
    }

    // Skip certain safe handlers
    if (['onClose', 'onCancel', 'onBack'].includes(button.handler)) {
      continue;
    }

    issues.push({
      type: 'UNPROTECTED_BUTTON',
      severity: 'HIGH',
      file: button.file,
      handler: button.handler,
      line: button.line,
      recommendation: `Wrap button in conditional: {hasPermission('...') && <${button.element}>}`
    });
  }

  return issues;
}

/**
 * Main scan function
 */
export async function scan() {
  console.log('🔍 Starting frontend permission scan...');
  console.log(`📁 Scanning directory: ${srcDir}`);

  const startTime = Date.now();

  // Scan all files
  const files = scanDirectory(srcDir);
  console.log(`📄 Found ${files.length} TypeScript/React files`);

  const allRoutes = [];
  const allButtons = [];
  const allPermissions = new Set();

  // Parse each file
  for (const file of files) {
    const ast = parseFile(file);
    if (!ast) continue;

    const routes = extractRoutes(ast, file);
    const buttons = extractButtons(ast, file);
    const permissions = extractPermissionUsages(ast, file);

    allRoutes.push(...routes);
    allButtons.push(...buttons);
    permissions.forEach(p => allPermissions.add(p));
  }

  // Categorize issues
  const issues = categorizeIssues(allRoutes, allButtons);

  const duration = Date.now() - startTime;
  console.log(`✅ Scan completed in ${duration}ms`);
  console.log(`   - Routes: ${allRoutes.length} (${allRoutes.filter(r => !r.hasProtection).length} unprotected)`);
  console.log(`   - Buttons: ${allButtons.length} (${allButtons.filter(b => !b.hasProtection).length} unprotected)`);
  console.log(`   - Permissions found: ${allPermissions.size}`);
  console.log(`   - Issues detected: ${issues.length}`);

  return {
    scannedFiles: files.length,
    scanDuration: duration,
    routes: {
      total: allRoutes.length,
      protected: allRoutes.filter(r => r.hasProtection).length,
      unprotected: allRoutes.filter(r => !r.hasProtection).length,
      list: allRoutes
    },
    buttons: {
      total: allButtons.length,
      protected: allButtons.filter(b => b.hasProtection).length,
      unprotected: allButtons.filter(b => !b.hasProtection).length,
      list: allButtons
    },
    permissionsUsed: Array.from(allPermissions),
    issues
  };
}

export default { scan };
