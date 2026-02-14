import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import { PERMISSIONS } from './config/permissions';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Segments from './pages/admin/Segments';
import Cities from './pages/admin/Cities';
import Users from './pages/admin/Users';
import CalculationSheets from './pages/admin/CalculationSheets';
import CalculationSheetsList from './pages/admin/CalculationSheetsList';
import CalculationSheetEditor from './pages/admin/CalculationSheetEditor';
import DeclarationsManagement from './pages/admin/DeclarationsManagement';
import DeclarationViewer from './pages/admin/DeclarationViewer';
import Declarations from './pages/professor/Declarations';
import DeclarationForm from './pages/professor/DeclarationForm';
import GerantDeclarations from './pages/gerant/GerantDeclarations';
import CreateDeclaration from './pages/gerant/CreateDeclaration';
import Sessions from './pages/admin/formations/Sessions';
import FormationEditor from './pages/admin/formations/FormationEditor';
import FormationsManagement from './pages/admin/FormationsManagement';
import { Analytics } from './pages/admin/Analytics';
import { StudentReports } from './pages/admin/StudentReports';
import { StudentsListPage } from './pages/admin/StudentsListPage';
import { CertificateTemplates } from './pages/admin/CertificateTemplates';
import { CertificateTemplateCanvasEditor } from './pages/admin/CertificateTemplateCanvasEditor';
import { ForumModeration } from './pages/admin/ForumModeration';
import { SessionsFormation } from './pages/admin/SessionsFormation';
import { SessionDetail } from './pages/admin/SessionDetail';
import CorpsFormation from './pages/admin/CorpsFormation';
import { RolesManagement } from './pages/admin/RolesManagement';
import PermissionsDiagnostic from './pages/admin/PermissionsDiagnostic';
import HREmployees from './pages/admin/hr/HREmployees';
import ValidationWorkflows from './pages/admin/hr/ValidationWorkflows';
import ScheduleManagement from './pages/admin/hr/ScheduleManagement';
import { PayrollManagement } from './pages/admin/hr/PayrollManagement';
import { PayrollConfiguration } from './pages/admin/hr/PayrollConfiguration';
import EmployeePortal from './pages/admin/hr/EmployeePortal';
import RequestsValidation from './pages/admin/hr/RequestsValidation';
import DelegationManagement from './pages/admin/hr/DelegationManagement';
import HRRecovery from './pages/admin/hr/HRRecovery';
// Manager pages
import TeamAttendance from './pages/manager/TeamAttendance';
import TeamRequests from './pages/manager/TeamRequests';
// Employee self-service pages
import MyRequests from './pages/employee/MyRequests';
import MyPayslips from './pages/employee/MyPayslips';
import ProjectsManagement from './pages/admin/ProjectsManagement';
import CommercializationDashboard from './pages/admin/commercialisation/CommercializationDashboard';
import Clients from './pages/admin/commercialisation/Clients';
import Prospects from './pages/admin/commercialisation/Prospects';
import Visits from './pages/admin/commercialisation/Visits';
import ProspectsCleaningDashboard from './pages/admin/ProspectsCleaningDashboard';
import Devis from './pages/admin/commercialisation/Devis';
import Contrats from './pages/admin/commercialisation/Contrats';
import GoogleContactsManagement from './pages/admin/commercialisation/GoogleContactsManagement';
import AnalysePublicite from './pages/admin/commercialisation/AnalysePublicite';
import IndicateursProspects from './pages/admin/commercialisation/IndicateursProspects';
import AISettings from './pages/admin/AISettings';
import Clocking from './pages/employee/Clocking';
import StudentDashboard from './pages/student/StudentDashboard';
import FormationCatalog from './pages/student/FormationCatalog';
import FormationViewer from './pages/student/FormationViewer';
import VideoPlayer from './pages/student/VideoPlayer';
import TestTaking from './pages/student/TestTaking';
import { MyCertificates } from './pages/student/MyCertificates';
import { ForumList } from './pages/student/ForumList';
import { ThreadView } from './pages/student/ThreadView';
import { CreateThread } from './pages/student/CreateThread';
import LandingPage from './pages/LandingPage';

