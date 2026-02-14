import React from 'react';
import {
  Type,
  AtSign,
  CreditCard,
  GraduationCap,
  Clock,
  Calendar,
  CalendarCheck,
  Hash,
  Award,
  Building2,
  UserCircle,
  MapPin,
  Image as ImageIcon,
  Square,
  Minus,
  Circle,
  Phone,
  MessageCircle,
  Home,
  User,
  Cake,
  BookOpen,
  CalendarRange,
  Tag,
  Layers,
  Camera,
  KeyRound,
} from 'lucide-react';

interface ElementPaletteProps {
  onDragStart: (type: string, data: any) => void;
}

export const ElementPalette: React.FC<ElementPaletteProps> = ({ onDragStart }) => {
  // Variables dynamiques (données étudiant, formation, certificat)
  const variableElements = [
    // Données Étudiant
    { type: 'text', icon: Type, label: 'Nom complet étudiant', variable: '{student_name}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: User, label: 'Prénom étudiant', variable: '{student_first_name}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: User, label: 'Nom famille étudiant', variable: '{student_last_name}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: AtSign, label: 'Email étudiant', variable: '{student_email}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: CreditCard, label: 'CIN/ID étudiant', variable: '{student_id}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: Phone, label: 'Téléphone étudiant', variable: '{student_phone}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: MessageCircle, label: 'WhatsApp étudiant', variable: '{student_whatsapp}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: Cake, label: 'Date naissance', variable: '{student_birth_date}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: MapPin, label: 'Lieu naissance', variable: '{student_birth_place}', category: 'Étudiant', color: 'blue' },
    { type: 'text', icon: Home, label: 'Adresse étudiant', variable: '{student_address}', category: 'Étudiant', color: 'blue' },

    // Données Formation
    { type: 'text', icon: GraduationCap, label: 'Nom formation', variable: '{formation_title}', category: 'Formation', color: 'green' },
    { type: 'text', icon: Type, label: 'Description formation', variable: '{formation_description}', category: 'Formation', color: 'green' },
    { type: 'text', icon: Clock, label: 'Durée (heures)', variable: '{duration_hours}', category: 'Formation', color: 'green' },

    // Données Certificat
    { type: 'text', icon: Hash, label: 'Numéro certificat', variable: '{certificate_number}', category: 'Certificat', color: 'purple' },
    { type: 'text', icon: KeyRound, label: 'Série unique', variable: '{certificate_serial}', category: 'Certificat', color: 'purple' },
    { type: 'text', icon: CalendarCheck, label: 'Date complétion', variable: '{completion_date}', category: 'Certificat', color: 'purple' },
    { type: 'text', icon: Calendar, label: 'Date émission', variable: '{issued_date}', category: 'Certificat', color: 'purple' },
    { type: 'text', icon: Award, label: 'Note/Grade', variable: '{grade}', category: 'Certificat', color: 'purple' },

    // Données Session
    { type: 'text', icon: BookOpen, label: 'Titre session', variable: '{session_title}', category: 'Session', color: 'teal' },
    { type: 'text', icon: CalendarRange, label: 'Date début session', variable: '{session_date_debut}', category: 'Session', color: 'teal' },
    { type: 'text', icon: CalendarRange, label: 'Date fin session', variable: '{session_date_fin}', category: 'Session', color: 'teal' },
    { type: 'text', icon: MapPin, label: 'Ville session', variable: '{session_ville}', category: 'Session', color: 'teal' },
    { type: 'text', icon: Tag, label: 'Segment session', variable: '{session_segment}', category: 'Session', color: 'teal' },
    { type: 'text', icon: Layers, label: 'Corps formation', variable: '{session_corps_formation}', category: 'Session', color: 'teal' },

    // Données Organisation
    { type: 'text', icon: Building2, label: 'Nom organisation', variable: '{organization_name}', category: 'Organisation', color: 'orange' },
    { type: 'text', icon: UserCircle, label: 'Nom directeur', variable: '{director_name}', category: 'Organisation', color: 'orange' },
    { type: 'text', icon: MapPin, label: 'Adresse organisation', variable: '{organization_address}', category: 'Organisation', color: 'orange' },
  ];

  // Images
  const imageElements = [
    { type: 'image', icon: Camera, label: 'Photo étudiant', source: '{student_photo_url}', color: 'indigo' },
    { type: 'image', icon: ImageIcon, label: 'Logo', source: '{logo_url}', color: 'indigo' },
    { type: 'image', icon: ImageIcon, label: 'Signature', source: '{signature_url}', color: 'indigo' },
    { type: 'image', icon: ImageIcon, label: 'Image personnalisée', source: '', color: 'indigo' },
  ];

  // Formes
  const shapeElements = [
    { type: 'rectangle', icon: Square, label: 'Rectangle', color: 'gray' },
    { type: 'line', icon: Minus, label: 'Ligne', color: 'gray' },
    { type: 'circle', icon: Circle, label: 'Cercle', color: 'gray' },
  ];

  // Texte libre
  const textElements = [
    { type: 'text', icon: Type, label: 'Texte libre', content: 'Nouveau texte', color: 'slate' },
  ];

  const handleDragStart = (e: React.DragEvent, element: any) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(element));
    onDragStart(element.type, element);
  };

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  };

  const renderElement = (element: any, index: number) => {
    const Icon = element.icon;
    const colors = colorClasses[element.color] || colorClasses.gray;

    return (
      <div
        key={`${element.type}-${index}`}
        draggable
        onDragStart={(e) => handleDragStart(e, element)}
        className={`${colors.bg} ${colors.text} border ${colors.border} rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center gap-2 text-sm`}
        title={`Glisser pour ajouter: ${element.label}`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate flex-1">{element.label}</span>
      </div>
    );
  };

  // Grouper par catégorie
  const categories = Array.from(new Set(variableElements.map(e => e.category)));

  return (
    <div className="h-full overflow-y-auto bg-white border-r border-gray-200">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Éléments
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Glissez-déposez les éléments sur le canvas
          </p>
        </div>

        {/* Variables par catégorie */}
        {categories.map((category) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              {category}
            </h4>
            <div className="space-y-2">
              {variableElements
                .filter((e) => e.category === category)
                .map((element, index) => renderElement(element, index))}
            </div>
          </div>
        ))}

        {/* Images */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Images
          </h4>
          <div className="space-y-2">
            {imageElements.map((element, index) => renderElement(element, index))}
          </div>
        </div>

        {/* Formes */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Formes
          </h4>
          <div className="space-y-2">
            {shapeElements.map((element, index) => renderElement(element, index))}
          </div>
        </div>

        {/* Texte libre */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Texte
          </h4>
          <div className="space-y-2">
            {textElements.map((element, index) => renderElement(element, index))}
          </div>
        </div>
      </div>
    </div>
  );
};
