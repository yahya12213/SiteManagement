import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// ==================== THREAD ENDPOINTS ====================

/**
 * GET /api/forums/:formationId/threads
 * Get all threads for a formation with author info and stats
 * Protected: Requires training.forums.view permission
 */
router.get('/:formationId/threads',
  authenticateToken,
  requirePermission('training.forums.view'),
  async (req, res) => {
  try {
    const { formationId } = req.params;
    const { sort = 'recent', pinned = 'true' } = req.query;

    let orderBy = 'ft.created_at DESC';
    if (sort === 'popular') {
      orderBy = 'ft.view_count DESC, ft.created_at DESC';
    } else if (sort === 'active') {
      orderBy = 'ft.updated_at DESC';
    }

    const query = `
      SELECT
        ft.*,
        p.full_name as author_name,
        p.email as author_email,
        (SELECT COUNT(*) FROM forum_posts WHERE thread_id = ft.id) as post_count,
        (SELECT MAX(created_at) FROM forum_posts WHERE thread_id = ft.id) as last_post_at
      FROM forum_threads ft
      JOIN profiles p ON ft.author_id = p.id
      WHERE ft.formation_id = $1
      ORDER BY
        ${pinned === 'true' ? 'ft.is_pinned DESC,' : ''}
        ${orderBy}
    `;

    const result = await pool.query(query, [formationId]);

    res.json({
      success: true,
      threads: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threads',
    });
  }
});

/**
 * POST /api/forums/:formationId/threads
 * Create a new thread in a formation
 * Protected: Requires training.forums.create_thread permission
 */
router.post('/:formationId/threads',
  authenticateToken,
  requirePermission('training.forums.create_thread'),
  async (req, res) => {
  try {
    const { formationId } = req.params;
    const { author_id, title, content } = req.body;

    if (!author_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'Author ID and title are required',
      });
    }

    // Verify formation exists
    const formationCheck = await pool.query(
      'SELECT id FROM formations WHERE id = $1',
      [formationId]
    );

    if (formationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Formation not found',
      });
    }

    const result = await pool.query(
      `INSERT INTO forum_threads (formation_id, author_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [formationId, author_id, title, content]
    );

    // Get thread with author info
    const threadWithAuthor = await pool.query(
      `SELECT
        ft.*,
        p.full_name as author_name,
        p.email as author_email
      FROM forum_threads ft
      JOIN profiles p ON ft.author_id = p.id
      WHERE ft.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      success: true,
      thread: threadWithAuthor.rows[0],
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create thread',
    });
  }
});

/**
 * GET /api/forums/threads/:threadId
 * Get thread details with author info
 * Protected: Requires training.forums.view permission
 */
router.get('/threads/:threadId',
  authenticateToken,
  requirePermission('training.forums.view'),
  async (req, res) => {
  try {
    const { threadId } = req.params;

    const result = await pool.query(
      `SELECT
        ft.*,
        p.full_name as author_name,
        p.email as author_email,
        f.title as formation_title,
        (SELECT COUNT(*) FROM forum_posts WHERE thread_id = ft.id) as post_count
      FROM forum_threads ft
      JOIN profiles p ON ft.author_id = p.id
      JOIN formations f ON ft.formation_id = f.id
      WHERE ft.id = $1`,
      [threadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    res.json({
      success: true,
      thread: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thread',
    });
  }
});

/**
 * PUT /api/forums/threads/:threadId
 * Update thread (title, content)
 * Protected: Requires training.forums.update_thread permission
 */
router.put('/threads/:threadId',
  authenticateToken,
  requirePermission('training.forums.update_thread'),
  async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title, content, author_id } = req.body;

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT author_id FROM forum_threads WHERE id = $1',
      [threadId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    if (ownerCheck.rows[0].author_id !== author_id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit this thread',
      });
    }

    const result = await pool.query(
      `UPDATE forum_threads
       SET title = COALESCE($1, title),
           content = COALESCE($2, content)
       WHERE id = $3
       RETURNING *`,
      [title, content, threadId]
    );

    res.json({
      success: true,
      thread: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update thread',
    });
  }
});

/**
 * DELETE /api/forums/threads/:threadId
 * Delete thread (cascade deletes posts and reactions)
 * Protected: Requires training.forums.delete permission
 */
