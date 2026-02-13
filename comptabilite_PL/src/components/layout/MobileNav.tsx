import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PERMISSIONS } from '@/config/permissions';
import {
  Menu,
  X,
  Home,
  Users,
  MapPin,
  FileSpreadsheet,
  Calculator,
  LogOut,
  ClipboardCheck,
  List,
  ChevronDown,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  BarChart3,
  FileText,
  Palette,
  MessageSquare,
  TrendingUp,
  Target,
  Shield,
  Briefcase,
  Clock,
  Wallet,
  User,
  CheckSquare,
  FolderKanban,
  Cloud,
  GitBranch,
  Calendar,
  Trash2,
  ArrowRightLeft,
  UserCheck,
  Send,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface MobileNavProps {
  className?: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['gestion-comptable', 'formation', 'ressources-humaines', 'mon-equipe', 'mon-espace-rh', 'commercialisation']);
  const { user, isAdmin, isGerant, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Sections synchronisées avec Sidebar.tsx
  const allSections: NavSection[] = [
    {
      id: 'gestion-comptable',
      title: 'Gestion Comptable',
      icon: Calculator,
      items: [
        { to: '/dashboard', icon: Home, label: 'Tableau de bord', permission: PERMISSIONS.gestion_comptable.tableau_de_bord.voir },
        { to: '/admin/segments', icon: Calculator, label: 'Segments', permission: PERMISSIONS.gestion_comptable.segments.voir },
        { to: '/admin/cities', icon: MapPin, label: 'Villes', permission: PERMISSIONS.gestion_comptable.villes.voir },
        { to: '/admin/users', icon: Users, label: 'Utilisateurs', permission: PERMISSIONS.gestion_comptable.utilisateurs.voir },
        { to: '/admin/roles', icon: Shield, label: 'Rôles & Permissions', permission: PERMISSIONS.gestion_comptable.roles_permissions.voir },
        { to: '/admin/calculation-sheets', icon: FileSpreadsheet, label: 'Fiches de calcul', permission: PERMISSIONS.gestion_comptable.fiches_calcul.voir },
        { to: '/admin/declarations', icon: ClipboardCheck, label: 'Gérer déclarations', permission: PERMISSIONS.gestion_comptable.declarations.voir },
        { to: '/admin/projects', icon: FolderKanban, label: 'Gestion de Projet', permission: PERMISSIONS.gestion_comptable.gestion_projet.voir },
      ],
    },
    {
      id: 'formation',
      title: 'Formation',
      icon: GraduationCap,
      items: [
        { to: '/admin/formations-management', icon: BookOpen, label: 'Gestion des Formations', permission: PERMISSIONS.formation.gestion_formations.voir },
        { to: '/admin/sessions-formation', icon: CalendarCheck, label: 'Sessions de Formation', permission: PERMISSIONS.formation.sessions_formation.voir },
        { to: '/admin/analytics', icon: BarChart3, label: 'Analytics', permission: PERMISSIONS.formation.analytics.voir },
        { to: '/admin/student-reports', icon: FileText, label: 'Rapports Étudiants', permission: PERMISSIONS.formation.rapports_etudiants.voir },
        { to: '/admin/students-list', icon: Users, label: 'Liste des Étudiants', permission: PERMISSIONS.formation.liste_etudiants.voir },
        { to: '/admin/certificate-templates', icon: Palette, label: 'Templates de Certificats', permission: PERMISSIONS.formation.templates_certificats.voir },
        { to: '/admin/forums', icon: MessageSquare, label: 'Forums', permission: PERMISSIONS.formation.forums.voir },
      ],
    },
    {
      id: 'ressources-humaines',
      title: 'Ressources Humaines',
      icon: Briefcase,
      items: [
        { to: '/admin/hr/validation-workflows', icon: GitBranch, label: 'Boucles de Validation', permission: PERMISSIONS.ressources_humaines.boucles_validation.voir },
        { to: '/admin/hr/schedules', icon: Calendar, label: 'Gestion des Horaires', permission: PERMISSIONS.ressources_humaines.gestion_horaires.voir },
        { to: '/admin/hr/payroll', icon: Wallet, label: 'Gestion de Paie', permission: PERMISSIONS.ressources_humaines.gestion_paie.voir },
        { to: '/admin/hr/employee-portal', icon: Clock, label: 'Gestion Pointage', permission: PERMISSIONS.ressources_humaines.gestion_pointage.voir },
        { to: '/admin/hr/employees', icon: User, label: 'Dossier Employé', permission: PERMISSIONS.ressources_humaines.dossier_employe.voir },
        { to: '/admin/hr/requests-validation', icon: CheckSquare, label: 'Validation des Demandes', permission: PERMISSIONS.ressources_humaines.validation_demandes.voir },
        { to: '/admin/hr/delegations', icon: ArrowRightLeft, label: 'Délégations', permission: PERMISSIONS.ressources_humaines.delegations.voir },
      ],
    },
    // Section Manager - Vue Équipe
    {
      id: 'mon-equipe',
      title: 'Mon Équipe',
      icon: UserCheck,
      items: [
        { to: '/manager/team-attendance', icon: Clock, label: 'Pointages équipe', permission: PERMISSIONS.mon_equipe.pointages_equipe.voir },
        { to: '/manager/team-requests', icon: CheckSquare, label: 'Demandes équipe', permission: PERMISSIONS.mon_equipe.demandes_equipe.voir },
      ],
    },
    // Section Employé - Mon Espace RH
    {
      id: 'mon-espace-rh',
      title: 'Mon Espace RH',
      icon: User,
      items: [
        { to: '/employee/clocking', icon: Clock, label: 'Mon Pointage', permission: PERMISSIONS.mon_espace_rh.mon_pointage.voir },
        { to: '/employee/requests', icon: Send, label: 'Mes Demandes', permission: PERMISSIONS.mon_espace_rh.mes_demandes.voir },
        { to: '/employee/payslips', icon: Receipt, label: 'Mes Bulletins', permission: PERMISSIONS.mon_espace_rh.mes_bulletins.voir },
      ],
    },
    {
      id: 'commercialisation',
      title: 'Commercialisation',
      icon: TrendingUp,
      items: [
        { to: '/admin/commercialisation/dashboard', icon: BarChart3, label: 'Tableau de bord', permission: PERMISSIONS.commercialisation.tableau_de_bord.voir },
        { to: '/admin/commercialisation/prospects', icon: Target, label: 'Prospects', permission: PERMISSIONS.commercialisation.prospects.voir },
        { to: '/admin/commercialisation/prospects-cleaning', icon: Trash2, label: 'Nettoyage Prospects', permission: PERMISSIONS.commercialisation.nettoyage_prospects.voir },
        { to: '/admin/commercialisation/google-contacts', icon: Cloud, label: 'Gestion G-Contacte', permission: PERMISSIONS.commercialisation.gestion_gcontacte.voir },
      ],
    },
  ];

  const professorLinks = [
    { to: '/dashboard', icon: Home, label: 'Tableau de bord' },
    { to: '/professor/declarations', icon: List, label: 'Mes déclarations' },
  ];

  const gerantLinks = [
    { to: '/dashboard', icon: Home, label: 'Tableau de bord' },
    { to: '/gerant/view-declarations', icon: ClipboardCheck, label: 'Voir déclarations' },
  ];

  // Filter sections based on user permissions (same logic as Sidebar)
  const filteredSections = allSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        !item.permission || hasPermission(item.permission)
      ),
    }))
    .filter(section => section.items.length > 0);

  const sections = filteredSections;
  const flatLinks = isAdmin ? [] : isGerant ? gerantLinks : professorLinks;

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Hamburger Button - Visible only on mobile */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={`lg:hidden ${className}`}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Overlay - Enhanced blur and darkness */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-40 lg:hidden menu-transition"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer - Clean white background with elevation */}
      <div
        className={`fixed top-0 left-0 w-72 bg-white shadow-elevation-3 z-50 transform transition-transform duration-slow ease-out lg:hidden flex flex-col h-[100dvh] min-h-screen ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="hover:bg-primary-50 hover:text-primary-600 menu-transition"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* User Info */}
        <div className="flex-shrink-0 p-4 bg-surface-secondary border-b border-gray-100">
          <p className="text-sm font-medium text-gray-800">{user?.full_name || user?.username}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>

        {/* Navigation Links - Scrollable area */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-2 pb-20 bg-white">
          {/* Admin sections with collapsible groups */}
          {sections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const SectionIcon = section.icon;

            return (
              <div key={section.id} className="space-y-1">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-input menu-transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-badge bg-gray-100 group-hover:bg-primary-100 menu-transition">
                      <SectionIcon className="h-4 w-4 text-gray-600 group-hover:text-primary-600 menu-transition" />
                    </div>
                    <span className="group-hover:text-primary-600 menu-transition">{section.title}</span>
                  </div>
                  <div className={`menu-transition ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-500" />
                  </div>
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="ml-3 space-y-0.5 border-l-2 border-primary-100 pl-3 animate-fade-in">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isActive(item.to);

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-input text-sm menu-transition ${
                            active
                              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-elevation-1'
                              : 'text-gray-600 hover:bg-surface-secondary hover:text-gray-900'
                          }`}
                        >
                          <ItemIcon className={`h-4 w-4 menu-transition ${active ? 'text-white' : 'text-gray-400'}`} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Flat links for non-admin users */}
          {flatLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-input text-sm menu-transition ${
                isActive(link.to)
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-elevation-1'
                  : 'text-gray-700 hover:bg-surface-secondary'
              }`}
            >
              <link.icon className={`h-5 w-5 ${isActive(link.to) ? 'text-white' : 'text-gray-400'}`} />
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 hover-lift interactive-scale"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>
    </>
  );
};
