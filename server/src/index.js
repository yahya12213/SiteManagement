import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// CRITICAL: Load environment variables BEFORE any custom imports
// Some modules (like auth.js) validate env vars at load time
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import database connection after dotenv
import pool from './config/database.js';

// Import routes
import segmentsRouter from './routes/segments.js';
import publicRouter from './routes/public.js';
import citiesRouter from './routes/cities.js';
import profilesRouter from './routes/profiles.js';
import calculationSheetsRouter from './routes/calculationSheets.js';
import declarationsRouter from './routes/declarations.js';
import authRouter from './routes/auth.js';
import { authenticateToken, requireRole } from './middleware/auth.js';
import setupTempRouter from './routes/setup-temp.js';
import adminRouter from './routes/admin.js';
import formationsRouter from './routes/formations.js';
import coursRouter from './routes/cours.js';
import progressRouter from './routes/progress.js';
import setupProgressRouter from './routes/setup-progress.js';
import migrationSessionsRouter from './routes/migration-sessions.js';
import migrationSessionsCompleteRouter from './routes/migration-sessions-complete.js';
import migration010Router from './routes/migration-010-session-formations.js';
import migration011Router from './routes/migration-011-student-payments.js';
import migration012Router from './routes/migration-012-formation-templates.js';
import migration013Router from './routes/migration-013-extend-enrollments.js';
import migration014Router from './routes/migration-014-migrate-session-data.js';
import migration015Router from './routes/migration-015-corps-segment.js';
import analyticsRouter from './routes/analytics.js';
import certificatesRouter from './routes/certificates.js';
import setupCertificatesRouter from './routes/setup-certificates.js';
import certificateTemplatesRouter from './routes/certificate-templates.js';
import setupCertificateTemplatesRouter from './routes/setup-certificate-templates.js';
import templateFoldersRouter from './routes/template-folders.js';
import setupTemplateFoldersRouter from './routes/setup-template-folders.js';
import forumsRouter from './routes/forums.js';
import setupForumsRouter from './routes/setup-forums.js';
import migrationCorpsFormationRouter from './routes/migration-corps-formation.js';
import corpsFormationRouter from './routes/corps-formation.js';
import migration016Router from './routes/migration-016-sessions-formation.js';
import sessionsFormationRouter from './routes/sessions-formation.js';
import migration017Router from './routes/migration-017-sessions-corps-formation.js';
import migration018Router from './routes/migration-018-create-students-table.js';
import migration019Router from './routes/migration-019-create-centres-classes.js';
import migration020Router from './routes/migration-020-update-session-etudiants.js';
import migration021Router from './routes/migration-021-rename-formation-id.js';
import migration022Router from './routes/migration-022-add-discount-to-session-etudiants.js';
import migration023Router from './routes/migration-023-fix-certificates-fk.js';
import migration024Router from './routes/migration-024-seed-certificate-templates.js';
import migration025Router from './routes/migration-025-add-discount-percentage.js';
import migration026Router from './routes/migration-026-create-student-payments.js';
import migration027Router from './routes/migration-027-fix-student-payments.js';
import migration028Router from './routes/migration-028-student-status.js';
import migration029Router from './routes/migration-029-rbac-system.js';
import migration030Router from './routes/migration-030-comptabilite-permissions.js';
import migration031Router from './routes/migration-031-simplified-permissions.js';
import migration032Router from './routes/migration-032-remove-role-check.js';
import migration033Router from './routes/migration-033-menu-based-permissions.js';
import migration034Router from './routes/migration-034-hierarchical-permissions.js';
import migration035Router from './routes/migration-035-copy-gerant-permissions.js';
import migration036Router from './routes/migration-036-debug-permissions.js';
import migration037Router from './routes/migration-037-fix-role-id.js';
import migration038Router from './routes/migration-038-check-role-id.js';
import migration039Router from './routes/migration-039-sync-role-id.js';
import migration040Router from './routes/migration-040-hierarchical-rbac.js';
import migration041Router from './routes/migration-041-hr-employees.js';
import migration042Router from './routes/migration-042-hr-attendance.js';
import migration043Router from './routes/migration-043-hr-leaves.js';
import migration044Router from './routes/migration-044-hr-settings.js';
import migration045Router from './routes/migration-045-hr-permissions.js';
import migration046Router from './routes/migration-046-fix-worked-minutes-column.js';
import migration047Router from './routes/migration-047-fix-schema-mismatches.js';
import migration048Router from './routes/migration-048-add-missing-permissions.js';
import migration049Router from './routes/migration-049-add-requires-clocking.js';
import migration050Router from './routes/migration-050-add-public-holidays.js';
import migration051Router from './routes/migration-051-add-break-rules.js';
import migration052Router from './routes/migration-052-add-session-type.js';
import migrationFixRouter from './routes/migration-fix-segments-and-sheets.js';
import migrationFixImpressionRouter from './routes/migration-fix-impression-permissions.js';
import migrationFixRoleSyncRouter from './routes/migration-fix-role-sync.js';
import migration053Router from './routes/migration-053-commercialisation-permissions.js';
import migration054Router from './routes/migration-054-assign-all-permissions-to-gerant.js';
import migration055Router from './routes/migration-055-fix-critical-permissions.js';
import migration056Router from './routes/migration-056-accounting-permissions.js';
import migration057Router from './routes/migration-057-declaration-attachments.js';
import migration058Router from './routes/migration-058-sync-missing-permissions.js';
import migration059Router from './routes/migration-059-fix-permission-overlaps.js';
import migration060Router from './routes/migration-060-prospects-system.js';
import migration061Router from './routes/migration-061-validation-workflows.js';
import migration062Router from './routes/migration-062-employee-portal-permissions.js';
import migration063Router from './routes/migration-063-session-student-permissions.js';
import migration064Router from './routes/migration-064-permission-labels-fr.js';
import migration065Router from './routes/migration-065-professor-permissions.js';
import migration066Router from './routes/migration-066-missing-permissions.js';
import migration067Router from './routes/migration-067-hr-alignment.js';
import migration068Router from './routes/migration-068-auto-employee-records.js';
import migration069Router from './routes/migration-069-fix-attendance-clock-time.js';
import migration070Router from './routes/migration-070-permissions-complete.js';
import migration071Router from './routes/migration-071-session-remove-student.js';
import migration072Router from './routes/migration-072-fix-work-schedules-schema.js';
import migration073Router from './routes/migration-073-security-audit-fixes.js';
import migration074Router from './routes/migration-074-gerant-all-permissions.js';
import migration075Router from './routes/migration-075-add-segments-cities-permissions.js';
import migration076Router from './routes/migration-076-fix-permission-visibility.js';
import migration077Router from './routes/migration-077-create-certificate-template-create-permission.js';
import migration078Router from './routes/migration-078-create-missing-permissions.js';
import migration079Router from './routes/migration-079-fix-admin-bypass.js';
import migration080Router from './routes/migration-080-create-system-roles-view-permission.js';
import migration081Router from './routes/migration-081-debug-admin-permissions.js';
import migration083Router from './routes/migration-083-add-project-color.js';
import migration084Router from './routes/migration-084-archive-system.js';
import migration085Router from './routes/migration-085-document-tracking.js';
import migration086Router from './routes/migration-086-fix-certificates.js';
import migration127Router from './routes/migration-127-admin-correction-tracking.js';
import migrationDebugKhalidRouter from './routes/migration-debug-khalid.js';
import studentsRouter from './routes/students.js';
import centresRouter from './routes/centres.js';
import rolesRouter from './routes/roles.js';
import permissionsRouter from './routes/permissions.js';
import hrEmployeesRouter from './routes/hr-employees.js';
import hrAttendanceRouter from './routes/hr-attendance.js';
import hrOvertimeRouter from './routes/hr-overtime.js';
import hrLeavesRouter from './routes/hr-leaves.js';
import hrDashboardRouter from './routes/hr-dashboard.js';
import hrSettingsRouter from './routes/hr-settings.js';
// REMOVED: hrClockingRouter - consolidated into hr-attendance.js (unified routes)
import hrPublicHolidaysRouter from './routes/hr-public-holidays.js';
import hrEmployeePortalRouter from './routes/hr-employee-portal.js';
import hrRequestsValidationRouter from './routes/hr-requests-validation.js';
import hrScheduleManagementRouter from './routes/hr-schedule-management.js';
import hrValidationWorkflowsRouter from './routes/hr-validation-workflows.js';
import hrPayrollRouter from './routes/hr-payroll.js';
import hrDelegationRouter from './routes/hr-delegation.js';
import hrManagerRouter from './routes/hr-manager.js';
import hrEmployeeSelfRouter from './routes/hr-employee-self.js';
import prospectsRouter from './routes/prospects.js';
import projectsRouter from './routes/projects.js';
import migrationProjectsRouter from './routes/migration-projects.js';
import migrationFixKhalidRoleRouter from './routes/migration-fix-khalid-role.js';
import migrationVerifyGerantPermissionsRouter from './routes/migration-verify-gerant-permissions.js';
import migrationAddCertificateUpdatePermissionRouter from './routes/migration-add-certificate-update-permission.js';
import migrationCreateGerantTablesRouter from './routes/migration-create-gerant-tables.js';
import migrationUpdateNouveauStatusRouter from './routes/migration-update-nouveau-status.js';
import migrationResetProspectAssignmentRouter from './routes/migration-reset-prospect-assignment.js';
import migrationAddHistoriqueRdvRouter from './routes/migration-add-historique-rdv.js';
import migrationAddHistoriqueVillesRouter from './routes/migration-add-historique-villes.js';
import migration087Router from './routes/migration-087-prospect-visits.js';
import migration089Router from './routes/migration-089-google-contacts.js';
import migration090Router from './routes/migration-090-declaration-session-name.js';
import migration091Router from './routes/migration-091-sync-role-ids.js';
import migration092Router from './routes/migration-092-template-folders-permissions.js';
import migration093Router from './routes/migration-093-fix-formation-templates-badge.js';
import migration094Router from './routes/migration-094-fix-badge-document-types.js';
import migration095Router from './routes/migration-095-fix-certificates-unique-constraint.js';
import migration096Router from './routes/migration-096-gerant-certificates-generate-permission.js';
import migration097Router from './routes/migration-097-create-and-assign-certificates-generate.js';
import migration098Router from './routes/migration-098-add-certificates-view-permission.js';
import migration099Router from './routes/migration-099-standardize-existing-data.js';
import migration100Router from './routes/migration-100-student-certificate-number.js';
import migration101Router from './routes/migration-101-remove-certificate-number-unique.js';
import migration102Router from './routes/migration-102-hr-payroll.js';
import migration103Router from './routes/migration-103-hr-delegation.js';
import migration104Router from './routes/migration-104-fix-hr-schedules-constraints.js';
import migration105Router from './routes/migration-105-assign-team-manager.js';
import migration106Router from './routes/migration-106-hr-multi-managers.js';
import migration107Router from './routes/migration-107-hr-correction-requests.js';
import migration108Router from './routes/migration-108-hr-overtime-periods.js';
import migration109Router from './routes/migration-109-refactor-permissions-french.js';
import migration110Router from './routes/migration-110-rename-permissions-french.js';
import migration111Router from './routes/migration-111-cleanup-duplicates.js';
import migration112Router from './routes/migration-112-cleanup-english-permissions.js';
import migration113Router from './routes/migration-113-permission-types.js';
import migration114Router from './routes/migration-114-add-certificats-permissions.js';
import migration115Router from './routes/migration-115-add-all-missing-permissions.js';
import migration116Router from './routes/migration-116-consolidate-permissions.js';
import migration117Router from './routes/migration-117-fix-leave-request-columns.js';
import hrCorrectionRequestsRouter from './routes/hr-correction-requests.js';
import hrRecoveryRouter from './routes/hr-recovery.js';
import debugTemplateDateformatRouter from './routes/debug-template-dateformat.js';
import visitsRouter from './routes/visits.js';
import googleOAuthRouter from './routes/google-oauth.js';
import facebookStatsRouter from './routes/facebook-stats.js';
import migration118Router from './routes/migration-118-facebook-stats.js';
import migration119Router from './routes/migration-119-sync-students-prospects.js';
import migration120Router from './routes/migration-120-nullable-schedule-config.js';
import migration121Router from './routes/migration-121-add-partial-status.js';
import migration122Router from './routes/migration-122-hr-recovery.js';
import migration124Router from './routes/migration-124-create-recovery-tables.js';
import migration125Router from './routes/migration-125-update-status-constraint.js';
import migration130Router from './routes/migration-130-attendance-refactor.js';
import migration132Router from './routes/migration-132-overtime-period-employees.js';
import migration133Router from './routes/migration-133-overtime-status.js';
import migration134Router from './routes/migration-134-fix-day-status-constraint.js';
import migration135Router from './routes/migration-135-fix-overtime-rate-type.js';
import migration136Router from './routes/migration-136-add-is-primary-column.js';
import migration137Router from './routes/migration-137-add-recovery-paid-status.js';
import migration138Router from './routes/migration-138-add-cnss-subject.js';
import migration139Router from './routes/migration-139-enrollment-bonuses.js';
import migration140Router from './routes/migration-140-init-daily-attendance.js';
import migration141Router from './routes/migration-141-add-hourly-rate.js';
import migration142Router from './routes/migration-142-recalculate-day-status.js';
import migration143Router from './routes/migration-143-formation-prime.js';
import migration144Router from './routes/migration-144-employee-objective.js';
import migration145Router from './routes/migration-145-payroll-cutoff-day.js';
import migration146Router from './routes/migration-146-working-day-payroll.js';
import migration147Router from './routes/migration-147-add-delivery-status.js';
import migration148Router from './routes/migration-148-merge-recovery-statuses.js';
import migration151Router from './routes/migration-151-add-ville-to-employees.js';
import migration152Router from './routes/migration-152-delivery-date-tracking.js';
import migration153Router from './routes/migration-153-profile-image.js';
import migration154Router from './routes/migration-154-initial-leave-balance.js';
import migration155Router from './routes/migration-155-leave-balance-system.js';
import migration156Router from './routes/migration-156-segment-fiscal-info.js';
import migration157Router from './routes/migration-157-work-certificates.js';
import migration158Router from './routes/migration-158-sync-employee-photos.js';
import migration159Router from './routes/migration-159-allow-phone-duplicate-across-segments.js';
import migration160Router from './routes/migration-160-complete-country-codes.js';
import hrEnrollmentBonusesRouter from './routes/hr-enrollment-bonuses.js';
import hrAssistantBonusRouter from './routes/hr-assistant-bonus.js';
import hrCertificatesRouter from './routes/hr-certificates.js';
import testWorkflowRouter from './routes/test-workflow.js';
import debugAuthRouter from './routes/debug-auth.js';
import aiSettingsRouter from './routes/ai-settings.js';
import migration150Router from './routes/migration-150-ai-settings.js';
import migrationFixPermissionsSchemaRouter from './routes/migration-fix-permissions-schema.js';

