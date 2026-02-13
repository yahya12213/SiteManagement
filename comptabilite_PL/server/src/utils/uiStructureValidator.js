/**
 * UI Structure Validator
 *
 * Validates that the UI structure (Sidebar menu) aligns with:
 * - PERMISSIONS_MASTER definitions
 * - Actual page implementations
 * - Permission usage in components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { PERMISSIONS_MASTER } from '../config/permissions-master.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');
const sidebarPath = path.join(projectRoot, 'src', 'components', 'layout', 'Sidebar.tsx');
const pagesDir = path.join(projectRoot, 'src', 'pages');

/**
 * Parse the Sidebar component to extract menu structure
 */
function parseSidebar() {
  try {
    const code = fs.readFileSync(sidebarPath, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const menuItems = [];
    let currentSection = null;

    traverse.default(ast, {
      // Look for NavLink components (menu items)
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const elementName = openingElement.name.name || openingElement.name.property?.name;

        if (elementName === 'NavLink') {
          const toAttr = openingElement.attributes.find(
            attr => attr.name && attr.name.name === 'to'
          );

          if (toAttr && toAttr.value) {
            const linkPath = toAttr.value.value;
            const lineNumber = openingElement.loc.start.line;

            // Extract label from children
            let label = 'Unknown';
            if (path.node.children) {
              for (const child of path.node.children) {
                if (child.type === 'JSXText') {
                  label = child.value.trim();
                  break;
                } else if (child.type === 'JSXElement') {
                  // Look for text in nested elements
                  const textNode = child.children?.find(c => c.type === 'JSXText');
                  if (textNode) {
                    label = textNode.value.trim();
                    break;
                  }
                }
              }
            }

            // Try to infer permission from the path
            const permission = inferPermissionFromPath(linkPath);

            menuItems.push({
              label,
              path: linkPath,
              permission,
              line: lineNumber,
              section: currentSection
            });
          }
        }

        // Detect section headers
        if (elementName === 'h3' || elementName === 'div') {
          const className = openingElement.attributes.find(
            attr => attr.name && attr.name.name === 'className'
          );

          if (className && className.value && className.value.value?.includes('section')) {
            const textNode = path.node.children?.find(c => c.type === 'JSXText');
            if (textNode) {
              currentSection = textNode.value.trim();
            }
          }
        }
      }
    });

    return menuItems;
  } catch (error) {
    console.warn(`Warning: Could not parse Sidebar:`, error.message);
    return [];
  }
}

/**
 * Infer permission from URL path
 * /admin/formations -> training.formations.view_page
 * /admin/users -> system.users.view_page
 */
