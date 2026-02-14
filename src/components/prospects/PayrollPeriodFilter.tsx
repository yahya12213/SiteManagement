import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPayrollPeriod } from '@/utils/payroll-period';

interface PayrollPeriodFilterProps {
  currentMonth: Date | null;
  onMonthChange: (month: Date) => void;
  onReset: () => void;
}

export function PayrollPeriodFilter({
  currentMonth,
  onMonthChange,
  onReset
}: PayrollPeriodFilterProps) {
  const isActive = currentMonth !== null;
  const displayMonth = currentMonth || new Date();

  const period = getPayrollPeriod(displayMonth);
  const periodStr = `${format(period.start, 'dd/MM/yyyy')} - ${format(period.end, 'dd/MM/yyyy')}`;

  const handlePrevMonth = () => {
    onMonthChange(subMonths(displayMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(displayMonth, 1));
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/30">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Label */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            <span>Filtre période de paie:</span>
          </div>

          {/* Navigation mois */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              disabled={!isActive}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-[150px] text-center font-medium">
              {format(displayMonth, 'MMMM yyyy', { locale: fr })}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              disabled={!isActive}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              disabled={!isActive}
            >
              Aujourd'hui
            </Button>
          </div>

          {/* Affichage période */}
          <div className="text-sm text-gray-600">
            Période: <span className="font-medium">{periodStr}</span>
          </div>

          {/* Bouton réinitialiser */}
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
          )}

          {!isActive && (
            <Button
              variant="default"
              size="sm"
              onClick={handleToday}
              className="ml-auto"
            >
              Activer le filtre
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
