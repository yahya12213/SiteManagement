import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumsApi } from '@/lib/api/forums';
import type {
  CreateThreadInput,
  UpdateThreadInput,
  CreatePostInput,
  UpdatePostInput,
  CreateReactionInput,
} from '@/lib/api/forums';

// ==================== QUERY KEYS ====================

export const forumKeys = {
  all: ['forums'] as const,
  threads: (formationId: string) => ['forums', 'threads', formationId] as const,
  thread: (threadId: string) => ['forums', 'thread', threadId] as const,
  posts: (threadId: string) => ['forums', 'posts', threadId] as const,
  reactions: (postId: string) => ['forums', 'reactions', postId] as const,
  stats: () => ['forums', 'stats'] as const,
};

// ==================== THREAD HOOKS ====================

/**
 * Get all threads for a formation
 */
export const useForumThreads = (
  formationId: string | null,
  params?: {
    sort?: 'recent' | 'popular' | 'active';
    pinned?: 'true' | 'false';
  }
) => {
  return useQuery({
    queryKey: [...forumKeys.threads(formationId || ''), params],
    queryFn: () => {
      if (!formationId) throw new Error('Formation ID is required');
      return forumsApi.getThreads(formationId, params);
    },
    enabled: !!formationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Get a single thread by ID
 */
export const useForumThread = (threadId: string | null) => {
  return useQuery({
    queryKey: forumKeys.thread(threadId || ''),
    queryFn: () => {
      if (!threadId) throw new Error('Thread ID is required');
      return forumsApi.getThread(threadId);
    },
    enabled: !!threadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Create a new thread
 */
export const useCreateThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      formationId,
      data,
    }: {
      formationId: string;
      data: CreateThreadInput;
    }) => forumsApi.createThread(formationId, data),
    onSuccess: (_data, variables) => {
      // Invalidate threads list for this formation
      queryClient.invalidateQueries({
        queryKey: forumKeys.threads(variables.formationId),
      });
    },
  });
};

/**
 * Update a thread
 */
export const useUpdateThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      data,
    }: {
      threadId: string;
      data: UpdateThreadInput;
    }) => forumsApi.updateThread(threadId, data),
    onSuccess: (_data, variables) => {
      // Invalidate specific thread
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(variables.threadId),
      });
      // Invalidate all threads queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Delete a thread
 */
export const useDeleteThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      userId,
      isAdmin,
    }: {
      threadId: string;
      userId: string;
      isAdmin?: boolean;
    }) => forumsApi.deleteThread(threadId, userId, isAdmin),
    onSuccess: () => {
      // Invalidate all threads queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Pin/unpin a thread
 */
export const usePinThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      isPinned,
    }: {
      threadId: string;
      isPinned: boolean;
    }) => forumsApi.pinThread(threadId, isPinned),
    onSuccess: (_data, variables) => {
      // Invalidate specific thread
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(variables.threadId),
      });
      // Invalidate all threads queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Lock/unlock a thread
 */
export const useLockThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      isLocked,
    }: {
      threadId: string;
      isLocked: boolean;
    }) => forumsApi.lockThread(threadId, isLocked),
    onSuccess: (_data, variables) => {
      // Invalidate specific thread
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(variables.threadId),
      });
      // Invalidate all threads queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Increment thread view count
 */
export const useIncrementViewCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => forumsApi.incrementViewCount(threadId),
    onSuccess: (_data, threadId) => {
      // Invalidate specific thread
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(threadId),
      });
    },
  });
};

// ==================== POST HOOKS ====================

/**
 * Get all posts in a thread
 */
export const useForumPosts = (threadId: string | null) => {
  return useQuery({
    queryKey: forumKeys.posts(threadId || ''),
    queryFn: () => {
      if (!threadId) throw new Error('Thread ID is required');
      return forumsApi.getPosts(threadId);
    },
    enabled: !!threadId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Create a new post (reply)
 */
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      data,
    }: {
      threadId: string;
      data: CreatePostInput;
    }) => forumsApi.createPost(threadId, data),
    onSuccess: (_data, variables) => {
      // Invalidate posts list for this thread
      queryClient.invalidateQueries({
        queryKey: forumKeys.posts(variables.threadId),
      });
      // Invalidate thread details (updates post count, last_post_at)
      queryClient.invalidateQueries({
        queryKey: forumKeys.thread(variables.threadId),
      });
      // Invalidate threads list (updates updated_at)
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Update a post
 */
export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: UpdatePostInput }) =>
      forumsApi.updatePost(postId, data),
    onSuccess: () => {
      // Invalidate all posts queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Delete a post
 */
export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      userId,
      isAdmin,
    }: {
      postId: string;
      userId: string;
      isAdmin?: boolean;
    }) => forumsApi.deletePost(postId, userId, isAdmin),
    onSuccess: () => {
      // Invalidate all posts queries
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

// ==================== REACTION HOOKS ====================

/**
 * Get reactions for a post
 */
export const usePostReactions = (postId: string | null) => {
  return useQuery({
    queryKey: forumKeys.reactions(postId || ''),
    queryFn: () => {
      if (!postId) throw new Error('Post ID is required');
      return forumsApi.getReactions(postId);
    },
    enabled: !!postId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Add a reaction to a post
 */
export const useAddReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: CreateReactionInput }) =>
      forumsApi.addReaction(postId, data),
    onSuccess: (_data, variables) => {
      // Invalidate reactions for this post
      queryClient.invalidateQueries({
        queryKey: forumKeys.reactions(variables.postId),
      });
      // Invalidate posts to update reaction counts
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

/**
 * Remove a reaction from a post
 */
export const useRemoveReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      userId,
      reactionType,
    }: {
      postId: string;
      userId: string;
      reactionType: string;
    }) => forumsApi.removeReaction(postId, userId, reactionType),
    onSuccess: (_data, variables) => {
      // Invalidate reactions for this post
      queryClient.invalidateQueries({
        queryKey: forumKeys.reactions(variables.postId),
      });
      // Invalidate posts to update reaction counts
      queryClient.invalidateQueries({
        queryKey: forumKeys.all,
      });
    },
  });
};

// ==================== STATS HOOKS ====================

/**
 * Get forum statistics
 */
export const useForumStats = () => {
  return useQuery({
    queryKey: forumKeys.stats(),
    queryFn: () => forumsApi.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