// Import cron jobs
import { startAbsenceDetectionJob } from './jobs/absence-detection.js';
import { startDailyAttendanceInitJob, initializeDailyAttendance } from './jobs/daily-attendance-init.js';

const app = express();

// Parse PORT correctly - ensure it's a number
// FIX: Railway incorrectly sets PORT=5432 (PostgreSQL port) instead of web service port
// We must ignore PORT when it's 5432 and use a safe default
const rawPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const PORT = rawPort === 5432 ? 3001 : rawPort;

// Debug logging for PORT configuration
console.log('🔍 PORT Configuration Debug:');
console.log('  - process.env.PORT:', process.env.PORT);
console.log('  - Raw parsed PORT:', rawPort);
console.log('  - Final PORT (ignoring 5432):', PORT);
console.log('  - Reason:', rawPort === 5432 ? '⚠️  PostgreSQL port detected - using default 3001' : '✅ Using provided PORT');

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// CORS Configuration - Allow Railway production URL and localhost
// Includes Diray Centre (Django) domains for external API integration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
    'http://localhost:5173',
    'http://localhost:3001',
    'http://localhost:8000',      // Django development server (Diray Centre)
    'http://127.0.0.1:8000',      // Django development server (alternate)
    'https://spectacular-enthusiasm-production.up.railway.app',
    // Diray Centre production domains (add your actual domain here)
    // process.env.DIRAY_FRONTEND_URL // Uncomment and set in .env
  ].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow if origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any .railway.app subdomain in production
    if (origin.endsWith('.railway.app')) {
      return callback(null, true);
    }

    // Allow in development mode
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/debug-auth', debugAuthRouter); // TEMPORARY: Debug route for auth issues (NO AUTH REQUIRED)
app.use('/api/segments', authenticateToken, segmentsRouter);
app.use('/api/public', publicRouter);
app.use('/api/public/v1', publicRouter);
app.use('/api/cities', authenticateToken, citiesRouter);
app.use('/api/profiles', authenticateToken, profilesRouter);
app.use('/api/calculation-sheets', authenticateToken, calculationSheetsRouter);
app.use('/api/declarations', authenticateToken, declarationsRouter);
app.use('/api/admin', authenticateToken, adminRouter);
app.use('/api/formations', authenticateToken, formationsRouter);
app.use('/api/cours', authenticateToken, coursRouter);
app.use('/api/progress', authenticateToken, progressRouter);
app.use('/api/analytics', authenticateToken, analyticsRouter);
app.use('/api/certificates', authenticateToken, certificatesRouter);
app.use('/api/certificate-templates', authenticateToken, certificateTemplatesRouter);
app.use('/api/template-folders', authenticateToken, templateFoldersRouter);
app.use('/api/forums', authenticateToken, forumsRouter);
app.use('/api/corps-formation', authenticateToken, corpsFormationRouter);
app.use('/api/sessions-formation', authenticateToken, sessionsFormationRouter);
app.use('/api/students', authenticateToken, studentsRouter);
app.use('/api/centres', authenticateToken, centresRouter);
app.use('/api/roles', authenticateToken, rolesRouter);
app.use('/api/permissions', authenticateToken, permissionsRouter);
app.use('/api/hr/employees', authenticateToken, hrEmployeesRouter);
app.use('/api/hr/attendance', authenticateToken, hrAttendanceRouter);
app.use('/api/hr/overtime', authenticateToken, hrOvertimeRouter);
app.use('/api/hr/leaves', authenticateToken, hrLeavesRouter);
app.use('/api/hr/dashboard', authenticateToken, hrDashboardRouter);
app.use('/api/hr/settings', authenticateToken, hrSettingsRouter);
// REMOVED: /api/hr/clocking - consolidated into /api/hr/attendance (unified routes)
app.use('/api/hr/public-holidays', authenticateToken, hrPublicHolidaysRouter);
app.use('/api/hr/employee-portal', authenticateToken, hrEmployeePortalRouter);
app.use('/api/hr/requests-validation', authenticateToken, hrRequestsValidationRouter);
app.use('/api/hr/schedule-management', authenticateToken, hrScheduleManagementRouter);
app.use('/api/hr/validation-workflows', authenticateToken, hrValidationWorkflowsRouter);
app.use('/api/hr/payroll', authenticateToken, hrPayrollRouter);
app.use('/api/hr/delegation', authenticateToken, hrDelegationRouter);
app.use('/api/hr/manager', authenticateToken, hrManagerRouter);
app.use('/api/hr/my', authenticateToken, hrEmployeeSelfRouter);
app.use('/api/prospects', authenticateToken, prospectsRouter);
app.use('/api/visits', authenticateToken, visitsRouter);
app.use('/api/facebook-stats', authenticateToken, facebookStatsRouter);
app.use('/api/projects', authenticateToken, projectsRouter);
app.use('/api/migration-projects', authenticateToken, migrationProjectsRouter);
app.use('/api/ai-settings', authenticateToken, aiSettingsRouter);

