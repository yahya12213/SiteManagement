import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper function to build folder tree recursively
 */
function buildFolderTree(folders, parentId = null) {
  return folders
    .filter(folder => folder.parent_id === parentId)
    .map(folder => ({
      ...folder,
      children: buildFolderTree(folders, folder.id),
    }));
}

/**
 * Helper function to check for circular references
 */
async function hasCircularReference(folderId, newParentId) {
  if (!newParentId) return false; // Moving to root is always safe
  if (folderId === newParentId) return true; // Self-reference

  let currentParent = newParentId;
  const visited = new Set([folderId]);

  while (currentParent) {
    if (visited.has(currentParent)) {
      return true; // Circular reference detected
    }
    visited.add(currentParent);

    const result = await pool.query(
      'SELECT parent_id FROM template_folders WHERE id = $1',
      [currentParent]
    );

    if (result.rows.length === 0) break;
    currentParent = result.rows[0].parent_id;
  }

  return false;
}

/**
 * GET /api/template-folders
 * Get all folders as flat list
 * Protected: Authentication only (no permission check)
 * Users need to read folders when creating/editing formations
 */
router.get('/',
  authenticateToken,
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tf.*,
        COUNT(DISTINCT ct.id) as template_count,
        COUNT(DISTINCT child.id) as child_folder_count
      FROM template_folders tf
      LEFT JOIN certificate_templates ct ON ct.folder_id = tf.id
      LEFT JOIN template_folders child ON child.parent_id = tf.id
      GROUP BY tf.id
      ORDER BY tf.name ASC
    `);

    res.json({
      success: true,
      folders: result.rows,
    });
  } catch (error) {
    console.error('Error fetching template folders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/template-folders/tree
 * Get folder hierarchy as tree structure
 * Protected: Authentication only (no permission check)
 * Users need to read folder tree when creating/editing formations
 */
router.get('/tree',
  authenticateToken,
  async (req, res) => {
  try {
    const foldersResult = await pool.query(`
      SELECT
        tf.*,
        COUNT(DISTINCT ct.id) as template_count
      FROM template_folders tf
      LEFT JOIN certificate_templates ct ON ct.folder_id = tf.id
      GROUP BY tf.id
      ORDER BY tf.name ASC
    `);

    const tree = buildFolderTree(foldersResult.rows);

    res.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error('Error fetching template folder tree:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/template-folders/:id
 * Get single folder with details
 * Protected: Authentication only (no permission check)
 * Users need to read folder details when browsing templates
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
  try {
    const { id } = req.params;

    const folderResult = await pool.query(`
      SELECT
        tf.*,
        COUNT(DISTINCT ct.id) as template_count,
        COUNT(DISTINCT child.id) as child_folder_count
      FROM template_folders tf
      LEFT JOIN certificate_templates ct ON ct.folder_id = tf.id
      LEFT JOIN template_folders child ON child.parent_id = tf.id
      WHERE tf.id = $1
      GROUP BY tf.id
    `, [id]);

    if (folderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    // Get templates in this folder
    const templatesResult = await pool.query(
      'SELECT * FROM certificate_templates WHERE folder_id = $1 ORDER BY name ASC',
      [id]
    );

    // Get child folders
    const childrenResult = await pool.query(
      'SELECT * FROM template_folders WHERE parent_id = $1 ORDER BY name ASC',
      [id]
    );

    res.json({
      success: true,
      folder: {
        ...folderResult.rows[0],
        templates: templatesResult.rows,
        children: childrenResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/template-folders
 * Create new folder
 * Protected: Requires training.certificate_templates.create_folder permission
 */
router.post('/',
  authenticateToken,
  requirePermission('training.certificate_templates.create_folder'),
  async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required',
      });
    }

    // Check if parent exists (if provided)
    if (parent_id) {
      const parentExists = await pool.query(
        'SELECT id FROM template_folders WHERE id = $1',
        [parent_id]
      );

      if (parentExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Parent folder not found',
        });
      }
    }

    // Create folder
    const result = await pool.query(
      `INSERT INTO template_folders (name, parent_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), parent_id || null, req.user?.id || null]
    );

    res.status(201).json({
      success: true,
      folder: result.rows[0],
      message: 'Folder created successfully',
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/template-folders/:id
 * Update folder (rename)
 * Protected: Requires training.certificate_templates.rename_folder permission
 */
router.put('/:id',
  authenticateToken,
  requirePermission('training.certificate_templates.rename_folder'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required',
      });
    }

    // Check if folder exists
    const folderExists = await pool.query(
      'SELECT id FROM template_folders WHERE id = $1',
      [id]
    );

    if (folderExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    // Update folder
    const result = await pool.query(
      `UPDATE template_folders
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [name.trim(), id]
    );

    res.json({
      success: true,
      folder: result.rows[0],
      message: 'Folder updated successfully',
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/template-folders/:id
 * Delete folder (only if empty - no templates and no subfolders)
 * Protected: Requires training.certificate_templates.delete_folder permission
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('training.certificate_templates.delete_folder'),
  async (req, res) => {
  try {
    const { id } = req.params;

    // Check if folder exists
    const folderExists = await pool.query(
      'SELECT id, name FROM template_folders WHERE id = $1',
      [id]
    );

    if (folderExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    // Check for templates in folder
    const templatesCount = await pool.query(
      'SELECT COUNT(*) as count FROM certificate_templates WHERE folder_id = $1',
      [id]
    );

    if (parseInt(templatesCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete folder: it contains templates',
        details: {
          template_count: parseInt(templatesCount.rows[0].count),
        },
      });
    }

    // Check for subfolders
    const subfoldersCount = await pool.query(
      'SELECT COUNT(*) as count FROM template_folders WHERE parent_id = $1',
      [id]
    );

    if (parseInt(subfoldersCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete folder: it contains subfolders',
        details: {
          subfolder_count: parseInt(subfoldersCount.rows[0].count),
        },
      });
    }

    // Delete folder
    await pool.query('DELETE FROM template_folders WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Folder deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/template-folders/:id/move
 * Move folder to new parent (change hierarchy)
 * Protected: Requires training.certificate_templates.rename_folder permission
 */
router.post('/:id/move',
  authenticateToken,
  requirePermission('training.certificate_templates.rename_folder'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { new_parent_id } = req.body;

    // Check if folder exists
    const folderExists = await pool.query(
      'SELECT id FROM template_folders WHERE id = $1',
      [id]
    );

    if (folderExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    // Check if new parent exists (if provided)
    if (new_parent_id) {
      const parentExists = await pool.query(
        'SELECT id FROM template_folders WHERE id = $1',
        [new_parent_id]
      );

      if (parentExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'New parent folder not found',
        });
      }
    }

    // Check for circular reference
    const circular = await hasCircularReference(id, new_parent_id);
    if (circular) {
      return res.status(400).json({
        success: false,
        error: 'Cannot move folder: would create circular reference',
      });
    }

    // Move folder
    const result = await pool.query(
      `UPDATE template_folders
       SET parent_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [new_parent_id || null, id]
    );

    res.json({
      success: true,
      folder: result.rows[0],
      message: 'Folder moved successfully',
    });
  } catch (error) {
    console.error('Error moving folder:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
