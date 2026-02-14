import { djangoClient } from './django';
import type { Formation } from '@/types/cours';

// Types for Student API responses
export interface StudentProfile {
    id: string;
    user: {
        id: string;
        username: string;
        email: string;
        full_name: string;
    };
    full_name: string;
    role: string;
    status: string;
    phone_number: string;
    city: {
        id: number;
        name: string;
    } | null;
    profile_picture?: string;
}

export interface StudentDashboardData {
    profile: StudentProfile;
    student_profile: {
        amount_paid: string;
        total_amount_due: string;
        amount_remaining: string;
    };
    authorized_formations: Formation[];
    session: any; // Define precise type if needed
    upcoming_seances: any[];
    video_progress_summary: {
        total_videos: number;
        completed_videos: number;
        total_watch_time_seconds: number;
    };
}

export interface VideoProgressInput {
    watched_seconds: number;
    completed: boolean;
}

export const studentApi = {
    // Public Endpoints
    getPublicFormations: () =>
        djangoClient.get<any>('/public/formations').then((res: { data: any }) =>
            // In case it returns PaginatedResponse { count, results } or direct array
            Array.isArray(res.data) ? res.data : (res.data as any).results || []
        ),

    getFormationDetails: (slug: string) =>
        djangoClient.get<Formation>(`/public/formations/${slug}`),

    getCities: () =>
        djangoClient.get<any[]>('/public/cities'),

    submitContactRequest: (data: any) =>
        djangoClient.post<any>('/contact/', data),

    submitPreInscription: (data: any) =>
        djangoClient.post<any>('/pre-inscription/', data),

    // Authenticated Endpoints
    getProfile: () =>
        djangoClient.get<StudentProfile>('/student/profile/'),

    getDashboard: () =>
        djangoClient.get<StudentDashboardData>('/student/dashboard/'),

    getMyFormations: () =>
        djangoClient.get<Formation[]>('/student/formations/'),

    getStudentFormation: (id: string) =>
        djangoClient.get<Formation>(`/student/formations/${id}/`),

    getMyVideos: () =>
        djangoClient.get<any[]>('/student/videos/'),

    updateVideoProgress: (videoId: number, data: VideoProgressInput) =>
        djangoClient.post<{ success: boolean }>(`/student/videos/${videoId}/progress/`, data),
};
