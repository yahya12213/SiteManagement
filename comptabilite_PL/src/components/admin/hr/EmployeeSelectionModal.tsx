import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Loader2 } from 'lucide-react';
import { usePayrollEmployees } from '@/hooks/usePayroll';
import type { PayrollEmployee } from '@/lib/api/payroll';

interface EmployeeSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  initialSelected?: string[];
}

export function EmployeeSelectionModal({
  open,
  onClose,
  onConfirm,
  initialSelected = [],
}: EmployeeSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Charger les employés
  const { data, isLoading } = usePayrollEmployees(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const employees = data?.employees || [];

  // Reset selected when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelected);
      setSearchQuery('');
    }
  }, [open, initialSelected]);

  const toggleEmployee = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(eid => eid !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === employees.length && employees.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sélectionner les employés</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom ou matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Infos sélection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {selectedIds.length} employé(s) sélectionné(s) sur {employees.length}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={employees.length === 0}>
              {selectedIds.length === employees.length && employees.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>

          {/* Liste employés */}
          <div className="border rounded-lg overflow-auto max-h-96">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Chargement...
              </div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Aucun employé trouvé
              </div>
            ) : (
              <div className="divide-y">
                {employees.map((emp: PayrollEmployee) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {emp.employee_number && `${emp.employee_number} • `}
                        {emp.position || 'Poste non défini'}
                        {emp.department && ` • ${emp.department}`}
                      </div>
                      {(emp.hourly_rate || emp.base_salary) && (
                        <div className="text-xs text-gray-400 mt-1">
                          {emp.base_salary
                            ? `Salaire fixe: ${emp.base_salary.toFixed(2)} MAD`
                            : `Taux horaire: ${emp.hourly_rate?.toFixed(2)} MAD/h`}
                        </div>
                      )}
                    </div>
                    {emp.segment_name && (
                      <Badge variant="secondary">{emp.segment_name}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>
            Confirmer ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
