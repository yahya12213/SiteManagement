/**
 * Debug route to inspect dateFormat in templates
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/debug-template-dateformat/:templateId
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;

    const result = await pool.query(
      'SELECT id, name, template_config FROM certificate_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];
    const config = template.template_config;

    // Find all elements with date variables
    const dateElements = [];

    if (config.pages) {
      config.pages.forEach((page, pageIndex) => {
        if (page.elements) {
          page.elements.forEach((el) => {
            if (el.type === 'text' && el.content && (
              el.content.includes('{session_date_debut}') ||
              el.content.includes('{session_date_fin}') ||
              el.content.includes('{completion_date}') ||
              el.content.includes('{issued_date}') ||
              el.content.includes('{student_birth_date}')
            )) {
              dateElements.push({
                pageIndex,
                pageName: page.name,
                elementId: el.id,
                content: el.content,
                dateFormat: el.dateFormat || 'NOT SET',
                allProperties: Object.keys(el)
              });
            }
          });
        }
      });
    }

    // Also check legacy elements array
    if (config.elements) {
      config.elements.forEach((el) => {
        if (el.type === 'text' && el.content && (
          el.content.includes('{session_date_debut}') ||
          el.content.includes('{session_date_fin}') ||
          el.content.includes('{completion_date}') ||
          el.content.includes('{issued_date}') ||
          el.content.includes('{student_birth_date}')
        )) {
          dateElements.push({
            location: 'legacy elements array',
            elementId: el.id,
            content: el.content,
            dateFormat: el.dateFormat || 'NOT SET',
            allProperties: Object.keys(el)
          });
        }
      });
    }

    res.json({
      templateId: template.id,
      templateName: template.name,
      dateElementsFound: dateElements.length,
      dateElements,
      hasPages: !!config.pages,
      pagesCount: config.pages?.length || 0
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug-template-dateformat/fix-all/status - Check if dateFormat fix is needed
router.get('/fix-all/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, template_config FROM certificate_templates');

    let templatesNeedingFix = 0;
    let elementsNeedingFix = 0;

    for (const template of result.rows) {
      const config = template.template_config;
      let needsFix = false;

      // Check pages
      if (config.pages) {
        config.pages.forEach((page) => {
          if (page.elements) {
            page.elements.forEach((el) => {
              if (el.type === 'text' && el.content && (
                el.content.includes('{session_date_debut}') ||
                el.content.includes('{session_date_fin}') ||
                el.content.includes('{completion_date}') ||
                el.content.includes('{issued_date}') ||
                el.content.includes('{student_birth_date}')
              )) {
                if (!el.dateFormat || el.dateFormat === 'numeric') {
                  needsFix = true;
                  elementsNeedingFix++;
                }
              }
            });
          }
        });
      }

      // Check legacy elements
      if (config.elements) {
        config.elements.forEach((el) => {
          if (el.type === 'text' && el.content && (
            el.content.includes('{session_date_debut}') ||
            el.content.includes('{session_date_fin}') ||
            el.content.includes('{completion_date}') ||
            el.content.includes('{issued_date}') ||
            el.content.includes('{student_birth_date}')
          )) {
            if (!el.dateFormat || el.dateFormat === 'numeric') {
              needsFix = true;
              elementsNeedingFix++;
            }
          }
        });
      }

      if (needsFix) {
        templatesNeedingFix++;
      }
    }

    const needsMigration = elementsNeedingFix > 0;

    res.json({
      applied: !needsMigration,
      status: { migrationNeeded: needsMigration },
      message: needsMigration
        ? `${elementsNeedingFix} élément(s) de date dans ${templatesNeedingFix} template(s) n'ont pas le format "En lettres"`
        : 'Tous les templates ont le format de date "En lettres" appliqué'
    });

  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      applied: false,
      status: { migrationNeeded: true },
      message: error.message
    });
  }
});

// GET /api/debug-template-dateformat - List all templates with date elements
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM certificate_templates ORDER BY name'
    );

    res.json({
      templates: result.rows,
      usage: 'GET /api/debug-template-dateformat/:templateId to inspect a specific template'
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/debug-template-dateformat/:templateId/fix
// Fix dateFormat for all date elements in a template
router.post('/:templateId/fix', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { dateFormat = 'long' } = req.body; // Default to 'long' (01 Janvier 2026)

    const result = await pool.query(
      'SELECT id, name, template_config FROM certificate_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = result.rows[0];
    const config = template.template_config;
    let fixedCount = 0;

    // Fix all date elements in pages
    if (config.pages) {
      config.pages.forEach((page) => {
        if (page.elements) {
          page.elements.forEach((el) => {
            if (el.type === 'text' && el.content && (
              el.content.includes('{session_date_debut}') ||
              el.content.includes('{session_date_fin}') ||
              el.content.includes('{completion_date}') ||
              el.content.includes('{issued_date}') ||
              el.content.includes('{student_birth_date}')
            )) {
              el.dateFormat = dateFormat;
              fixedCount++;
            }
          });
        }
      });
    }

    // Also fix legacy elements array
    if (config.elements) {
      config.elements.forEach((el) => {
        if (el.type === 'text' && el.content && (
          el.content.includes('{session_date_debut}') ||
          el.content.includes('{session_date_fin}') ||
          el.content.includes('{completion_date}') ||
          el.content.includes('{issued_date}') ||
          el.content.includes('{student_birth_date}')
        )) {
          el.dateFormat = dateFormat;
          fixedCount++;
        }
      });
    }

    // Update the template in database
    await pool.query(
      'UPDATE certificate_templates SET template_config = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), templateId]
    );

    res.json({
      success: true,
      templateId,
      templateName: template.name,
      dateFormat,
      elementsFixed: fixedCount,
      message: `Fixed ${fixedCount} date element(s) with dateFormat="${dateFormat}"`
    });

  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/debug-template-dateformat/fix-all/run
// Run endpoint for MigrationPanel
router.post('/fix-all/run', async (req, res) => {
  try {
    const dateFormat = 'long'; // Default to 'long' (01 Janvier 2026)

    const result = await pool.query('SELECT id, name, template_config FROM certificate_templates');

    let totalFixed = 0;
    const fixedTemplates = [];

    for (const template of result.rows) {
      const config = template.template_config;
      let fixedInTemplate = 0;

      // Fix all date elements in pages
      if (config.pages) {
        config.pages.forEach((page) => {
          if (page.elements) {
            page.elements.forEach((el) => {
              if (el.type === 'text' && el.content && (
                el.content.includes('{session_date_debut}') ||
                el.content.includes('{session_date_fin}') ||
                el.content.includes('{completion_date}') ||
                el.content.includes('{issued_date}') ||
                el.content.includes('{student_birth_date}')
              )) {
                el.dateFormat = dateFormat;
                fixedInTemplate++;
              }
            });
          }
        });
      }

      // Also fix legacy elements array
      if (config.elements) {
        config.elements.forEach((el) => {
          if (el.type === 'text' && el.content && (
            el.content.includes('{session_date_debut}') ||
            el.content.includes('{session_date_fin}') ||
            el.content.includes('{completion_date}') ||
            el.content.includes('{issued_date}') ||
            el.content.includes('{student_birth_date}')
          )) {
            el.dateFormat = dateFormat;
            fixedInTemplate++;
          }
        });
      }

      if (fixedInTemplate > 0) {
        await pool.query(
          'UPDATE certificate_templates SET template_config = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(config), template.id]
        );

        fixedTemplates.push({
          id: template.id,
          name: template.name,
          elementsFixed: fixedInTemplate
        });
        totalFixed += fixedInTemplate;
      }
    }

    res.json({
      success: true,
      details: {
        dateFormat,
        totalElementsFixed: totalFixed,
        templatesModified: fixedTemplates.length,
        templates: fixedTemplates
      }
    });

  } catch (error) {
    console.error('Fix-all run error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/debug-template-dateformat/fix-all
// Fix dateFormat for all templates
router.post('/fix-all', async (req, res) => {
  try {
    const { dateFormat = 'long' } = req.body;

    const result = await pool.query('SELECT id, name, template_config FROM certificate_templates');

    let totalFixed = 0;
    const fixedTemplates = [];

    for (const template of result.rows) {
      const config = template.template_config;
      let fixedInTemplate = 0;

      // Fix all date elements in pages
      if (config.pages) {
        config.pages.forEach((page) => {
          if (page.elements) {
            page.elements.forEach((el) => {
              if (el.type === 'text' && el.content && (
                el.content.includes('{session_date_debut}') ||
                el.content.includes('{session_date_fin}') ||
                el.content.includes('{completion_date}') ||
                el.content.includes('{issued_date}') ||
                el.content.includes('{student_birth_date}')
              )) {
                el.dateFormat = dateFormat;
                fixedInTemplate++;
              }
            });
          }
        });
      }

      // Also fix legacy elements array
      if (config.elements) {
        config.elements.forEach((el) => {
          if (el.type === 'text' && el.content && (
            el.content.includes('{session_date_debut}') ||
            el.content.includes('{session_date_fin}') ||
            el.content.includes('{completion_date}') ||
            el.content.includes('{issued_date}') ||
            el.content.includes('{student_birth_date}')
          )) {
            el.dateFormat = dateFormat;
            fixedInTemplate++;
          }
        });
      }

      if (fixedInTemplate > 0) {
        await pool.query(
          'UPDATE certificate_templates SET template_config = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(config), template.id]
        );

        fixedTemplates.push({
          id: template.id,
          name: template.name,
          elementsFixed: fixedInTemplate
        });
        totalFixed += fixedInTemplate;
      }
    }

    res.json({
      success: true,
      dateFormat,
      totalElementsFixed: totalFixed,
      templatesModified: fixedTemplates.length,
      templates: fixedTemplates
    });

  } catch (error) {
    console.error('Fix-all error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
