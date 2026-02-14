/**
 * Gestion de Paie (PayrollManagement) - Version Simplifiée
 * Interface unique avec workflow linéaire pour le calcul de paie
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { PERMISSIONS } from '@/config/permissions';
import { useToast } from '@/hooks/use-toast';
import { Settings, Calculator, Loader2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  usePayrollPeriods,
  useCalculatePayroll,
  useValidatePayslip,
  useValidateAllPayslips,
  useDownloadPayslipPdf,
  useExportCNSS,
  useExportBankTransfers,
  useDownloadPayslipsZip,
} from '@/hooks/usePayroll';

// Nouveaux composants
import { PeriodSelector } from '@/components/admin/hr/payroll/PeriodSelector';
import { SegmentFilter } from '@/components/admin/hr/payroll/SegmentFilter';
import { EmployeeChecklistTable } from '@/components/admin/hr/payroll/EmployeeChecklistTable';
import { PayslipsList } from '@/components/admin/hr/payroll/PayslipsList';
import { PayslipDetailModal } from '@/components/admin/hr/payroll/PayslipDetailModal';
import { DocumentsManagement } from '@/components/admin/hr/payroll/DocumentsManagement';

export function PayrollManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // États
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [detailPayslipId, setDetailPayslipId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);

  // Récupérer les périodes
  const { data: periodsData } = usePayrollPeriods();
  const periods = periodsData?.periods || [];

  // Trouver la période sélectionnée
  const selectedPeriod = periods.find(
    (p) => p.year === selectedYear && p.month === selectedMonth
  );

  // Mutations
  const calculatePayroll = useCalculatePayroll();
  const validatePayslip = useValidatePayslip();
  const validateAllPayslips = useValidateAllPayslips();
  const downloadPdf = useDownloadPayslipPdf();
  const exportCNSS = useExportCNSS();
  const exportBankTransfers = useExportBankTransfers();
  const downloadZip = useDownloadPayslipsZip();

  // Handlers
  const handleCalculate = async () => {
    if (!selectedPeriod) {
      toast({
        title: 'Erreur',
        description: 'Aucune période trouvée pour cette date',
        variant: 'destructive',
      });
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner au moins un employé',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await calculatePayroll.mutateAsync({
        periodId: selectedPeriod.id,
        options: { employee_ids: selectedEmployeeIds },
      });

      toast({
        title: 'Calcul terminé',
        description: `${(result as any).employees_processed || 0} bulletin(s) généré(s). Total net: ${Number((result as any).total_net || 0).toFixed(2)} MAD`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors du calcul',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetail = (payslipId: string) => {
    setDetailPayslipId(payslipId);
    setIsDetailModalOpen(true);
  };

  const handleValidatePayslip = async (payslipId: string) => {
    try {
      await validatePayslip.mutateAsync(payslipId);
      toast({
        title: 'Succès',
        description: 'Bulletin validé avec succès',
      });
      setIsDetailModalOpen(false);
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la validation',
        variant: 'destructive',
      });
    }
  };

  const handleValidateAll = async () => {
    if (!selectedPeriod) return;

    try {
      await validateAllPayslips.mutateAsync(selectedPeriod.id);
      toast({
        title: 'Succès',
        description: 'Tous les bulletins ont été validés',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la validation',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPdf = async (payslipId: string) => {
    try {
      await downloadPdf.mutateAsync(payslipId);
      toast({
        title: 'Téléchargement',
        description: 'Le bulletin a été téléchargé',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors du téléchargement',
        variant: 'destructive',
      });
    }
  };

  const handleExportCNSS = async () => {
    if (!selectedPeriod) return;

    try {
      await exportCNSS.mutateAsync(selectedPeriod.id);
      toast({
        title: 'Export CNSS',
        description: 'La déclaration CNSS a été téléchargée',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'export',
        variant: 'destructive',
      });
    }
  };

  const handleExportBankTransfers = async () => {
    if (!selectedPeriod) return;

    try {
      await exportBankTransfers.mutateAsync(selectedPeriod.id);
      toast({
        title: 'Export Virements',
        description: 'Le fichier des virements a été téléchargé',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'export',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedPeriod) return;

    try {
      await downloadZip.mutateAsync(selectedPeriod.id);
      toast({
        title: 'Téléchargement ZIP',
        description: 'L\'archive des bulletins a été téléchargée',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors du téléchargement',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* En-tête */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Gestion de Paie</h1>
              <p className="text-gray-600 mt-1">
                Calcul et gestion des bulletins de paie
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_paie.attestations.voir}
                variant="outline"
                onClick={() => setShowDocumentsModal(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents RH
              </ProtectedButton>
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_paie.configuration.voir}
                variant="outline"
                onClick={() => navigate('/admin/hr/payroll/configuration')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </ProtectedButton>
            </div>
          </div>
        </Card>

        {/* Section Période */}
        <PeriodSelector
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          periodStatus={selectedPeriod?.status}
        />

        {/* Section Segment */}
        <SegmentFilter
          selectedSegmentId={selectedSegmentId}
          onSegmentChange={setSelectedSegmentId}
        />

        {/* Section Employés */}
        <EmployeeChecklistTable
          segmentFilter={selectedSegmentId}
          selectedIds={selectedEmployeeIds}
          onSelectionChange={setSelectedEmployeeIds}
        />

        {/* Section Actions */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_paie.calculs.calculer}
                onClick={handleCalculate}
                disabled={
                  calculatePayroll.isPending ||
                  selectedEmployeeIds.length === 0 ||
                  !selectedPeriod
                }
              >
                {calculatePayroll.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calcul en cours...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculer la Paie
                  </>
                )}
              </ProtectedButton>

              {selectedPeriod && (selectedPeriod.status === 'calculated' || selectedPeriod.status === 'validated') && (
                <p className="text-sm text-gray-600 flex items-center">
                  {selectedPeriod.total_employees || 0} bulletin(s) généré(s) •{' '}
                  Net total: {Number(selectedPeriod.total_net || 0).toFixed(2)} MAD
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Section Bulletins */}
        {selectedPeriod && (selectedPeriod.status === 'calculated' || selectedPeriod.status === 'validated' || selectedPeriod.status === 'closed') && (
          <PayslipsList
            periodId={selectedPeriod.id}
            onViewDetail={handleViewDetail}
            onValidate={handleValidatePayslip}
            onDownloadPdf={handleDownloadPdf}
            onValidateAll={handleValidateAll}
            onExportCNSS={handleExportCNSS}
            onExportBankTransfers={handleExportBankTransfers}
            onDownloadZip={handleDownloadZip}
            canValidate={true}
            canExport={true}
          />
        )}

        {/* Modal Détail Bulletin */}
        <PayslipDetailModal
          payslipId={detailPayslipId}
          open={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailPayslipId(null);
          }}
          onValidate={
            detailPayslipId ? () => handleValidatePayslip(detailPayslipId) : undefined
          }
          onDownloadPdf={
            detailPayslipId ? () => handleDownloadPdf(detailPayslipId) : undefined
          }
          canValidate={true}
        />

        {/* Modal Documents RH (Attestations + Disciplinaire) */}
        {showDocumentsModal && (
          <DocumentsManagement
            onClose={() => setShowDocumentsModal(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}
