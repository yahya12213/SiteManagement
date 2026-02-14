import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, FileDown, Check, CheckCircle, Loader2, Download } from 'lucide-react';
import { usePayslips } from '@/hooks/usePayroll';
import type { PayslipSummary } from '@/lib/api/payroll';

interface PayslipsListProps {
  periodId: string | null;
  onViewDetail: (payslipId: string) => void;
  onValidate?: (payslipId: string) => void;
  onDownloadPdf?: (payslipId: string) => void;
  onValidateAll?: () => void;
  onExportCNSS?: () => void;
  onExportBankTransfers?: () => void;
  onDownloadZip?: () => void;
  canValidate?: boolean;
  canExport?: boolean;
}

export function PayslipsList({
  periodId,
  onViewDetail,
  onValidate,
  onDownloadPdf,
  onValidateAll,
  onExportCNSS,
  onExportBankTransfers,
  onDownloadZip,
  canValidate = false,
  canExport = false,
}: PayslipsListProps) {
  const { data, isLoading } = usePayslips(
    periodId ? { period_id: periodId } : undefined
  );
  const payslips = data?.payslips || [];

  const formatAmount = (amount: number | string | null | undefined) => {
    // PostgreSQL retourne les numeric comme des strings, donc on parse
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!isNaN(num) && num !== null && num !== undefined) {
      return num.toFixed(2) + ' MAD';
    }
    return '0.00 MAD';
  };

  const allValidated = payslips.length > 0 && payslips.every((p) => p.status === 'validated');

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bulletins de Paie</h3>
          {payslips.length > 0 && (
            <div className="flex gap-2">
              {canValidate && !allValidated && onValidateAll && (
                <Button onClick={onValidateAll} size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider Tous
                </Button>
              )}
              {canExport && onDownloadZip && (
                <Button onClick={onDownloadZip} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  ZIP Bulletins
                </Button>
              )}
              {canExport && onExportCNSS && (
                <Button onClick={onExportCNSS} variant="outline" size="sm">
                  Export CNSS
                </Button>
              )}
              {canExport && onExportBankTransfers && (
                <Button onClick={onExportBankTransfers} variant="outline" size="sm">
                  Export Virements
                </Button>
              )}
            </div>
          )}
        </div>

        {!periodId ? (
          <div className="p-8 text-center text-gray-500">
            Sélectionnez une période pour voir les bulletins
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Chargement des bulletins...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun bulletin trouvé pour cette période.
            <br />
            <span className="text-sm">Lancez le calcul de paie pour générer les bulletins.</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead className="text-right">Brut</TableHead>
                  <TableHead className="text-right">Retenues</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip: PayslipSummary) => {
                  // PostgreSQL retourne les numeric comme des strings, donc on parse
                  const parseNum = (val: number | string | null | undefined) => {
                    if (val === null || val === undefined) return 0;
                    return typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
                  };
                  const totalDeductions =
                    parseNum(payslip.cnss_employee) +
                    parseNum(payslip.amo_employee) +
                    parseNum(payslip.igr_amount) +
                    parseNum(payslip.other_deductions);

                  return (
                    <TableRow key={payslip.id}>
                      <TableCell className="font-medium">
                        {payslip.employee_name}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {payslip.employee_number || '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-700 font-medium">
                        {formatAmount(payslip.gross_salary)}
                      </TableCell>
                      <TableCell className="text-right text-red-700 font-medium">
                        {formatAmount(totalDeductions)}
                      </TableCell>
                      <TableCell className="text-right text-blue-700 font-semibold">
                        {formatAmount(payslip.net_salary)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            payslip.status === 'validated'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-500 text-white'
                          }
                        >
                          {payslip.status === 'validated' ? 'Validé' : 'Calculé'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetail(payslip.id)}
                            title="Voir le détail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {onDownloadPdf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDownloadPdf(payslip.id)}
                              title="Télécharger PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          )}
                          {canValidate &&
                            payslip.status !== 'validated' &&
                            onValidate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onValidate(payslip.id)}
                                title="Valider"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
}
