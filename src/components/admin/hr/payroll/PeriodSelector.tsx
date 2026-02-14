import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { getPayrollPeriod } from '@/utils/payroll-period';

interface PeriodSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  periodStatus?: 'draft' | 'open' | 'calculating' | 'calculated' | 'validated' | 'closed';
}

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-gray-500' },
  open: { label: 'Ouverte', color: 'bg-green-500' },
  calculating: { label: 'Calcul en cours', color: 'bg-yellow-500' },
  calculated: { label: 'Calculée', color: 'bg-blue-500' },
  validated: { label: 'Validée', color: 'bg-indigo-500' },
  closed: { label: 'Clôturée', color: 'bg-gray-700' },
};

export function PeriodSelector({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  periodStatus,
}: PeriodSelectorProps) {
  // Calculer la fenêtre de paie
  const periodDate = new Date(selectedYear, selectedMonth - 1, 1);
  const { start, end } = getPayrollPeriod(periodDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Générer les années (année actuelle -2 à +1)
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Période de Paie</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sélecteur d'année */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Année</label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => onYearChange(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélecteur de mois */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Mois</label>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => onMonthChange(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fenêtre de paie calculée */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Fenêtre de pointage :</span>{' '}
            <span className="font-semibold text-blue-700">
              {formatDate(start)} → {formatDate(end)}
            </span>
          </p>
        </div>

        {/* Statut de la période */}
        {periodStatus && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Statut :</span>
            <Badge
              className={`${STATUS_CONFIG[periodStatus].color} text-white`}
            >
              {STATUS_CONFIG[periodStatus].label}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
