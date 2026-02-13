import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PERMISSIONS } from '@/config/permissions';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Calculator,
  MapPin,
  Users,
  FileSpreadsheet,
  ClipboardCheck,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  BarChart3,
  FileText,
  MessageSquare,
  Palette,
  Shield,
  Briefcase,
  Clock,
  TrendingUp,
  Target,
  Trash2,
  GitBranch,
  Calendar,
  Wallet,
  User,
  CheckSquare,
  FolderKanban,
  Cloud,
  ArrowRightLeft,
  UserCheck,
  Receipt,
  Send,
  BarChart2,
  Brain,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
  permission?: string; // Permission code required to see this menu item
  adminOnly?: boolean; // Only visible to admin users
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [expandedSections, setExpandedSections] = useState<string[]>(['utilisateur-etudiant', 'gestion-comptable', 'formation', 'ressources-humaines', 'mon-equipe', 'mon-espace-rh', 'commercialisation', 'administration']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const sections: NavSection[] = [
    // Section Utilisateur Étudiant (pour les étudiants connectés)
    {
      id: 'utilisateur-etudiant',
      title: 'Utilisateur Étudiant',
      icon: GraduationCap,
      items: [
        { to: '/student/dashboard', icon: Home, label: 'Mon Tableau de bord', permission: PERMISSIONS.training.student.dashboard.view_page },
        { to: '/student/catalog', icon: BookOpen, label: 'Mes Formations', permission: PERMISSIONS.training.student.catalog.view_page },
        { to: '/student/certificates', icon: FileText, label: 'Mes Certificats', permission: PERMISSIONS.training.student.certificates.view },
      ],
    },
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
        { to: '/admin/commercialisation/analyse-publicite', icon: BarChart2, label: 'Analyse Publicite', permission: PERMISSIONS.commercialisation.analyse_publicite.voir },
      ],
    },
    // Section Administration (Admin Only)
    {
      id: 'administration',
      title: 'Administration',
      icon: Settings,
      items: [
        { to: '/admin/ai-settings', icon: Brain, label: 'Configuration IA', adminOnly: true },
      ],
    },
  ];

  // Filter sections based on user permissions and admin status
  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        // Check admin-only items
        if (item.adminOnly && !isAdmin) return false;
        // Check permission-based items
        if (item.permission && !hasPermission(item.permission)) return false;
        return true;
      }),
    }))
    .filter(section => section.items.length > 0); // Hide empty sections

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className={`hidden lg:flex lg:flex-col ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-gradient-to-b from-white via-white to-surface-secondary border-r border-gray-100 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto shadow-elevation-1 transition-all duration-300`}>
      {/* Bouton Toggle */}
      <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-2 py-2 border-b border-gray-100`}>
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title={isCollapsed ? 'Afficher le menu' : 'Réduire le menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'} py-4 space-y-2`}>
        {filteredSections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          const SectionIcon = section.icon;

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              {isCollapsed ? (
                // Mode replié: juste l'icône de section avec tooltip
                <div
                  className="flex justify-center py-2 text-gray-500"
                  title={section.title}
                >
                  <div className="p-2 rounded-lg bg-gray-100">
                    <SectionIcon className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                // Mode déplié: header complet avec expand/collapse
                <button
                  type="button"
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
              )}

              {/* Section Items */}
              {(isCollapsed || isExpanded) && (
                <div className={isCollapsed ? 'space-y-1' : 'ml-3 space-y-0.5 border-l-2 border-primary-100 pl-3 animate-fade-in'}>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.to);

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} ${isCollapsed ? 'p-2' : 'px-3 py-2'} text-sm rounded-input menu-transition ${
                          active
                            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-elevation-1'
                            : 'text-gray-600 hover:bg-surface-secondary hover:text-gray-900'
                        }`}
                      >
                        <ItemIcon
                          className={`h-4 w-4 menu-transition ${active ? 'text-white' : 'text-gray-400'}`}
                        />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`${isCollapsed ? 'px-2' : 'px-6'} py-4 border-t border-gray-100 bg-white/80`}>
        {isCollapsed ? (
          <p className="text-xs text-gray-400 text-center font-medium">©</p>
        ) : (
          <p className="text-xs text-gray-400 text-center font-medium">
            Comptabilité PL © 2025
          </p>
        )}
      </div>
    </aside>
  );
};
