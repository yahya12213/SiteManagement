import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Circle, Clock, CheckCircle2, User, Calendar } from 'lucide-react';
import { useProjectActions } from '@/hooks/useProjects';
import type { Project } from '@/lib/api/projects';

interface ViewActionsModalProps {
  project: Project | null;
  onClose: () => void;
}

const ACTION_STATUS = [
  { value: 'a_faire', label: 'À faire', color: 'bg-gray-100 text-gray-800', icon: Circle },
  { value: 'en_cours', label: 'En cours', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  { value: 'termine', label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
];

export default function ViewActionsModal({ project, onClose }: ViewActionsModalProps) {
  const { data: actions = [], isLoading } = useProjectActions(project?.id);

  if (!project) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Non défini';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actions du projet: {project.name}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Chargement des actions...
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune action allouée à ce projet
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map((action: any) => {
                const statusInfo = ACTION_STATUS.find((s) => s.value === action.status);
                const StatusIcon = statusInfo?.icon || Circle;

                return (
                  <div
                    key={action.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4" />
                          <p className="font-medium">{action.description}</p>
                        </div>

                        {action.description_detail && (
                          <p className="text-sm text-gray-600 ml-6">
                            {action.description_detail}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 ml-6 text-sm text-gray-600">
                          {action.pilote_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Pilote: {action.pilote_name}</span>
                            </div>
                          )}

                          {action.deadline && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Échéance: {formatDate(action.deadline)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Badge className={statusInfo?.color}>
                        {statusInfo?.label || action.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
