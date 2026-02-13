import { apiClient } from './client';

// ==================== INTERFACES ====================

export interface ForumThread {
  id: string;
  formation_id: string;
  author_id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  author_name?: string;
  author_email?: string;
  formation_title?: string;
  post_count?: number;
  last_post_at?: string | null;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  is_edited: boolean;
  parent_post_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  author_name?: string;
  author_email?: string;
  author_role?: string;
  reactions?: ReactionSummary[] | null;
}

export interface ForumReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: 'like' | 'helpful' | 'insightful';
  created_at: string;
  // Joined data
  user_name?: string;
}

export interface ReactionSummary {
  reaction_type: string;
  count: number;
}

export interface ForumStats {
  total_threads: number;
  total_posts: number;
  total_reactions: number;
  active_thread_creators: number;
  active_posters: number;
}

// ==================== INPUT TYPES ====================

export interface CreateThreadInput {
  author_id: string;
  title: string;
  content?: string;
}

export interface UpdateThreadInput {
  title?: string;
  content?: string;
  author_id: string;
}

export interface CreatePostInput {
  author_id: string;
  content: string;
  parent_post_id?: string;
}

export interface UpdatePostInput {
  content: string;
  author_id: string;
}

export interface CreateReactionInput {
  user_id: string;
  reaction_type: 'like' | 'helpful' | 'insightful';
}

// ==================== API METHODS ====================

export const forumsApi = {
  // ==================== THREAD OPERATIONS ====================

  /**
   * Get all threads for a formation
   */
  getThreads: async (
    formationId: string,
    params?: {
      sort?: 'recent' | 'popular' | 'active';
      pinned?: 'true' | 'false';
    }
  ): Promise<{ threads: ForumThread[]; count: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.pinned) queryParams.append('pinned', params.pinned);

    const url = `/forums/${formationId}/threads${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return apiClient.get(url);
  },

  /**
   * Create a new thread in a formation
   */
  createThread: async (
    formationId: string,
    data: CreateThreadInput
  ): Promise<{ thread: ForumThread }> => {
    return apiClient.post(`/forums/${formationId}/threads`, data);
  },

  /**
   * Get thread details by ID
   */
  getThread: async (threadId: string): Promise<{ thread: ForumThread }> => {
    return apiClient.get(`/forums/threads/${threadId}`);
  },

  /**
   * Update a thread
   */
  updateThread: async (
    threadId: string,
    data: UpdateThreadInput
  ): Promise<{ thread: ForumThread }> => {
    return apiClient.put(`/forums/threads/${threadId}`, data);
  },

  /**
   * Delete a thread
   */
  deleteThread: async (
    threadId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(
      `/forums/threads/${threadId}?user_id=${userId}&is_admin=${isAdmin}`
    );
  },

  /**
   * Pin or unpin a thread (admin only)
   */
  pinThread: async (
    threadId: string,
    isPinned: boolean
  ): Promise<{ thread: ForumThread }> => {
    return apiClient.patch(`/forums/threads/${threadId}/pin`, {
      is_pinned: isPinned,
    });
  },

  /**
   * Lock or unlock a thread (admin only)
   */
  lockThread: async (
    threadId: string,
    isLocked: boolean
  ): Promise<{ thread: ForumThread }> => {
    return apiClient.patch(`/forums/threads/${threadId}/lock`, {
      is_locked: isLocked,
    });
  },

  /**
   * Increment view count for a thread
   */
  incrementViewCount: async (threadId: string): Promise<{ success: boolean }> => {
    return apiClient.patch(`/forums/threads/${threadId}/view`, {});
  },

  // ==================== POST OPERATIONS ====================

  /**
   * Get all posts in a thread
   */
  getPosts: async (
    threadId: string
  ): Promise<{ posts: ForumPost[]; count: number }> => {
    return apiClient.get(`/forums/threads/${threadId}/posts`);
  },

  /**
   * Create a new post (reply) in a thread
   */
  createPost: async (
    threadId: string,
    data: CreatePostInput
  ): Promise<{ post: ForumPost }> => {
    return apiClient.post(`/forums/threads/${threadId}/posts`, data);
  },

  /**
   * Update a post
   */
  updatePost: async (
    postId: string,
    data: UpdatePostInput
  ): Promise<{ post: ForumPost }> => {
    return apiClient.put(`/forums/posts/${postId}`, data);
  },

  /**
   * Delete a post
   */
  deletePost: async (
    postId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(
      `/forums/posts/${postId}?user_id=${userId}&is_admin=${isAdmin}`
    );
  },

  // ==================== REACTION OPERATIONS ====================

  /**
   * Add a reaction to a post
   */
  addReaction: async (
    postId: string,
    data: CreateReactionInput
  ): Promise<{ reaction: ForumReaction }> => {
    return apiClient.post(`/forums/posts/${postId}/reactions`, data);
  },

  /**
   * Remove a reaction from a post
   */
  removeReaction: async (
    postId: string,
    userId: string,
    reactionType: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(
      `/forums/posts/${postId}/reactions/${reactionType}?user_id=${userId}`
    );
  },

  /**
   * Get all reactions for a post
   */
  getReactions: async (
    postId: string
  ): Promise<{ reactions: ForumReaction[] }> => {
    return apiClient.get(`/forums/posts/${postId}/reactions`);
  },

  // ==================== STATS ====================

  /**
   * Get forum statistics
   */
  getStats: async (): Promise<{ stats: ForumStats }> => {
    return apiClient.get('/forums/stats');
  },
};
