import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2 } from 'lucide-react';
import { useEmployeeCountsBySegment } from '@/hooks/usePayroll';

interface SegmentFilterProps {
  selectedSegmentId: string | null;
  onSegmentChange: (segmentId: string | null) => void;
}

export function SegmentFilter({
  selectedSegmentId,
  onSegmentChange,
}: SegmentFilterProps) {
  const { data, isLoading } = useEmployeeCountsBySegment();
  const segments = data?.data || [];

  const handleValueChange = (value: string) => {
    onSegmentChange(value === 'all' ? null : value);
  };

  const totalEmployees = segments.reduce((sum, seg) => sum + seg.employee_count, 0);

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Filtre par Segment</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Chargement...</span>
          </div>
        ) : (
          <>
            <Select
              value={selectedSegmentId || 'all'}
              onValueChange={handleValueChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span>Tous les segments</span>
                    <Badge variant="secondary" className="ml-auto">
                      {totalEmployees} employés
                    </Badge>
                  </div>
                </SelectItem>
                {segments.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span>{segment.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {segment.employee_count}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSegmentId && (
              <div className="text-sm text-gray-600">
                {(() => {
                  const selected = segments.find((s) => s.id === selectedSegmentId);
                  return selected ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selected.color }}
                      />
                      <span>
                        {selected.employee_count} employé(s) dans{' '}
                        <span className="font-medium">{selected.name}</span>
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
