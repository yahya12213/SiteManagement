/**
 * MyPayslips.tsx - Mes bulletins de paie (Employé Self-Service)
 *
 * Permet à l'employé de :
 * - Consulter ses bulletins de paie par année
 * - Voir le détail d'un bulletin (gains, retenues)
 * - Télécharger les bulletins en PDF
 */

import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Eye,
  Calendar,
  Euro,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Building2,
  User
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { useMyPayslips, usePayslipDetail, useDownloadMyPayslipPdf } from '@/hooks/useMyHR';

// ============================================================
// CONSTANTS
// ============================================================

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
  calculated: { label: 'Calculé', className: 'bg-blue-100 text-blue-800' },
  validated: { label: 'Validé', className: 'bg-green-100 text-green-800' },
  paid: { label: 'Payé', className: 'bg-emerald-100 text-emerald-800' },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' MAD';
}

// ============================================================
// COMPONENTS
// ============================================================

interface PayslipDetailModalProps {
  payslipId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (id: string) => void;
}

function PayslipDetailModal({ payslipId, open, onOpenChange, onDownload }: PayslipDetailModalProps) {
  const { data, isLoading } = usePayslipDetail(payslipId || '');
  const payslip = data?.payslip;

  if (!payslipId) return null;

  // Group lines by type
  const earnings = payslip?.lines?.filter(l => l.line_type === 'earning').sort((a, b) => a.sort_order - b.sort_order) || [];
  const deductions = payslip?.lines?.filter(l => l.line_type === 'deduction').sort((a, b) => a.sort_order - b.sort_order) || [];

  const totalEarnings = earnings.reduce((sum, l) => sum + l.amount, 0);
  const totalDeductions = deductions.reduce((sum, l) => sum + l.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Bulletin de paie
          </DialogTitle>
          {payslip && (
            <DialogDescription>
              {payslip.period_label || `${MONTHS_FR[payslip.month - 1]} ${payslip.year}`}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : payslip ? (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              {/* Employee Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Employé</span>
                </div>
                <p className="font-semibold">{payslip.employee_info?.full_name}</p>
                {payslip.employee_info?.employee_number && (
                  <p className="text-xs text-muted-foreground">Matricule: {payslip.employee_info.employee_number}</p>
                )}
                {payslip.employee_info?.position && (
                  <p className="text-xs text-muted-foreground">{payslip.employee_info.position}</p>
                )}
                {payslip.employee_info?.department && (
                  <p className="text-xs text-muted-foreground">{payslip.employee_info.department}</p>
                )}
                {payslip.employee_info?.cnss_number && (
                  <p className="text-xs text-muted-foreground">CNSS: {payslip.employee_info.cnss_number}</p>
                )}
              </div>

              {/* Company Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Employeur</span>
                </div>
                <p className="font-semibold">{payslip.company_info?.name || 'Entreprise'}</p>
                {payslip.company_info?.address && (
                  <p className="text-xs text-muted-foreground">{payslip.company_info.address}</p>
                )}
                {payslip.company_info?.cnss_number && (
                  <p className="text-xs text-muted-foreground">CNSS: {payslip.company_info.cnss_number}</p>
                )}
              </div>
            </div>

            {/* Earnings */}
            <div>
              <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Gains
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Taux/Qté</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell className="text-right">
                        {line.base_amount ? formatCurrency(line.base_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.quantity ? `${line.quantity}` : line.rate ? `${(line.rate * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        {formatCurrency(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-green-50">
                    <TableCell colSpan={3} className="font-semibold">Total Gains</TableCell>
                    <TableCell className="text-right font-bold text-green-700">
                      {formatCurrency(totalEarnings)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Deductions */}
            <div>
              <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Retenues
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell className="text-right">
                        {line.base_amount ? formatCurrency(line.base_amount) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.rate ? `${(line.rate * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-700">
                        -{formatCurrency(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-red-50">
                    <TableCell colSpan={3} className="font-semibold">Total Retenues</TableCell>
                    <TableCell className="text-right font-bold text-red-700">
                      -{formatCurrency(totalDeductions)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-blue-600 mb-1">Salaire Brut</p>
                <p className="text-lg font-bold text-blue-800">{formatCurrency(payslip.gross_salary)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-red-600 mb-1">Total Retenues</p>
                <p className="text-lg font-bold text-red-800">-{formatCurrency(totalDeductions)}</p>
              </div>
              <div className="p-4 bg-green-100 rounded-lg text-center border-2 border-green-300">
                <p className="text-xs text-green-700 mb-1">Net à Payer</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(payslip.net_salary)}</p>
              </div>
            </div>

            {/* Cotisations Detail */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h5 className="text-sm font-medium mb-2">Détail des cotisations sociales</h5>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">CNSS (4.48%)</p>
                  <p className="font-medium">{formatCurrency(payslip.cnss_employee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">AMO (2.26%)</p>
                  <p className="font-medium">{formatCurrency(payslip.amo_employee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IGR</p>
                  <p className="font-medium">{formatCurrency(payslip.igr)}</p>
                </div>
              </div>
            </div>

            {/* Pay Date */}
            {payslip.pay_date && (
              <div className="text-center text-sm text-muted-foreground">
                Date de paiement : {format(parseISO(payslip.pay_date), 'd MMMM yyyy', { locale: fr })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Bulletin non trouvé
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {payslip && (
            <Button onClick={() => onDownload(payslipId)}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MyPayslips() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  // State
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [detailPayslipId, setDetailPayslipId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Available years (current year and 4 previous)
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Queries
  const { data: payslipsData, isLoading, refetch } = useMyPayslips({ year: selectedYear });
  const downloadMutation = useDownloadMyPayslipPdf();

  // Data
  const payslips = payslipsData?.payslips || [];

  // Stats
  const stats = useMemo(() => {
    if (payslips.length === 0) return { total: 0, avgNet: 0, totalNet: 0 };
    const totalNet = payslips.reduce((sum, p) => sum + p.net_salary, 0);
    return {
      total: payslips.length,
      avgNet: totalNet / payslips.length,
      totalNet,
    };
  }, [payslips]);

  // Handlers
  const handleViewDetail = (payslipId: string) => {
    setDetailPayslipId(payslipId);
    setDetailOpen(true);
  };

  const handleDownload = async (payslipId: string) => {
    try {
      await downloadMutation.mutateAsync(payslipId);
      toast({ title: 'Succès', description: 'Bulletin téléchargé' });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur lors du téléchargement', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Mes bulletins de paie
          </h1>
          <p className="text-muted-foreground mt-1">
            Consultez et téléchargez vos bulletins de paie
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Year Selector & Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(prev => prev - 1)}
            disabled={selectedYear <= currentYear - 4}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(prev => prev + 1)}
            disabled={selectedYear >= currentYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bulletins {selectedYear}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Salaire net moyen</p>
                <p className="text-2xl font-bold">
                  {stats.avgNet > 0 ? formatCurrency(stats.avgNet) : '-'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total net {selectedYear}</p>
                <p className="text-2xl font-bold">
                  {stats.totalNet > 0 ? formatCurrency(stats.totalNet) : '-'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Euro className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Bulletins de paie - {selectedYear}</CardTitle>
          <CardDescription>
            Cliquez sur un bulletin pour voir le détail
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : payslips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun bulletin de paie pour {selectedYear}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {payslips.map((payslip) => {
                const statusConfig = STATUS_CONFIG[payslip.status];

                return (
                  <Card
                    key={payslip.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                    onClick={() => handleViewDetail(payslip.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {MONTHS_FR[payslip.month - 1]}
                          </span>
                        </div>
                        <Badge className={statusConfig.className} variant="outline">
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Brut</span>
                          <span>{formatCurrency(payslip.gross_salary)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Retenues</span>
                          <span className="text-red-600">
                            -{formatCurrency(payslip.cnss_employee + payslip.amo_employee + payslip.igr)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-medium">Net</span>
                          <span className="font-bold text-green-700">
                            {formatCurrency(payslip.net_salary)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleViewDetail(payslip.id); }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Détail
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDownload(payslip.id); }}
                          disabled={downloadMutation.isPending}
                        >
                          {downloadMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <PayslipDetailModal
        payslipId={detailPayslipId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDownload={handleDownload}
      />
    </div>
  );
}
