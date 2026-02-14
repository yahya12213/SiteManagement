import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileDown, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '@/lib/api/payroll';
import type { Payslip } from '@/lib/api/payroll';

interface PayslipDetailModalProps {
  payslipId: string | null;
  open: boolean;
  onClose: () => void;
  onValidate?: () => void;
  onDownloadPdf?: () => void;
  canValidate?: boolean;
}

export function PayslipDetailModal({
  payslipId,
  open,
  onClose,
  onValidate,
  onDownloadPdf,
  canValidate = false,
}: PayslipDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['payslip', payslipId],
    queryFn: () => (payslipId ? payrollApi.getPayslip(payslipId) : null),
    enabled: open && !!payslipId,
  });

  const payslip = (data as any)?.payslip as Payslip | undefined;

  if (!payslip && isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-600">Chargement du bulletin...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!payslip) {
    return null;
  }

  // PostgreSQL retourne les numeric comme des strings, donc on parse
  const parseNum = (val: number | string | null | undefined): number => {
    if (val === null || val === undefined) return 0;
    return typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
  };

  const formatAmount = (amount: number | string | null | undefined) => {
    const num = parseNum(amount);
    return num.toFixed(2) + ' MAD';
  };

  const formatHours = (hours: number | string | null | undefined) => {
    const num = parseNum(hours);
    return num.toFixed(2) + 'h';
  };

  const gains = payslip.lines?.filter((l) => l.line_type === 'earning') || [];
  const deductions = payslip.lines?.filter((l) => l.line_type === 'deduction') || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Bulletin de Paie</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations Employé */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Informations Employé</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Nom :</span>
                <p className="font-medium">{payslip.employee_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Matricule :</span>
                <p className="font-medium">{payslip.employee_number || '-'}</p>
              </div>
              <div>
                <span className="text-gray-600">Poste :</span>
                <p className="font-medium">{payslip.position || '-'}</p>
              </div>
              <div>
                <span className="text-gray-600">Département :</span>
                <p className="font-medium">{payslip.department || '-'}</p>
              </div>
            </div>
          </div>

          {/* Heures travaillées */}
          {parseNum(payslip.worked_hours) > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Heures</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Heures travaillées</span>
                  <span className="font-medium">{formatHours(payslip.worked_hours)}</span>
                </div>
                {parseNum(payslip.overtime_hours_25) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heures sup. 25%</span>
                    <span className="font-medium">{formatHours(payslip.overtime_hours_25)}</span>
                  </div>
                )}
                {parseNum(payslip.overtime_hours_50) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heures sup. 50%</span>
                    <span className="font-medium">{formatHours(payslip.overtime_hours_50)}</span>
                  </div>
                )}
                {parseNum(payslip.overtime_hours_100) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heures sup. 100%</span>
                    <span className="font-medium">{formatHours(payslip.overtime_hours_100)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gains */}
          <div>
            <h3 className="font-semibold mb-2 text-green-700">Gains</h3>
            <div className="space-y-1 text-sm">
              {gains.length > 0 ? (
                gains.map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span className="text-gray-700">{line.label}</span>
                    <span className="font-medium text-green-700">
                      +{formatAmount(line.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Aucun gain</p>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Salaire Brut</span>
                <span className="text-green-700">{formatAmount(payslip.gross_salary)}</span>
              </div>
            </div>
          </div>

          {/* Retenues */}
          <div>
            <h3 className="font-semibold mb-2 text-red-700">Retenues</h3>
            <div className="space-y-1 text-sm">
              {deductions.length > 0 ? (
                deductions.map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span className="text-gray-700">{line.label}</span>
                    <span className="font-medium text-red-700">
                      -{formatAmount(line.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  {parseNum(payslip.cnss_employee) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">CNSS (Salarié)</span>
                      <span className="font-medium text-red-700">
                        -{formatAmount(payslip.cnss_employee)}
                      </span>
                    </div>
                  )}
                  {parseNum(payslip.amo_employee) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">AMO (Salarié)</span>
                      <span className="font-medium text-red-700">
                        -{formatAmount(payslip.amo_employee)}
                      </span>
                    </div>
                  )}
                  {parseNum((payslip as any).igr_amount || payslip.igr) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">IGR (Impôt sur le revenu)</span>
                      <span className="font-medium text-red-700">
                        -{formatAmount((payslip as any).igr_amount || payslip.igr)}
                      </span>
                    </div>
                  )}
                </>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total Retenues</span>
                <span className="text-red-700">
                  -{formatAmount(
                    parseNum(payslip.cnss_employee) +
                      parseNum(payslip.amo_employee) +
                      parseNum((payslip as any).igr_amount || payslip.igr) +
                      parseNum(payslip.other_deductions)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Net à payer */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Net à Payer</span>
              <span className="text-2xl font-bold text-blue-700">
                {formatAmount(payslip.net_salary)}
              </span>
            </div>
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Statut :</span>
            <Badge
              className={
                payslip.status === 'validated'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-500 text-white'
              }
            >
              {payslip.status === 'validated' ? 'Validé' : 'Calculé'}
            </Badge>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {onDownloadPdf && (
            <Button variant="outline" onClick={onDownloadPdf}>
              <FileDown className="h-4 w-4 mr-2" />
              Télécharger PDF
            </Button>
          )}
          {canValidate && payslip.status !== 'validated' && onValidate && (
            <Button onClick={onValidate}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Valider
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
