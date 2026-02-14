import React from 'react';
import { FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface DeclarationStatusBadgeProps {
  status: 'brouillon' | 'a_declarer' | 'soumise' | 'en_cours' | 'approuvee' | 'refusee';
  className?: string;
}

const statusConfig = {
  brouillon: {
    label: 'Brouillon',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: FileText,
  },
  a_declarer: {
    label: 'À déclarer',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: AlertCircle,
  },
  soumise: {
    label: 'Soumise',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: Clock,
  },
  en_cours: {
    label: 'En cours',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: AlertCircle,
  },
  approuvee: {
    label: 'Approuvée',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle2,
  },
  refusee: {
    label: 'Refusée',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
};

const DeclarationStatusBadge: React.FC<DeclarationStatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

export default DeclarationStatusBadge;