function inferPermissionFromPath(urlPath) {
  // Remove /admin prefix and leading/trailing slashes
  const cleanPath = urlPath.replace(/^\/admin\//, '').replace(/\/$/, '');

  // Special cases
  const pathMap = {
    'dashboard': 'accounting.dashboard.view_page',
    'calculation-sheets': 'accounting.calculation_sheets.view_page',
    'declarations': 'accounting.declarations.view_page',
    'formations': 'training.formations.view_page',
    'sessions': 'training.sessions.view_page',
    'students': 'training.students.view_page',
    'certificates': 'training.certificates.view_page',
    'users': 'system.users.view_page',
    'roles': 'system.roles.view_page',
    'permissions-diagnostic': 'system.roles.view_page'
  };

  if (pathMap[cleanPath]) {
    return pathMap[cleanPath];
  }

  // Try to build permission code
  const parts = cleanPath.split('-');
  const resource = parts.join('_');

  // Guess module based on resource
  let module = 'system';
  if (['formations', 'sessions', 'students', 'certificates', 'corps_formation'].includes(resource)) {
    module = 'training';
  } else if (['calculation_sheets', 'declarations', 'dashboard'].includes(resource)) {
    module = 'accounting';
  }

  return `${module}.${resource}.view_page`;
}

/**
 * Check if page file exists for a given path
 */
function checkPageExists(urlPath) {
  // Convert URL path to file path
  // /admin/formations -> src/pages/admin/FormationsManagement.tsx (or similar)

  const cleanPath = urlPath.replace(/^\/admin\//, '').replace(/\/$/, '');

  // Try common naming patterns
  const patterns = [
    path.join(pagesDir, 'admin', `${cleanPath}.tsx`),
    path.join(pagesDir, 'admin', cleanPath, 'index.tsx'),
    path.join(pagesDir, 'admin', `${cleanPath}Management.tsx`),
    path.join(pagesDir, 'admin', toPascalCase(cleanPath) + '.tsx'),
    path.join(pagesDir, 'admin', toPascalCase(cleanPath) + 'Management.tsx')
  ];

  for (const pattern of patterns) {
    if (fs.existsSync(pattern)) {
      return {
        exists: true,
        file: path.relative(projectRoot, pattern)
      };
    }
  }

  return {
    exists: false,
    file: null
  };
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Check if a page uses the correct permission
 */
function checkPagePermission(filePath, expectedPermission) {
  try {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return { correct: false, actualPermission: null };
    }

    const code = fs.readFileSync(fullPath, 'utf-8');

    // Look for requirePermission in the code
    const permissionMatch = code.match(/requirePermission=["']([^"']+)["']/);
    if (permissionMatch) {
      const actualPermission = permissionMatch[1];
      return {
        correct: actualPermission === expectedPermission,
        actualPermission
      };
    }

    // If no explicit permission found, assume it's correct (might be in parent route)
    return { correct: true, actualPermission: null };
  } catch (error) {
    return { correct: false, actualPermission: null };
  }
}

/**
 * Build menu tree structure
 */
function buildMenuTree(menuItems) {
  const tree = {};

  for (const item of menuItems) {
    const section = item.section || 'Other';

    if (!tree[section]) {
      tree[section] = {
        permission: null,
        items: []
      };
    }

    const pageCheck = checkPageExists(item.path);
    const permissionCheck = pageCheck.exists
      ? checkPagePermission(pageCheck.file, item.permission)
      : { correct: false, actualPermission: null };

    tree[section].items.push({
      label: item.label,
      path: item.path,
      permission: item.permission,
      pageExists: pageCheck.exists,
      pageFile: pageCheck.file,
      pageUsesCorrectPermission: permissionCheck.correct,
      actualPermission: permissionCheck.actualPermission,
      line: item.line
    });
  }

  return tree;
}

/**
 * Validate menu items against PERMISSIONS_MASTER
 */
function validateAgainstMaster(menuItems) {
  const issues = [];
  const permissionCodes = PERMISSIONS_MASTER.map(p => p.code);

  for (const item of menuItems) {
    const pageCheck = checkPageExists(item.path);

    // Check if permission exists in PERMISSIONS_MASTER
    if (item.permission && !permissionCodes.includes(item.permission)) {
      issues.push({
        type: 'PERMISSION_NOT_IN_MASTER',
        severity: 'HIGH',
        menu: item.label,
        path: item.path,
        permission: item.permission,
        recommendation: `Add "${item.permission}" to PERMISSIONS_MASTER or correct the menu item`
      });
    }

    // Check if page exists
    if (!pageCheck.exists) {
      issues.push({
        type: 'MENU_WITHOUT_PAGE',
        severity: 'MEDIUM',
        menu: item.label,
        path: item.path,
        recommendation: `Create page at ${item.path} or remove menu item`
      });
    } else {
      // Check permission mismatch
      const permissionCheck = checkPagePermission(pageCheck.file, item.permission);
      if (!permissionCheck.correct && permissionCheck.actualPermission) {
        issues.push({
          type: 'PERMISSION_MISMATCH',
          severity: 'HIGH',
          menu: item.label,
          menuPermission: item.permission,
          pagePermission: permissionCheck.actualPermission,
          file: pageCheck.file,
          recommendation: `Align permissions: menu expects "${item.permission}" but page uses "${permissionCheck.actualPermission}"`
        });
      }
    }
  }

  return issues;
}

/**
 * Main validation function
 */
export async function validate() {
  console.log('🔍 Starting UI structure validation...');

  const startTime = Date.now();

  // Parse sidebar
  const menuItems = parseSidebar();
  console.log(`📋 Found ${menuItems.length} menu items`);

  // Build menu tree
  const menuStructure = buildMenuTree(menuItems);

  // Validate against PERMISSIONS_MASTER
  const issues = validateAgainstMaster(menuItems);

  const duration = Date.now() - startTime;
  console.log(`✅ Validation completed in ${duration}ms`);
  console.log(`   - Menu items: ${menuItems.length}`);
  console.log(`   - Issues detected: ${issues.length}`);

  return {
    menuStructure,
    menuItems: menuItems.length,
    validMenuItems: menuItems.filter(item => {
      const pageCheck = checkPageExists(item.path);
      return pageCheck.exists;
    }).length,
    invalidMenuItems: menuItems.filter(item => {
      const pageCheck = checkPageExists(item.path);
      return !pageCheck.exists;
    }).length,
    issues
  };
}

export default { validate };
