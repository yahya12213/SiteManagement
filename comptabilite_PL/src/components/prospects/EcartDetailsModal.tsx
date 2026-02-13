// @ts-nocheck
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, TrendingDown, Info, AlertTriangle, UserCheck, UserX } from 'lucide-react';
import type { EcartDetailsResponse, EcartSessionStudent, EcartProspectStudent } from '@/lib/api/prospects';

interface Props {
  open: boolean;
  onClose: () => void;
  data: EcartDetailsResponse | null;
  isLoading: boolean;
  error?: string | null;
}

export function EcartDetailsModal({ open, onClose, data, isLoading, error }: Props) {
  const [activeTab, setActiveTab] = useState<'session' | 'prospect'>('session');

  const ecartSessionCount = data?.ecart_session?.count || 0;
  const ecartProspectCount = data?.ecart_prospect?.count || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Détails des Écarts
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-3" />
            <p className="text-red-600 font-medium">Erreur lors du chargement</p>
            <p className="text-sm text-gray-500 mt-2 text-center max-w-md">{error}</p>
          </div>
        ) : isLoading || !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Chargement des détails...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Écart Session</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{ecartSessionCount}</p>
                <p className="text-xs text-green-700 mt-1">
                  Étudiants en session sans prospect "inscrit"
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserX className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-800">Écart Prospect</span>
                </div>
                <p className="text-3xl font-bold text-orange-600">{ecartProspectCount}</p>
                <p className="text-xs text-orange-700 mt-1">
                  Prospects "inscrit" sans session
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-2">
              <Button
                variant={activeTab === 'session' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('session')}
                className={activeTab === 'session' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Écart Session ({ecartSessionCount})
              </Button>
              <Button
                variant={activeTab === 'prospect' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('prospect')}
                className={activeTab === 'prospect' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                <UserX className="h-4 w-4 mr-2" />
                Écart Prospect ({ecartProspectCount})
              </Button>
            </div>

            {/* Tab Content */}
            {activeTab === 'session' ? (
              <EcartSessionTable students={data.ecart_session?.students || []} />
            ) : (
              <EcartProspectTable students={data.ecart_prospect?.students || []} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Table pour l'écart Session (étudiants en session sans prospect)
function EcartSessionTable({ students }: { students: EcartSessionStudent[] }) {
  if (students.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Aucun écart session</p>
        <p className="text-sm text-gray-500 mt-1">
          Tous les étudiants en session ont un prospect "inscrit" correspondant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-sm p-3 bg-green-50 rounded-lg border border-green-200">
        <Info className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
        <p className="text-green-800">
          Ces étudiants sont inscrits dans des sessions de formation mais <strong>n'ont pas</strong> de prospect
          correspondant avec le statut "inscrit". Cela peut indiquer des inscriptions directes ou des prospects
          avec un autre statut.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[350px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CIN
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student, index) => (
                <tr key={student.student_id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.nom || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.prenom || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {student.cin || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                    {student.phone || student.whatsapp || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {student.sessions && student.sessions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {student.sessions.map((session, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            title={`Inscrit le ${new Date(session.enrolled_at).toLocaleDateString('fr-FR')}`}
                          >
                            {session.session_name} ({session.ville_name})
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center pt-2 pb-1">
        {students.length} {students.length > 1 ? 'étudiants trouvés' : 'étudiant trouvé'} dans l'écart session
      </div>
    </div>
  );
}

// Table pour l'écart Prospect (prospects "inscrit" sans session)
function EcartProspectTable({ students }: { students: EcartProspectStudent[] }) {
  if (students.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <UserX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Aucun écart prospect</p>
        <p className="text-sm text-gray-500 mt-1">
          Tous les prospects "inscrit" sont bien inscrits dans une session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-sm p-3 bg-orange-50 rounded-lg border border-orange-200">
        <Info className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
        <p className="text-orange-800">
          Ces prospects sont marqués comme "inscrit" mais <strong>ne sont pas</strong> inscrits dans des sessions
          de formation actives. Vérifiez s'ils ont annulé ou si l'inscription n'a pas été finalisée.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[350px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ville
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Injection
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student, index) => (
                <tr key={student.prospect_id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.nom || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.prenom || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                    {student.phone_international || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {student.ville_name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {student.segment_name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {student.date_injection
                      ? new Date(student.date_injection).toLocaleDateString('fr-FR')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center pt-2 pb-1">
        {students.length} {students.length > 1 ? 'prospects trouvés' : 'prospect trouvé'} dans l'écart prospect
      </div>
    </div>
  );
}
