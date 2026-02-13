import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 024: Seed default certificate templates
 * Creates 3 default certificate templates if none exist
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 024: Seed default certificate templates...');

    // Check if certificate_templates table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'certificate_templates'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⏭️  certificate_templates table does not exist, skipping migration');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 024 skipped: certificate_templates table does not exist'
      });
    }

    // Check if templates already exist
    const existingTemplates = await client.query('SELECT COUNT(*) as count FROM certificate_templates');
    const templateCount = parseInt(existingTemplates.rows[0].count);

    if (templateCount > 0) {
      console.log(`✓ Templates already exist (${templateCount} templates found)`);
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Migration 024 skipped: ${templateCount} templates already exist`,
        templatesCount: templateCount
      });
    }

    console.log('Creating default certificate templates...');

    // Template 1: Classique (traditional with gold/blue borders)
    await client.query(`
      INSERT INTO certificate_templates (id, name, description, html_template, css_styles, default_font_family, default_font_size, paper_size, orientation, created_at, updated_at)
      VALUES (
        'template-classique',
        'Classique',
        'Modèle classique avec bordure dorée et motifs traditionnels',
        '<div class="certificate-container">
  <div class="border-outer">
    <div class="border-inner">
      <div class="header">
        <h1 class="title">CERTIFICAT DE FORMATION</h1>
      </div>
      <div class="content">
        <p class="intro">Ce certificat atteste que</p>
        <h2 class="student-name">{{student_name}}</h2>
        <p class="text">a suivi avec succès la formation</p>
        <h3 class="formation-title">{{formation_title}}</h3>
        <p class="completion">Le {{completion_date}}</p>
        <p class="certificate-number">Certificat N° {{certificate_number}}</p>
      </div>
      <div class="footer">
        <div class="signature">
          <p class="signature-line">_________________</p>
          <p class="signature-label">Directeur de Formation</p>
        </div>
      </div>
    </div>
  </div>
</div>',
        'body { margin: 0; padding: 40px; font-family: "Georgia", serif; }
.certificate-container { width: 100%; height: 100%; position: relative; }
.border-outer { border: 8px solid #DAA520; padding: 20px; height: 100%; box-sizing: border-box; }
.border-inner { border: 2px solid #1E3A8A; padding: 40px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
.header { text-align: center; margin-bottom: 40px; }
.title { font-size: 36px; color: #1E3A8A; margin: 0; font-weight: bold; letter-spacing: 2px; }
.content { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.intro { font-size: 18px; color: #4B5563; margin: 0 0 20px 0; }
.student-name { font-size: 42px; color: #000; margin: 20px 0; font-weight: bold; }
.text { font-size: 18px; color: #4B5563; margin: 20px 0; }
.formation-title { font-size: 28px; color: #1E3A8A; margin: 20px 0; font-weight: bold; }
.completion { font-size: 16px; color: #6B7280; margin: 30px 0 10px 0; }
.certificate-number { font-size: 14px; color: #9CA3AF; margin: 10px 0; }
.footer { margin-top: 40px; }
.signature { text-align: center; }
.signature-line { font-size: 18px; margin: 40px 0 10px 0; }
.signature-label { font-size: 14px; color: #6B7280; margin: 0; }',
        'Georgia, serif',
        16,
        'A4',
        'landscape',
        NOW(),
        NOW()
      )
    `);
    console.log('✓ Template "Classique" created');

    // Template 2: Moderne (minimalist professional)
    await client.query(`
      INSERT INTO certificate_templates (id, name, description, html_template, css_styles, default_font_family, default_font_size, paper_size, orientation, created_at, updated_at)
      VALUES (
        'template-moderne',
        'Moderne',
        'Design minimaliste et professionnel',
        '<div class="certificate-modern">
  <div class="top-bar"></div>
  <div class="content-wrapper">
    <div class="logo-section">
      <div class="logo-placeholder">LOGO</div>
    </div>
    <div class="main-content">
      <h1 class="main-title">Certificate of Completion</h1>
      <div class="divider"></div>
      <p class="presented-to">This is to certify that</p>
      <h2 class="recipient-name">{{student_name}}</h2>
      <p class="achievement">has successfully completed</p>
      <h3 class="course-name">{{formation_title}}</h3>
      <div class="details">
        <p class="completion-date">Completed on {{completion_date}}</p>
        <p class="cert-number">Certificate No: {{certificate_number}}</p>
      </div>
    </div>
    <div class="signature-section">
      <div class="signature-line"></div>
      <p class="signature-title">Authorized Signature</p>
    </div>
  </div>
</div>',
        'body { margin: 0; padding: 0; font-family: "Helvetica Neue", Arial, sans-serif; }
.certificate-modern { width: 100%; height: 100%; background: #fff; position: relative; }
.top-bar { width: 100%; height: 12px; background: linear-gradient(90deg, #3B82F6 0%, #1D4ED8 100%); }
.content-wrapper { padding: 60px 80px; }
.logo-section { text-align: center; margin-bottom: 40px; }
.logo-placeholder { display: inline-block; padding: 10px 30px; border: 2px solid #3B82F6; color: #3B82F6; font-weight: bold; font-size: 24px; }
.main-content { text-align: center; }
.main-title { font-size: 48px; color: #1F2937; margin: 0 0 20px 0; font-weight: 300; letter-spacing: 1px; }
.divider { width: 80px; height: 3px; background: #3B82F6; margin: 0 auto 40px auto; }
.presented-to { font-size: 16px; color: #6B7280; margin: 0 0 15px 0; }
.recipient-name { font-size: 40px; color: #000; margin: 15px 0 30px 0; font-weight: 600; }
.achievement { font-size: 16px; color: #6B7280; margin: 0 0 15px 0; }
.course-name { font-size: 32px; color: #1F2937; margin: 15px 0 40px 0; font-weight: 500; }
.details { margin: 40px 0; }
.completion-date { font-size: 14px; color: #9CA3AF; margin: 5px 0; }
.cert-number { font-size: 12px; color: #D1D5DB; margin: 5px 0; }
.signature-section { margin-top: 60px; text-align: center; }
.signature-line { width: 300px; height: 1px; background: #D1D5DB; margin: 0 auto 10px auto; }
.signature-title { font-size: 12px; color: #9CA3AF; margin: 0; }',
        'Helvetica Neue, Arial, sans-serif',
        16,
        'A4',
        'landscape',
        NOW(),
        NOW()
      )
    `);
    console.log('✓ Template "Moderne" created');

    // Template 3: Élégant (luxury purple/gold)
    await client.query(`
      INSERT INTO certificate_templates (id, name, description, html_template, css_styles, default_font_family, default_font_size, paper_size, orientation, created_at, updated_at)
      VALUES (
        'template-elegant',
        'Élégant',
        'Design luxueux avec touches dorées et violettes',
        '<div class="certificate-elegant">
  <div class="ornament top-left"></div>
  <div class="ornament top-right"></div>
  <div class="ornament bottom-left"></div>
  <div class="ornament bottom-right"></div>
  <div class="main-container">
    <div class="golden-border">
      <div class="inner-content">
        <div class="seal"></div>
        <h1 class="elegant-title">Certificate of Achievement</h1>
        <div class="decorative-line"></div>
        <p class="award-text">This certificate is proudly presented to</p>
        <h2 class="name-elegant">{{student_name}}</h2>
        <p class="recognition-text">For successfully completing the course</p>
        <h3 class="course-elegant">{{formation_title}}</h3>
        <div class="date-section">
          <p class="date-elegant">{{completion_date}}</p>
          <p class="number-elegant">Certificate: {{certificate_number}}</p>
        </div>
        <div class="signature-elegant">
          <div class="sig-line"></div>
          <p class="sig-label">Director</p>
        </div>
      </div>
    </div>
  </div>
</div>',
        'body { margin: 0; padding: 0; font-family: "Palatino", "Book Antiqua", serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.certificate-elegant { width: 100%; height: 100%; padding: 40px; box-sizing: border-box; position: relative; }
.ornament { position: absolute; width: 60px; height: 60px; border: 3px solid #FFD700; }
.top-left { top: 50px; left: 50px; border-right: none; border-bottom: none; }
.top-right { top: 50px; right: 50px; border-left: none; border-bottom: none; }
.bottom-left { bottom: 50px; left: 50px; border-right: none; border-top: none; }
.bottom-right { bottom: 50px; right: 50px; border-left: none; border-top: none; }
.main-container { width: 100%; height: 100%; background: #fff; border-radius: 10px; padding: 30px; box-sizing: border-box; }
.golden-border { border: 4px solid #FFD700; height: 100%; padding: 40px; box-sizing: border-box; position: relative; }
.inner-content { text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; }
.seal { width: 80px; height: 80px; border-radius: 50%; background: #FFD700; margin: 0 auto 30px auto; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; font-weight: bold; }
.elegant-title { font-size: 44px; color: #764ba2; margin: 0 0 20px 0; font-weight: 700; letter-spacing: 3px; }
.decorative-line { width: 120px; height: 2px; background: linear-gradient(90deg, #667eea 0%, #FFD700 50%, #764ba2 100%); margin: 0 auto 30px auto; }
.award-text { font-size: 16px; color: #6B7280; margin: 0 0 15px 0; font-style: italic; }
.name-elegant { font-size: 38px; color: #000; margin: 15px 0; font-weight: 600; }
.recognition-text { font-size: 16px; color: #6B7280; margin: 20px 0 10px 0; }
.course-elegant { font-size: 30px; color: #667eea; margin: 10px 0 30px 0; font-weight: 600; }
.date-section { margin: 30px 0; }
.date-elegant { font-size: 14px; color: #9CA3AF; margin: 5px 0; }
.number-elegant { font-size: 11px; color: #D1D5DB; margin: 5px 0; }
.signature-elegant { margin-top: 40px; }
.sig-line { width: 250px; height: 1px; background: #D1D5DB; margin: 0 auto 8px auto; }
.sig-label { font-size: 13px; color: #6B7280; margin: 0; }',
        'Palatino, Book Antiqua, serif',
        16,
        'A4',
        'landscape',
        NOW(),
        NOW()
      )
    `);
    console.log('✓ Template "Élégant" created');

    await client.query('COMMIT');
    console.log('Migration 024 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 024 completed successfully!',
      templatesCreated: 3,
      templates: ['template-classique', 'template-moderne', 'template-elegant']
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 024 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 024 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
