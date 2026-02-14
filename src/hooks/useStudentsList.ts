import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// Interface pour les formations
export interface FormationForAssignment {
  id: string;
  title: string;
  description?: string;
  price: number | string;
  corps_formation_id?: string;
  is_pack?: boolean;
}

export interface StudentWithSession {
  id: string;
  nom: string;
  prenom: string;
  cin: string;
  phone: string;
  email: string | null;
  statut_compte: string;
  profile_image_url: string | null;
  enrollment_id: string | null;
  session_id: string | null;
  statut_paiement: string | null;
  montant_total: number | null;
  montant_paye: number | null;
  montant_du: number | null;
  session_titre: string | null;
  session_type: 'presentielle' | 'en_ligne' | null;
  session_statut: string | null;
  ville: string | null;
  formation_titre: string | null;
  has_session: boolean;
  created_at: string | null;
}

export interface StudentsListStats {
  total: number;
  withSession: number;
  withoutSession: number;
}

const studentsListKeys = {
  all: ['students-list'] as const,
  withSessions: () => [...studentsListKeys.all, 'with-sessions'] as const,
};

export function useStudentsWithSessions() {
  return useQuery({
    queryKey: studentsListKeys.withSessions(),
    queryFn: async () => {
      return apiClient.get<StudentWithSession[]>('/students/with-sessions');
    },
  });
}

export function useStudentsListStats(students: StudentWithSession[] | undefined): StudentsListStats {
  if (!students) {
    return { total: 0, withSession: 0, withoutSession: 0 };
  }

  const withSession = students.filter(s => s.has_session).length;
  const withoutSession = students.filter(s => !s.has_session).length;

  return {
    total: students.length,
    withSession,
    withoutSession,
  };
}

// Hook pour récupérer les formations par corps_formation_id
export function useFormationsByCorps(corpsFormationId: string | null | undefined) {
  return useQuery({
    queryKey: ['formations', 'by-corps', corpsFormationId],
    queryFn: async () => {
      if (!corpsFormationId) return [];
      return apiClient.get<FormationForAssignment[]>(`/cours?corps_id=${corpsFormationId}`);
    },
    enabled: !!corpsFormationId,
  });
}

// Hook pour affecter un étudiant à une session
export function useAssignStudentToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, studentId, formationId, montantTotal }: {
      sessionId: string;
      studentId: string;
      formationId: string;
      montantTotal: number;
    }) => {
      return apiClient.post(`/sessions-formation/${sessionId}/etudiants`, {
        student_id: studentId,
        formation_id: formationId,
        montant_total: montantTotal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsListKeys.all });
      queryClient.invalidateQueries({ queryKey: ['sessions-formation'] });
    },
  });
}
