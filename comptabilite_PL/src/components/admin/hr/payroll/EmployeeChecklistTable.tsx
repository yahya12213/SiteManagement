import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, Loader2 } from 'lucide-react';
import { usePayrollEmployees } from '@/hooks/usePayroll';
import type { PayrollEmployee } from '@/lib/api/payroll';

interface EmployeeChecklistTableProps {
  segmentFilter: string | null;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function EmployeeChecklistTable({
  segmentFilter,
  selectedIds,
  onSelectionChange,
}: EmployeeChecklistTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Charger les employés avec filtres
  const { data, isLoading } = usePayrollEmployees({
    search: debouncedSearch || undefined,
    segment_id: segmentFilter || undefined,
  });

  const employees = data?.employees || [];

  const toggleEmployee = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((eid) => eid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === employees.length && employees.length > 0) {
      onSelectionChange([]);
    } else {
      onSelectionChange(employees.map((e) => e.id));
    }
  };

  const formatSalary = (emp: PayrollEmployee) => {
    if (emp.base_salary && typeof emp.base_salary === 'number') {
      return `${emp.base_salary.toFixed(0)} MAD`;
    } else if (emp.hourly_rate && typeof emp.hourly_rate === 'number' && emp.working_hours_per_week && typeof emp.working_hours_per_week === 'number') {
      const monthlySalary = emp.hourly_rate * emp.working_hours_per_week * 4.33;
      return `${emp.hourly_rate.toFixed(2)} MAD/h (≈${monthlySalary.toFixed(0)} MAD/mois)`;
    } else if (emp.hourly_rate && typeof emp.hourly_rate === 'number') {
      return `${emp.hourly_rate.toFixed(2)} MAD/h`;
    }
    return 'Non défini';
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Sélection des Employés</h3>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Barre d'actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedIds.length} employé(s) sélectionné(s) sur {employees.length}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={employees.length === 0}
          >
            {selectedIds.length === employees.length && employees.length > 0
              ? 'Tout désélectionner'
              : 'Tout sélectionner'}
          </Button>
        </div>

        {/* Table des employés */}
        <div className="border rounded-lg overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement des employés...
            </div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun employé trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length === employees.length &&
                        employees.length > 0
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Salaire</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp: PayrollEmployee) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {emp.first_name} {emp.last_name}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {emp.employee_number || '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {emp.position || '-'}
                    </TableCell>
                    <TableCell>
                      {emp.segment_name ? (
                        <div className="flex items-center gap-2">
                          {emp.segment_color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: emp.segment_color }}
                            />
                          )}
                          <span className="text-sm">{emp.segment_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatSalary(emp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {emp.is_cnss_subject !== false ? (
                          <Badge variant="secondary" className="text-xs">
                            CNSS
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-orange-600 border-orange-300"
                          >
                            Non CNSS
                          </Badge>
                        )}
                        {emp.is_amo_subject !== false ? (
                          <Badge variant="secondary" className="text-xs">
                            AMO
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-orange-600 border-orange-300"
                          >
                            Non AMO
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Card>
  );
}