// Protected Route Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
  gerantOnly?: boolean;
  requiredPermission?: string | string[];
}> = ({
  children,
  adminOnly = false,
  gerantOnly = false,
  requiredPermission
}) => {
  const { isAuthenticated, isAdmin, isGerant, hasPermission, hasAnyPermission } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check permission-based access (priority over role-based)
  if (requiredPermission) {
    const hasAccess = Array.isArray(requiredPermission)
      ? hasAnyPermission(...requiredPermission)
      : hasPermission(requiredPermission);

    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
  }

  // Fallback to role-based access (for backward compatibility)
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (gerantOnly && !isGerant) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Navigation Handler Component - detects browser back/forward navigation only
const NavigationHandler: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const prevPathRef = useRef(location.pathname);
  const isPopStateRef = useRef(false);

  // Only invalidate on browser back/forward (popstate), not on regular navigation
  useEffect(() => {
    const handlePopState = () => {
      isPopStateRef.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle actual route changes - only invalidate on back/forward navigation
  useEffect(() => {
    if (isPopStateRef.current && prevPathRef.current !== location.pathname) {
      // Only invalidate stale queries on browser back/forward navigation
      queryClient.invalidateQueries({ stale: true });
      isPopStateRef.current = false;
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, queryClient]);

  return null;
};

const AppRoutes: React.FC = () => {
  const { isLoading } = useAuth();

  // Afficher un écran de chargement pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NavigationHandler />
      <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Gestion Comptable */}
      <Route
        path="/admin/segments"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.segments.view_page}>
            <Segments />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/cities"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.cities.view_page}>
            <Cities />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.users.view_page}>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/calculation-sheets"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.calculation_sheets.view_page}>
            <CalculationSheetsList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/calculation-sheets/:id"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.calculation_sheets.view_page}>
            <CalculationSheets />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/calculation-sheets/:id/editor"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.calculation_sheets.edit}>
            <CalculationSheetEditor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/declarations"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.declarations.view_page}>
            <DeclarationsManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/declarations/:id"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.declarations.view_page}>
            <DeclarationViewer />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/projects"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.projects.view_page}>
            <ProjectsManagement />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Formation en Ligne */}
      <Route
        path="/admin/formations-management"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.formations.view_page}>
            <FormationsManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/corps-formation"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.corps.view_page}>
            <CorpsFormation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/formations/sessions"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.sessions.view_page}>
            <Sessions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/formations/cours/:id/editor"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.formations.edit_content}>
            <FormationEditor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/sessions-formation"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.sessions.view_page}>
            <SessionsFormation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/sessions-formation/:id"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.sessions.view_page}>
            <SessionDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.analytics.view_page}>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/student-reports"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student_reports.view_page}>
            <StudentReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/students-list"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.students.view_page}>
            <StudentsListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/certificate-templates"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.certificate_templates.view_page}>
            <CertificateTemplates />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/certificate-templates/:id/canvas-edit"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.certificate_templates.edit_canvas}>
            <CertificateTemplateCanvasEditor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/forums"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.forums.view_page}>
            <ForumModeration />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Système */}
      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.system.roles.view_page}>
            <RolesManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/permissions-diagnostic"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.system.roles.view_page}>
            <PermissionsDiagnostic />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Ressources Humaines */}
      <Route
        path="/admin/hr/validation-workflows"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.validation_workflows.view_page}>
            <ValidationWorkflows />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/schedules"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.schedules.view_page}>
            <ScheduleManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/payroll"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.payroll.view_page}>
            <PayrollManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/payroll/configuration"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.ressources_humaines.gestion_paie.configuration.modifier}>
            <PayrollConfiguration />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/employee-portal"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.employee_portal.view_page}>
            <EmployeePortal />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/employees"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.employees.view_page}>
            <HREmployees />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/requests-validation"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.requests_validation.view_page}>
            <RequestsValidation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/delegations"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.delegation.view_page}>
            <DelegationManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hr/recovery"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.recovery.view_page}>
            <HRRecovery />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Commercialisation */}
      <Route
        path="/admin/commercialisation/dashboard"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.dashboard.view_page}>
            <CommercializationDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/clients"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.clients.view_page}>
            <Clients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/prospects"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.prospects.view_page}>
            <Prospects />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/indicateurs-prospects"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.prospects.view_page}>
            <IndicateursProspects />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/visits"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.visits.view_page}>
            <Visits />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/prospects-cleaning"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.prospects.clean}>
            <ProspectsCleaningDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/devis"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.devis.view_page}>
            <Devis />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/contrats"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.contrats.view_page}>
            <Contrats />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/google-contacts"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.google_contacts?.view_page}>
            <GoogleContactsManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/commercialisation/analyse-publicite"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.commercialisation.analyse_publicite?.voir}>
            <AnalysePublicite />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes - Configuration IA (Admin Only) */}
      <Route
        path="/admin/ai-settings"
        element={
          <ProtectedRoute adminOnly>
            <AISettings />
          </ProtectedRoute>
        }
      />

      {/* Employee Routes */}
      <Route
        path="/employee/clocking"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.clocking.self}>
            <Clocking />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee/requests"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.my.requests}>
            <MyRequests />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee/payslips"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.my.payslips}>
            <MyPayslips />
          </ProtectedRoute>
        }
      />

      {/* Manager Routes */}
      <Route
        path="/manager/team-attendance"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.manager.team_attendance}>
            <TeamAttendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/team-requests"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.hr.manager.team_requests}>
            <TeamRequests />
          </ProtectedRoute>
        }
      />

      {/* Professor Routes */}
      <Route
        path="/professor/declarations"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.professor.declarations.view_page}>
            <Declarations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/professor/declarations/:id/fill"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.professor.declarations.fill}>
            <DeclarationForm />
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.dashboard.view_page}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/catalog"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.catalog.view_page}>
            <FormationCatalog />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/formations/:id"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.course.view}>
            <FormationViewer />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/formations/:id/videos/:videoId"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.course.videos.view}>
            <VideoPlayer />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/formations/:id/tests/:testId"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.course.tests.take}>
            <TestTaking />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/certificates"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.certificates.view}>
            <MyCertificates />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/forums/:formationId"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.forums.participate}>
            <ForumList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/forums/:formationId/new"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.forums.participate}>
            <CreateThread />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/forums/thread/:threadId"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.training.student.forums.participate}>
            <ThreadView />
          </ProtectedRoute>
        }
      />

      {/* Gerant Routes */}
      <Route
        path="/gerant/declarations"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.declarations.view_all}>
            <GerantDeclarations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gerant/create-declaration"
        element={
          <ProtectedRoute requiredPermission={PERMISSIONS.accounting.declarations.create}>
            <CreateDeclaration />
          </ProtectedRoute>
        }
      />

      {/* Default Route - Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>
            <AppRoutes />
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