router.delete('/threads/:threadId',
  authenticateToken,
  requirePermission('training.forums.delete'),
  async (req, res) => {
  try {
    const { threadId } = req.params;
    const { user_id, is_admin } = req.query;

    // Verify ownership or admin
    const ownerCheck = await pool.query(
      'SELECT author_id FROM forum_threads WHERE id = $1',
      [threadId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    if (ownerCheck.rows[0].author_id !== user_id && is_admin !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this thread',
      });
    }

    await pool.query('DELETE FROM forum_threads WHERE id = $1', [threadId]);

    res.json({
      success: true,
      message: 'Thread deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete thread',
    });
  }
});

/**
 * PATCH /api/forums/threads/:threadId/pin
 * Pin or unpin a thread (admin only)
 * Protected: Requires training.forums.manage permission
 */
router.patch('/threads/:threadId/pin',
  authenticateToken,
  requirePermission('training.forums.manage'),
  async (req, res) => {
  try {
    const { threadId } = req.params;
    const { is_pinned } = req.body;

    const result = await pool.query(
      'UPDATE forum_threads SET is_pinned = $1 WHERE id = $2 RETURNING *',
      [is_pinned, threadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    res.json({
      success: true,
      thread: result.rows[0],
    });
  } catch (error) {
    console.error('Error pinning thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pin thread',
    });
  }
});

/**
 * PATCH /api/forums/threads/:threadId/lock
 * Lock or unlock a thread (admin only)
 * Protected: Requires training.forums.manage permission
 */
router.patch('/threads/:threadId/lock',
  authenticateToken,
  requirePermission('training.forums.manage'),
  async (req, res) => {
  try {
    const { threadId } = req.params;
    const { is_locked } = req.body;

    const result = await pool.query(
      'UPDATE forum_threads SET is_locked = $1 WHERE id = $2 RETURNING *',
      [is_locked, threadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    res.json({
      success: true,
      thread: result.rows[0],
    });
  } catch (error) {
    console.error('Error locking thread:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to lock thread',
    });
  }
});

/**
 * PATCH /api/forums/threads/:threadId/view
 * Increment view count for a thread
 * Protected: Requires training.forums.view permission
 */
router.patch('/threads/:threadId/view',
  authenticateToken,
  requirePermission('training.forums.view'),
  async (req, res) => {
  try {
    const { threadId } = req.params;

    await pool.query(
      'UPDATE forum_threads SET view_count = view_count + 1 WHERE id = $1',
      [threadId]
    );

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment view count',
    });
  }
});

// ==================== POST ENDPOINTS ====================

/**
 * GET /api/forums/threads/:threadId/posts
 * Get all posts in a thread with author info and reactions
 * Protected: Requires training.forums.view permission
 */
router.get('/threads/:threadId/posts',
  authenticateToken,
  requirePermission('training.forums.view'),
  async (req, res) => {
  try {
    const { threadId } = req.params;

    const result = await pool.query(
      `SELECT
        fp.*,
        p.full_name as author_name,
        p.email as author_email,
        p.role as author_role,
        (
          SELECT json_agg(json_build_object(
            'reaction_type', reaction_type,
            'count', count
          ))
          FROM (
            SELECT reaction_type, COUNT(*) as count
            FROM forum_reactions
            WHERE post_id = fp.id
            GROUP BY reaction_type
          ) r
        ) as reactions
      FROM forum_posts fp
      JOIN profiles p ON fp.author_id = p.id
      WHERE fp.thread_id = $1
      ORDER BY fp.created_at ASC`,
      [threadId]
    );

    res.json({
      success: true,
      posts: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
    });
  }
});

/**
 * POST /api/forums/threads/:threadId/posts
 * Create a new post (reply) in a thread
 * Protected: Requires training.forums.reply permission
 */
router.post('/threads/:threadId/posts',
  authenticateToken,
  requirePermission('training.forums.reply'),
  async (req, res) => {
  try {
    const { threadId } = req.params;
    const { author_id, content, parent_post_id } = req.body;

    if (!author_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Author ID and content are required',
      });
    }

    // Check if thread is locked
    const threadCheck = await pool.query(
      'SELECT is_locked FROM forum_threads WHERE id = $1',
      [threadId]
    );

    if (threadCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Thread not found',
      });
    }

    if (threadCheck.rows[0].is_locked) {
      return res.status(403).json({
        success: false,
        error: 'Thread is locked',
      });
    }

    const result = await pool.query(
      `INSERT INTO forum_posts (thread_id, author_id, content, parent_post_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [threadId, author_id, content, parent_post_id || null]
    );

    // Update thread's updated_at timestamp
    await pool.query(
      'UPDATE forum_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [threadId]
    );

    // Get post with author info
    const postWithAuthor = await pool.query(
      `SELECT
        fp.*,
        p.full_name as author_name,
        p.email as author_email,
        p.role as author_role
      FROM forum_posts fp
      JOIN profiles p ON fp.author_id = p.id
      WHERE fp.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      success: true,
      post: postWithAuthor.rows[0],
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create post',
    });
  }
});

