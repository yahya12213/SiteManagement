/**
 * Migration 085: Add document_type and printer tracking to certificates
 *
 * Purpose: Enable document tracking and QZ Tray printer integration
 *
 * Changes:
 * - Add document_type column to certificates table
 * - Add template_name column for reference
 * - Add printed_at, printer_name, print_status columns for print tracking
 * - Add indexes for performance
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 085: Document Tracking & Printer Integration ===\n');

    // 1. Add document_type column
    console.log('Step 1: Adding document_type column to certificates table...');

    const checkDocumentType = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'document_type'
    `);

    if (checkDocumentType.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN document_type VARCHAR(50) DEFAULT 'certificat'
      `);
      console.log('✓ Added document_type column');
    } else {
      console.log('⚠ document_type column already exists');
    }

    // 2. Add template_name column
    console.log('\nStep 2: Adding template_name column...');

    const checkTemplateName = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'template_name'
    `);

    if (checkTemplateName.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN template_name TEXT
      `);
      console.log('✓ Added template_name column');
    } else {
      console.log('⚠ template_name column already exists');
    }

    // 3. Add printed_at column
    console.log('\nStep 3: Adding printed_at column...');

    const checkPrintedAt = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'printed_at'
    `);

    if (checkPrintedAt.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN printed_at TIMESTAMP
      `);
      console.log('✓ Added printed_at column');
    } else {
      console.log('⚠ printed_at column already exists');
    }

    // 4. Add printer_name column
    console.log('\nStep 4: Adding printer_name column...');

    const checkPrinterName = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'printer_name'
    `);

    if (checkPrinterName.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN printer_name TEXT
      `);
      console.log('✓ Added printer_name column');
    } else {
      console.log('⚠ printer_name column already exists');
    }

    // 5. Add print_status column
    console.log('\nStep 5: Adding print_status column...');

    const checkPrintStatus = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'print_status'
    `);

    if (checkPrintStatus.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD COLUMN print_status VARCHAR(50) DEFAULT 'not_printed'
      `);
      console.log('✓ Added print_status column (values: not_printed, printing, printed, print_failed)');
    } else {
      console.log('⚠ print_status column already exists');
    }

    // 6. Create indexes for performance
    console.log('\nStep 6: Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_certificates_document_type ON certificates(document_type)
    `);
    console.log('✓ Index on document_type created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_certificates_print_status ON certificates(print_status)
    `);
    console.log('✓ Index on print_status created');

    await client.query('COMMIT');

    console.log('\n=== Migration 085 completed successfully! ===');
    console.log('\n📋 Summary:');
    console.log('  - Added document_type column (default: "certificat")');
    console.log('  - Added template_name column for template reference');
    console.log('  - Added printed_at column for print timestamp');
    console.log('  - Added printer_name column for printer tracking');
    console.log('  - Added print_status column (not_printed, printing, printed, print_failed)');
    console.log('  - Created indexes for performance optimization');
    console.log('\n✅ Document tracking system ready for use!');
    console.log('✅ Ready for QZ Tray integration!\n');

    res.json({
      success: true,
      message: 'Document tracking and printer columns added successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 085 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Check if all columns exist
    const checkColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificates'
        AND column_name IN ('document_type', 'template_name', 'printed_at', 'printer_name', 'print_status')
    `);

    const columnsExist = checkColumns.rows.length === 5;

    res.json({
      status: {
        migrationNeeded: !columnsExist,
        applied: columnsExist,
        columnsFound: checkColumns.rows.length,
        columnsExpected: 5
      },
      message: columnsExist
        ? 'Document tracking columns exist in certificates table'
        : `Document tracking columns missing - found ${checkColumns.rows.length}/5 columns, run migration to add them`
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
