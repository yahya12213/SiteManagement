import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/lib/api/student';
import type { VideoProgressInput } from '@/lib/api/student';

// ============================================
// Query Keys
// ============================================
export const studentKeys = {
    all: ['student'] as const,
    profile: () => [...studentKeys.all, 'profile'] as const,
    dashboard: () => [...studentKeys.all, 'dashboard'] as const,
    formations: () => [...studentKeys.all, 'formations'] as const,
    videos: () => [...studentKeys.all, 'videos'] as const,
    publicFormations: () => ['public', 'formations'] as const,
    formationDetails: (slug: string) => ['public', 'formation', slug] as const,
};

// ============================================
// Public Hooks
// ============================================

export function usePublicFormations() {
    return useQuery({
        queryKey: studentKeys.publicFormations(),
        queryFn: () => studentApi.getPublicFormations(),
    });
}

export function useFormationDetails(slug: string | undefined) {
    return useQuery({
        queryKey: studentKeys.formationDetails(slug || ''),
        queryFn: () => studentApi.getFormationDetails(slug!),
        enabled: !!slug,
    });
}

export function usePublicCities() {
    return useQuery({
        queryKey: ['public', 'cities'],
        queryFn: () => studentApi.getCities(),
    });
}

// ============================================
// Authenticated Student Hooks
// ============================================

export function useStudentProfile() {
    return useQuery({
        queryKey: studentKeys.profile(),
        queryFn: () => studentApi.getProfile(),
        retry: false, // Don't retry if 401
    });
}

export function useStudentDashboard() {
    return useQuery({
        queryKey: studentKeys.dashboard(),
        queryFn: () => studentApi.getDashboard(),
    });
}

export function useMyFormations() {
    return useQuery({
        queryKey: studentKeys.formations(),
        queryFn: () => studentApi.getMyFormations(),
    });
}

export function useStudentFormation(id: string | undefined) {
    return useQuery({
        queryKey: [...studentKeys.formations(), id],
        queryFn: () => studentApi.getStudentFormation(id!),
        enabled: !!id,
    });
}

export function useMyVideos() {
    return useQuery({
        queryKey: studentKeys.videos(),
        queryFn: () => studentApi.getMyVideos(),
    });
}

export function useUpdateVideoProgress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ videoId, data }: { videoId: number; data: VideoProgressInput }) =>
            studentApi.updateVideoProgress(videoId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentKeys.videos() });
            queryClient.invalidateQueries({ queryKey: studentKeys.dashboard() });
        },
    });
}