/**
 * PUT /api/forums/posts/:postId
 * Update a post
 * Protected: Requires training.forums.reply permission
 */
router.put('/posts/:postId',
  authenticateToken,
  requirePermission('training.forums.reply'),
  async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, author_id } = req.body;

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT author_id FROM forum_posts WHERE id = $1',
      [postId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    if (ownerCheck.rows[0].author_id !== author_id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit this post',
      });
    }

    const result = await pool.query(
      `UPDATE forum_posts
       SET content = $1, is_edited = TRUE
       WHERE id = $2
       RETURNING *`,
      [content, postId]
    );

    res.json({
      success: true,
      post: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update post',
    });
  }
});

/**
 * DELETE /api/forums/posts/:postId
 * Delete a post
 * Protected: Requires training.forums.delete permission
 */
router.delete('/posts/:postId',
  authenticateToken,
  requirePermission('training.forums.delete'),
  async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id, is_admin } = req.query;

    // Verify ownership or admin
    const ownerCheck = await pool.query(
      'SELECT author_id FROM forum_posts WHERE id = $1',
      [postId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    if (ownerCheck.rows[0].author_id !== user_id && is_admin !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this post',
      });
    }

    await pool.query('DELETE FROM forum_posts WHERE id = $1', [postId]);

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete post',
    });
  }
});

// ==================== REACTION ENDPOINTS ====================

/**
 * POST /api/forums/posts/:postId/reactions
 * Add a reaction to a post
 * Protected: Requires training.forums.react permission
 */
router.post('/posts/:postId/reactions',
  authenticateToken,
  requirePermission('training.forums.react'),
  async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id, reaction_type } = req.body;

    if (!user_id || !reaction_type) {
      return res.status(400).json({
        success: false,
        error: 'User ID and reaction type are required',
      });
    }

    // Verify post exists
    const postCheck = await pool.query(
      'SELECT id FROM forum_posts WHERE id = $1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    // Insert or update reaction
    const result = await pool.query(
      `INSERT INTO forum_reactions (post_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id, reaction_type) DO NOTHING
       RETURNING *`,
      [postId, user_id, reaction_type]
    );

    res.status(201).json({
      success: true,
      reaction: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add reaction',
    });
  }
});

/**
 * DELETE /api/forums/posts/:postId/reactions/:reactionType
 * Remove a reaction from a post
 * Protected: Requires training.forums.react permission
 */
router.delete('/posts/:postId/reactions/:reactionType',
  authenticateToken,
  requirePermission('training.forums.react'),
  async (req, res) => {
  try {
    const { postId, reactionType } = req.params;
    const { user_id } = req.query;

    await pool.query(
      'DELETE FROM forum_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3',
      [postId, user_id, reactionType]
    );

    res.json({
      success: true,
      message: 'Reaction removed successfully',
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove reaction',
    });
  }
});

/**
 * GET /api/forums/posts/:postId/reactions
 * Get all reactions for a post with user details
 * Protected: Requires training.forums.view permission
 */
router.get('/posts/:postId/reactions',
  authenticateToken,
  requirePermission('training.forums.view'),
  async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      `SELECT
        fr.*,
        p.full_name as user_name
      FROM forum_reactions fr
      JOIN profiles p ON fr.user_id = p.id
      WHERE fr.post_id = $1
      ORDER BY fr.created_at DESC`,
      [postId]
    );

    res.json({
      success: true,
      reactions: result.rows,
    });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reactions',
    });
  }
});

// ==================== ADMIN/STATS ENDPOINTS ====================

/**
 * GET /api/forums/stats
 * Get forum statistics across all formations
 * Protected: Requires training.forums.view_page permission
 */
router.get('/stats',
  authenticateToken,
  requirePermission('training.forums.view_page'),
  async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM forum_threads) as total_threads,
        (SELECT COUNT(*) FROM forum_posts) as total_posts,
        (SELECT COUNT(*) FROM forum_reactions) as total_reactions,
        (SELECT COUNT(DISTINCT author_id) FROM forum_threads) as active_thread_creators,
        (SELECT COUNT(DISTINCT author_id) FROM forum_posts) as active_posters
    `);

    res.json({
      success: true,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
});

export default router;