// Google OAuth routes - callback is public (Google redirects there), other routes require auth
// The router handles authentication internally per-route
app.use('/api/google-oauth', googleOAuthRouter);

// ============================================================
// ADMIN-ONLY: Setup and Migration Routes (Protected)
// These routes require admin authentication for security
// ============================================================
const adminOnly = [authenticateToken, requireRole('admin')];

app.use('/api/setup-temp', ...adminOnly, setupTempRouter);
app.use('/api/setup-progress', ...adminOnly, setupProgressRouter);
app.use('/api/setup-certificates', ...adminOnly, setupCertificatesRouter);
app.use('/api/setup-certificate-templates', ...adminOnly, setupCertificateTemplatesRouter);
app.use('/api/setup-template-folders', ...adminOnly, setupTemplateFoldersRouter);
app.use('/api/setup-forums', ...adminOnly, setupForumsRouter);
app.use('/api/migration-sessions', ...adminOnly, migrationSessionsRouter);
app.use('/api/migration-sessions-complete', ...adminOnly, migrationSessionsCompleteRouter);
app.use('/api/migration-010', ...adminOnly, migration010Router);
app.use('/api/migration-011', ...adminOnly, migration011Router);
app.use('/api/migration-012', ...adminOnly, migration012Router);
app.use('/api/migration-013', ...adminOnly, migration013Router);
app.use('/api/migration-014', ...adminOnly, migration014Router);
app.use('/api/migration-015', ...adminOnly, migration015Router);
app.use('/api/migration-corps-formation', ...adminOnly, migrationCorpsFormationRouter);
app.use('/api/migration-016', ...adminOnly, migration016Router);
app.use('/api/migration-017', ...adminOnly, migration017Router);
app.use('/api/migration-018', ...adminOnly, migration018Router);
app.use('/api/migration-019', ...adminOnly, migration019Router);
app.use('/api/migration-020', ...adminOnly, migration020Router);
app.use('/api/migration-021', ...adminOnly, migration021Router);
app.use('/api/migration-022', ...adminOnly, migration022Router);
app.use('/api/migration-023', ...adminOnly, migration023Router);
app.use('/api/migration-024', ...adminOnly, migration024Router);
app.use('/api/migration-025', ...adminOnly, migration025Router);
app.use('/api/migration-026', ...adminOnly, migration026Router);
app.use('/api/migration-027', ...adminOnly, migration027Router);
app.use('/api/migration-028', ...adminOnly, migration028Router);
app.use('/api/migration-029', ...adminOnly, migration029Router);
app.use('/api/migration-030', ...adminOnly, migration030Router);
app.use('/api/migration-031', ...adminOnly, migration031Router);
app.use('/api/migration-032', ...adminOnly, migration032Router);
app.use('/api/migration-033', ...adminOnly, migration033Router);
app.use('/api/migration-034', ...adminOnly, migration034Router);
app.use('/api/migration-035', ...adminOnly, migration035Router);
app.use('/api/migration-036', ...adminOnly, migration036Router);
app.use('/api/migration-037', ...adminOnly, migration037Router);
app.use('/api/migration-038', ...adminOnly, migration038Router);
app.use('/api/migration-039', ...adminOnly, migration039Router);
app.use('/api/migration-040', ...adminOnly, migration040Router);
app.use('/api/migration-041', ...adminOnly, migration041Router);
app.use('/api/migration-042', ...adminOnly, migration042Router);
app.use('/api/migration-043', ...adminOnly, migration043Router);
app.use('/api/migration-044', ...adminOnly, migration044Router);
app.use('/api/migration-045', ...adminOnly, migration045Router);
app.use('/api/migration-046', ...adminOnly, migration046Router);
app.use('/api/migration-047', ...adminOnly, migration047Router);
app.use('/api/migration-048', ...adminOnly, migration048Router);
app.use('/api/migration-049', ...adminOnly, migration049Router);
app.use('/api/migration-050', ...adminOnly, migration050Router);
app.use('/api/migration-051', ...adminOnly, migration051Router);
app.use('/api/migration-052', ...adminOnly, migration052Router);
app.use('/api/migration-053', ...adminOnly, migration053Router);
app.use('/api/migration-054', ...adminOnly, migration054Router);
app.use('/api/migration-055', ...adminOnly, migration055Router);
app.use('/api/migration-056', ...adminOnly, migration056Router);
app.use('/api/migration-057', ...adminOnly, migration057Router);
app.use('/api/migration-058', ...adminOnly, migration058Router);
app.use('/api/migration-059', ...adminOnly, migration059Router);
app.use('/api/migration-060', ...adminOnly, migration060Router);
app.use('/api/migration-061', ...adminOnly, migration061Router);
app.use('/api/migration-062', ...adminOnly, migration062Router);
app.use('/api/migration-063', ...adminOnly, migration063Router);
app.use('/api/migration-064', ...adminOnly, migration064Router);
app.use('/api/migration-065', ...adminOnly, migration065Router);
app.use('/api/migration-066', ...adminOnly, migration066Router);
app.use('/api/migration-067', ...adminOnly, migration067Router);
app.use('/api/migration-068', ...adminOnly, migration068Router);
app.use('/api/migration-069', ...adminOnly, migration069Router);
app.use('/api/migration-070', ...adminOnly, migration070Router);
app.use('/api/migration-071', ...adminOnly, migration071Router);
app.use('/api/migration-072', ...adminOnly, migration072Router);
app.use('/api/migration-073', ...adminOnly, migration073Router);
app.use('/api/migration-074', ...adminOnly, migration074Router);
app.use('/api/migration-075', ...adminOnly, migration075Router);
app.use('/api/migration-076', ...adminOnly, migration076Router);
app.use('/api/migration-077', ...adminOnly, migration077Router);
app.use('/api/migration-078', ...adminOnly, migration078Router);
app.use('/api/migration-079-fix-admin-bypass', ...adminOnly, migration079Router);
app.use('/api/migration-080-create-system-roles-view-permission', ...adminOnly, migration080Router);
app.use('/api/migration-081-debug-admin-permissions', ...adminOnly, migration081Router);
app.use('/api/migration-083-add-project-color', ...adminOnly, migration083Router);
app.use('/api/migration-084-archive-system', ...adminOnly, migration084Router);
app.use('/api/migration-085-document-tracking', ...adminOnly, migration085Router);
app.use('/api/migration-086-fix-certificates', ...adminOnly, migration086Router);
app.use('/api/migration-127', ...adminOnly, migration127Router);
app.use('/api/migration-debug-khalid', ...adminOnly, migrationDebugKhalidRouter);
app.use('/api/migration-fix-khalid-role', ...adminOnly, migrationFixKhalidRoleRouter);
app.use('/api/migration-verify-gerant-permissions', ...adminOnly, migrationVerifyGerantPermissionsRouter);
app.use('/api/migration-add-certificate-update-permission', ...adminOnly, migrationAddCertificateUpdatePermissionRouter);
app.use('/api/migration-create-gerant-tables', ...adminOnly, migrationCreateGerantTablesRouter);
app.use('/api/migration-fix-segments-and-sheets', ...adminOnly, migrationFixRouter);
app.use('/api/migration-fix-impression-permissions', ...adminOnly, migrationFixImpressionRouter);
app.use('/api/migration-fix-role-sync', ...adminOnly, migrationFixRoleSyncRouter);
app.use('/api/migration-update-nouveau-status', ...adminOnly, migrationUpdateNouveauStatusRouter);
app.use('/api/migration-reset-prospect-assignment', ...adminOnly, migrationResetProspectAssignmentRouter);
app.use('/api/migration-add-historique-rdv', ...adminOnly, migrationAddHistoriqueRdvRouter);
app.use('/api/migration-add-historique-villes', ...adminOnly, migrationAddHistoriqueVillesRouter);
app.use('/api/migration-087', ...adminOnly, migration087Router);
app.use('/api', ...adminOnly, migration089Router);
app.use('/api', ...adminOnly, migration090Router);
app.use('/api/migration-091-sync-role-ids', ...adminOnly, migration091Router);
app.use('/api/migration-092-template-folders-permissions', ...adminOnly, migration092Router);
app.use('/api/migration-093-fix-formation-templates-badge', ...adminOnly, migration093Router);
app.use('/api/migration-094-fix-badge-document-types', ...adminOnly, migration094Router);
app.use('/api/migration-095-fix-certificates-unique-constraint', ...adminOnly, migration095Router);
app.use('/api/migration-096-gerant-certificates-generate-permission', ...adminOnly, migration096Router);
app.use('/api/migration-097-create-and-assign-certificates-generate', ...adminOnly, migration097Router);
app.use('/api/migration-098-add-certificates-view-permission', ...adminOnly, migration098Router);
app.use('/api/migration-099-standardize-existing-data', ...adminOnly, migration099Router);
app.use('/api/migration-100-student-certificate-number', ...adminOnly, migration100Router);
app.use('/api/migration-101-remove-certificate-number-unique', ...adminOnly, migration101Router);
app.use('/api/migration-102-hr-payroll', ...adminOnly, migration102Router);
app.use('/api/migration-103-hr-delegation', ...adminOnly, migration103Router);
app.use('/api/migration-104-fix-hr-schedules-constraints', ...adminOnly, migration104Router);
app.use('/api/migration-106-hr-multi-managers', ...adminOnly, migration106Router);
app.use('/api/migration-107-hr-correction-requests', ...adminOnly, migration107Router);
app.use('/api/migration-108-hr-overtime-periods', ...adminOnly, migration108Router);
app.use('/api/migration-109-refactor-permissions-french', ...adminOnly, migration109Router);
app.use('/api/migration-110-rename-permissions-french', ...adminOnly, migration110Router);
app.use('/api/migration-111-cleanup-duplicates', ...adminOnly, migration111Router);
app.use('/api/migration-112-cleanup-english-permissions', ...adminOnly, migration112Router);
app.use('/api/migration-113-permission-types', ...adminOnly, migration113Router);
app.use('/api/migration-114-add-certificats-permissions', ...adminOnly, migration114Router);
app.use('/api/migration-115-add-all-missing-permissions', ...adminOnly, migration115Router);
app.use('/api/migration-116-consolidate-permissions', ...adminOnly, migration116Router);
app.use('/api/migration-117-fix-leave-request-columns', ...adminOnly, migration117Router);
app.use('/api/migration-118-facebook-stats', ...adminOnly, migration118Router);
app.use('/api/migration-119-sync-students-prospects', ...adminOnly, migration119Router);
app.use('/api/migration-120-nullable-schedule-config', ...adminOnly, migration120Router);
app.use('/api/migration-121-add-partial-status', ...adminOnly, migration121Router);
app.use('/api/migration-122-hr-recovery', ...adminOnly, migration122Router);
app.use('/api/migration-124-create-recovery-tables', ...adminOnly, migration124Router);
app.use('/api/migration-125-update-status-constraint', ...adminOnly, migration125Router);
app.use('/api/migration-130-attendance-refactor', ...adminOnly, migration130Router);
app.use('/api/migration-132-overtime-period-employees', ...adminOnly, migration132Router);
app.use('/api/migration-133-overtime-status', ...adminOnly, migration133Router);
app.use('/api/migration-134-fix-day-status-constraint', ...adminOnly, migration134Router);
app.use('/api/migration-135-fix-overtime-rate-type', ...adminOnly, migration135Router);
app.use('/api/migration-136-add-is-primary-column', ...adminOnly, migration136Router);
app.use('/api/migration-137-add-recovery-paid-status', ...adminOnly, migration137Router);
app.use('/api/migration-138-add-cnss-subject', ...adminOnly, migration138Router);
app.use('/api/migration-139-enrollment-bonuses', ...adminOnly, migration139Router);
app.use('/api/migration-140-init-daily-attendance', ...adminOnly, migration140Router);
app.use('/api/migration-141-add-hourly-rate', ...adminOnly, migration141Router);
app.use('/api/migration-142-recalculate-day-status', ...adminOnly, migration142Router);
app.use('/api/migration-143-formation-prime', ...adminOnly, migration143Router);
app.use('/api/migration-144-employee-objective', ...adminOnly, migration144Router);
app.use('/api/migration-145-payroll-cutoff-day', ...adminOnly, migration145Router);
app.use('/api/migration-146-working-day-payroll', ...adminOnly, migration146Router);
app.use('/api/migration-147-add-delivery-status', ...adminOnly, migration147Router);
app.use('/api/migration-148-merge-recovery-statuses', ...adminOnly, migration148Router);
app.use('/api/migration-151-add-ville-to-employees', ...adminOnly, migration151Router);
app.use('/api/migration-152-delivery-date-tracking', ...adminOnly, migration152Router);
app.use('/api/migration-153-profile-image', ...adminOnly, migration153Router);
app.use('/api/migration-154-initial-leave-balance', ...adminOnly, migration154Router);
app.use('/api/migration-155-leave-balance-system', ...adminOnly, migration155Router);
app.use('/api/migration-156-segment-fiscal-info', ...adminOnly, migration156Router);
app.use('/api/migration-157-work-certificates', ...adminOnly, migration157Router);
app.use('/api/migration-158-sync-employee-photos', ...adminOnly, migration158Router);
app.use('/api/migration-159-allow-phone-duplicate-across-segments', ...adminOnly, migration159Router);
app.use('/api/migration-160-complete-country-codes', ...adminOnly, migration160Router);
app.use('/api/migration-150-ai-settings', ...adminOnly, migration150Router);
app.use('/api/migration-fix-permissions-schema', ...adminOnly, migrationFixPermissionsSchemaRouter);
app.use('/api/test-workflow', ...adminOnly, testWorkflowRouter);
// Note: /my/correction-requests routes are in hr-employee-self.js (mounted at /api/hr/my)
// Manager routes for correction requests are mounted separately below
app.use('/api/hr/correction', authenticateToken, hrCorrectionRequestsRouter);
app.use('/api/hr/recovery', authenticateToken, hrRecoveryRouter);
app.use('/api/hr/enrollment-bonuses', authenticateToken, hrEnrollmentBonusesRouter);
app.use('/api/hr/assistant-bonus', authenticateToken, hrAssistantBonusRouter);
app.use('/api/hr/certificates', authenticateToken, hrCertificatesRouter);
app.use('/api/debug-template-dateformat', ...adminOnly, debugTemplateDateformatRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: 'Disconnected', error: error.message });
  }
});

