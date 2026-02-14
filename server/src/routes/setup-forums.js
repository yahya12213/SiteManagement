import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Setup route to create forum tables
 * Creates: forum_threads, forum_posts, forum_reactions
 */
router.get('/run-setup', async (req, res) => {
  try {
    // Create forum_threads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_threads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_locked BOOLEAN DEFAULT FALSE,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create forum_posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        thread_id TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_edited BOOLEAN DEFAULT FALSE,
        parent_post_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create forum_reactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_reactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'helpful', 'insightful')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id, reaction_type)
      );
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_forum_threads_formation ON forum_threads(formation_id);
      CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
      CREATE INDEX IF NOT EXISTS idx_forum_threads_created ON forum_threads(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
      CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_forum_posts_parent ON forum_posts(parent_post_id);

      CREATE INDEX IF NOT EXISTS idx_forum_reactions_post ON forum_reactions(post_id);
      CREATE INDEX IF NOT EXISTS idx_forum_reactions_user ON forum_reactions(user_id);
    `);

    // Create function to update updated_at timestamp
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_forum_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for auto-updating updated_at
    await pool.query(`
      DROP TRIGGER IF EXISTS update_forum_threads_updated_at ON forum_threads;
      CREATE TRIGGER update_forum_threads_updated_at
        BEFORE UPDATE ON forum_threads
        FOR EACH ROW
        EXECUTE FUNCTION update_forum_updated_at();

      DROP TRIGGER IF EXISTS update_forum_posts_updated_at ON forum_posts;
      CREATE TRIGGER update_forum_posts_updated_at
        BEFORE UPDATE ON forum_posts
        FOR EACH ROW
        EXECUTE FUNCTION update_forum_updated_at();
    `);

    res.json({
      success: true,
      message: 'Forum tables created successfully',
      tables: ['forum_threads', 'forum_posts', 'forum_reactions'],
    });
  } catch (error) {
    console.error('Error creating forum tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create forum tables',
      details: error.message,
    });
  }
});

/**
 * Health check route
 */
router.get('/health', async (req, res) => {
  try {
    const threadsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_name = 'forum_threads'
    `);
    const postsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_name = 'forum_posts'
    `);
    const reactionsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_name = 'forum_reactions'
    `);

    const allTablesExist =
      threadsCheck.rows[0].count === '1' &&
      postsCheck.rows[0].count === '1' &&
      reactionsCheck.rows[0].count === '1';

    res.json({
      success: true,
      tables: {
        forum_threads: threadsCheck.rows[0].count === '1',
        forum_posts: postsCheck.rows[0].count === '1',
        forum_reactions: reactionsCheck.rows[0].count === '1',
      },
      ready: allTablesExist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