// TEMPORARY: Debug endpoint to check profiles table - NO AUTH
app.get('/check-admin-profiles', async (req, res) => {
  try {
    console.log('🔍 [DEBUG-PROFILES] Checking profiles table...');

    // Get all column names
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `);

    // Count users
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_users FROM profiles
    `);

    // Find admin users (search by username pattern only)
    const adminCheck = await pool.query(`
      SELECT
        p.id,
        p.username,
        LENGTH(p.password) as password_length,
        SUBSTRING(p.password, 1, 10) as password_prefix,
        p.role_id::text as role_id,
        p.created_at
      FROM profiles p
      WHERE p.username ILIKE '%admin%'
      ORDER BY p.created_at
      LIMIT 10
    `);

    res.json({
      success: true,
      table: 'profiles',
      total_users: countResult.rows[0].total_users,
      columns: columnsResult.rows,
      admin_users: adminCheck.rows
    });

  } catch (error) {
    console.error('❌ [DEBUG-PROFILES] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Serve static files from the React app (dist folder)
// Vite builds directly into server/dist (configured in vite.config.ts)
// Both Railway and Local: dist is at server/dist (../dist from server/src)
const distPath = path.join(__dirname, '../dist'); // server/dist
console.log('📁 __dirname:', __dirname);
console.log('📁 process.cwd():', process.cwd());
console.log('📁 Dist path:', distPath);
console.log('📂 Dist exists?', fs.existsSync(distPath));

if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist folder not found! Build may have failed.');
  console.error('Expected location:', distPath);
  // List what's actually in /app directory for debugging
  try {
    const appDir = process.cwd();
    console.log('📂 Contents of /app (process.cwd()):', fs.readdirSync(appDir));
  } catch (e) {
    console.error('Could not list /app directory:', e.message);
  }
} else {
  // Log dist contents for debugging
  try {
    console.log('📂 Contents of dist:', fs.readdirSync(distPath));
    const templatesProleanPath = path.join(distPath, 'templates-prolean');
    if (fs.existsSync(templatesProleanPath)) {
      console.log('📂 Contents of templates-prolean:', fs.readdirSync(templatesProleanPath));
    } else {
      console.log('⚠️ templates-prolean folder not found in dist');
    }
  } catch (e) {
    console.error('Could not list dist contents:', e.message);
  }
}

// Serve uploaded files (backgrounds, fonts, student photos)
// Use UPLOADS_PATH env variable if set (for Railway persistent volume)
// Otherwise use local directory (for development)
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
console.log('📁 Uploads path:', uploadsPath);
console.log('📂 Uploads exists?', fs.existsSync(uploadsPath));
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Ensure subdirectories exist
const subdirs = ['profiles', 'backgrounds', 'fonts'];
subdirs.forEach(subdir => {
  const subdirPath = path.join(uploadsPath, subdir);
  if (!fs.existsSync(subdirPath)) {
    fs.mkdirSync(subdirPath, { recursive: true });
    console.log(`📁 Created ${subdir} subdirectory`);
  }
});

// Add explicit CORS headers for uploaded files (prevent cross-origin issues)
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use('/uploads', express.static(uploadsPath));

// Serve templates-prolean from multiple possible locations (fallback chain)
// 1. First try from dist (Vite build output)
// 2. Then try from public/ (source files)
const templatesProleanInDist = path.join(distPath, 'templates-prolean');
const templatesProleanInPublic = path.join(process.cwd(), 'public', 'templates-prolean');
console.log('📁 templates-prolean paths:');
console.log('   - In dist:', templatesProleanInDist, '| exists:', fs.existsSync(templatesProleanInDist));
console.log('   - In public:', templatesProleanInPublic, '| exists:', fs.existsSync(templatesProleanInPublic));

app.use('/templates-prolean', (req, res, next) => {
  // Add CORS headers for images
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(templatesProleanInDist), express.static(templatesProleanInPublic));

// Serve badges-prolean from multiple possible locations (fallback chain)
const badgesProleanInDist = path.join(distPath, 'badges-prolean');
const badgesProleanInPublic = path.join(process.cwd(), 'public', 'badges-prolean');
console.log('📁 badges-prolean paths:');
console.log('   - In dist:', badgesProleanInDist, '| exists:', fs.existsSync(badgesProleanInDist));
console.log('   - In public:', badgesProleanInPublic, '| exists:', fs.existsSync(badgesProleanInPublic));

app.use('/badges-prolean', (req, res, next) => {
  // Add CORS headers for images
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(badgesProleanInDist), express.static(badgesProleanInPublic));

// Serve certificates-futurepro from multiple possible locations (fallback chain)
const certificatesFutureproInDist = path.join(distPath, 'certificates-futurepro');
const certificatesFutureproInPublic = path.join(process.cwd(), 'public', 'certificates-futurepro');
console.log('📁 certificates-futurepro paths:');
console.log('   - In dist:', certificatesFutureproInDist, '| exists:', fs.existsSync(certificatesFutureproInDist));
console.log('   - In public:', certificatesFutureproInPublic, '| exists:', fs.existsSync(certificatesFutureproInPublic));

app.use('/certificates-futurepro', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(certificatesFutureproInDist), express.static(certificatesFutureproInPublic));

// Serve badges-futurepro from multiple possible locations (fallback chain)
const badgesFutureproInDist = path.join(distPath, 'badges-futurepro');
const badgesFutureproInPublic = path.join(process.cwd(), 'public', 'badges-futurepro');
console.log('📁 badges-futurepro paths:');
console.log('   - In dist:', badgesFutureproInDist, '| exists:', fs.existsSync(badgesFutureproInDist));
console.log('   - In public:', badgesFutureproInPublic, '| exists:', fs.existsSync(badgesFutureproInPublic));

app.use('/badges-futurepro', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(badgesFutureproInDist), express.static(badgesFutureproInPublic));

// Serve static files with cache-control headers
// CSS/JS assets have hash in filename, can be cached long-term
// HTML files should not be cached (they reference the hashed assets)
app.use(express.static(distPath, {
  maxAge: '1y', // Cache assets for 1 year (they have hash in filename)
  etag: true,
  setHeaders: (res, filePath) => {
    // HTML files should not be cached (they contain references to hashed assets)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Add service worker header to prevent caching issues
    if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// The "catchall" handler: for any request that doesn't match API routes,
// send back React's index.html file.
// IMPORTANT: Set no-cache headers for index.html to ensure users always get the latest version
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log('📄 Attempting to serve:', indexPath);

  // Set no-cache headers for index.html
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Error serving index.html:', err);
      res.status(500).json({
        error: 'Frontend not found',
        message: 'The frontend build files are missing. Please ensure npm run build was executed.',
        distPath: distPath
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Initialize app_settings table (auto-migration for AI settings)
async function initializeAppSettings() {
  try {
    console.log('🔧 Initializing app_settings table...');

    // Create app_settings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on key
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
    `);

    // Insert default AI settings if not exist
    const defaultSettings = [
      { key: 'ai_provider', value: '', description: 'AI provider: claude, openai, or gemini' },
      { key: 'ai_api_key', value: '', description: 'API key for the AI provider' },
      { key: 'ai_model', value: '', description: 'AI model to use' },
      { key: 'ai_enabled', value: 'false', description: 'Whether AI features are enabled' }
    ];

    for (const setting of defaultSettings) {
      await pool.query(`
        INSERT INTO app_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
      `, [setting.key, setting.value, setting.description]);
    }

    console.log('✅ app_settings table initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize app_settings:', error.message);
    // Non-fatal error - continue server startup
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);

  // Initialize app_settings table for AI configuration
  await initializeAppSettings();

  // Auto-retry failed Google Contacts syncs every 10 minutes
  import('./services/googleContactsService.js').then(({ googleContactsService }) => {
    setInterval(async () => {
      try {
        await googleContactsService.retryFailedProspects();
      } catch (err) {
        console.error('Auto-retry Google sync error:', err.message);
      }
    }, 10 * 60 * 1000); // 10 minutes
    console.log('📲 Google Contacts auto-retry enabled (every 10 minutes)');
  }).catch(err => {
    console.error('Failed to load googleContactsService for auto-retry:', err.message);
  });

  // Start absence detection cron job
  startAbsenceDetectionJob();

  // Start daily attendance initialization cron job
  startDailyAttendanceInitJob();
});
