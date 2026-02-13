import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeFolderName, sanitizeStudentFolderName, isValidFolderName } from './folderSanitizer.js';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Base paths
const UPLOADS_BASE = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
const ARCHIVE_ROOT = path.join(UPLOADS_BASE, 'archive-documents');

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Check if a file or directory exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a folder for a session
 * @param {string} sessionId - Session ID
 * @param {string} sessionTitle - Session title
 * @returns {Promise<string>} - Full path to created folder
 */
export async function createSessionFolder(sessionId, sessionTitle) {
  try {
    // Ensure archive root exists
    await ensureDirectory(ARCHIVE_ROOT);

    // Sanitize session title for folder name
    const sanitizedTitle = sanitizeFolderName(sessionTitle);

    if (!isValidFolderName(sanitizedTitle)) {
      throw new Error(`Invalid folder name after sanitization: ${sanitizedTitle}`);
    }

    // Create session folder path
    const folderPath = path.join(ARCHIVE_ROOT, sanitizedTitle);

    // Create the folder
    await ensureDirectory(folderPath);

    // Create metadata file
    const metadata = {
      session_id: sessionId,
      original_title: sessionTitle,
      sanitized_title: sanitizedTitle,
      created_at: new Date().toISOString()
    };

    const metadataPath = path.join(folderPath, 'session-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    console.log(`✓ Created session folder: ${folderPath}`);

    return folderPath;
  } catch (error) {
    console.error(`Error creating session folder for ${sessionTitle}:`, error);
    throw error;
  }
}

/**
 * Creates a folder for a student within a session
 * @param {string} sessionId - Session ID
 * @param {Object} studentData - Student data
 * @param {string} studentData.id - Student ID
 * @param {string} studentData.prenom - Student first name
 * @param {string} studentData.nom - Student last name
 * @param {string} studentData.cin - Student CIN
 * @returns {Promise<string>} - Full path to created student folder
 */
export async function createStudentFolder(sessionId, studentData) {
  try {
    // Get session folder from database
    const result = await pool.query(
      'SELECT folder_path FROM archive_folders WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`No archive folder found for session ${sessionId}`);
    }

    const sessionFolderPath = result.rows[0].folder_path;

    // Sanitize student name for folder
    const studentFolderName = sanitizeStudentFolderName(studentData);

    if (!isValidFolderName(studentFolderName)) {
      throw new Error(`Invalid student folder name: ${studentFolderName}`);
    }

    // Create student folder path
    const studentFolderPath = path.join(sessionFolderPath, studentFolderName);

    // Create the folder
    await ensureDirectory(studentFolderPath);

    // Create student metadata file
    const metadata = {
      student_id: studentData.id,
      prenom: studentData.prenom,
      nom: studentData.nom,
      cin: studentData.cin,
      session_id: sessionId,
      created_at: new Date().toISOString()
    };

    const metadataPath = path.join(studentFolderPath, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    console.log(`✓ Created student folder: ${studentFolderPath}`);

    return studentFolderPath;
  } catch (error) {
    console.error(`Error creating student folder for ${studentData.prenom} ${studentData.nom}:`, error);
    throw error;
  }
}

/**
 * Gets or creates a student folder
 * @param {string} sessionId - Session ID
 * @param {Object} studentData - Student data
 * @returns {Promise<string>} - Full path to student folder
 */
export async function getOrCreateStudentFolder(sessionId, studentData) {
  try {
    // Check if student folder already exists in database
    const result = await pool.query(
      'SELECT folder_path FROM student_archive_folders WHERE session_id = $1 AND student_id = $2',
      [sessionId, studentData.id]
    );

    if (result.rows.length > 0) {
      const existingPath = result.rows[0].folder_path;
      // Verify folder actually exists on filesystem
      const exists = await fileExists(existingPath);
      if (exists) {
        return existingPath;
      }
      // If not, create it
    }

    // Create new folder
    const folderPath = await createStudentFolder(sessionId, studentData);

    // Store in database
    const { nanoid } = await import('nanoid');
    await pool.query(
      'INSERT INTO student_archive_folders (id, session_id, student_id, folder_path) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, student_id) DO UPDATE SET folder_path = $4',
      [nanoid(), sessionId, studentData.id, folderPath]
    );

    return folderPath;
  } catch (error) {
    console.error('Error getting or creating student folder:', error);
    throw error;
  }
}

/**
 * Moves a student folder from one session to another
 * @param {string} fromSessionId - Source session ID
 * @param {string} studentId - Student ID
 * @param {string} toSessionId - Destination session ID
 * @returns {Promise<Object>} - Result with old and new paths
 */
export async function moveStudentFolder(fromSessionId, studentId, toSessionId) {
  try {
    // Get old folder path
    const oldFolderResult = await pool.query(
      'SELECT folder_path FROM student_archive_folders WHERE session_id = $1 AND student_id = $2',
      [fromSessionId, studentId]
    );

    if (oldFolderResult.rows.length === 0) {
      return {
        success: true,
        message: 'No folder to move',
        filesCount: 0
      };
    }

    const oldFolderPath = oldFolderResult.rows[0].folder_path;

    // Check if old folder exists
    const oldExists = await fileExists(oldFolderPath);
    if (!oldExists) {
      console.warn(`Old folder doesn't exist: ${oldFolderPath}`);
      return {
        success: true,
        message: 'Folder does not exist',
        filesCount: 0
      };
    }

    // Get target session folder
    const targetSessionResult = await pool.query(
      'SELECT folder_path FROM archive_folders WHERE session_id = $1',
      [toSessionId]
    );

    if (targetSessionResult.rows.length === 0) {
      throw new Error(`No archive folder found for target session ${toSessionId}`);
    }

    const targetSessionPath = targetSessionResult.rows[0].folder_path;

    // Ensure target session folder exists
    await ensureDirectory(targetSessionPath);

    // Get student folder name (last part of path)
    const studentFolderName = path.basename(oldFolderPath);
    const newFolderPath = path.join(targetSessionPath, studentFolderName);

    // Check if target already exists
    const newExists = await fileExists(newFolderPath);
    if (newExists) {
      throw new Error(`Target folder already exists: ${newFolderPath}`);
    }

    // Move the folder
    await fs.rename(oldFolderPath, newFolderPath);

    // Count files moved
    const files = await fs.readdir(newFolderPath);
    const filesCount = files.length;

    // Update database
    await pool.query(
      'UPDATE student_archive_folders SET folder_path = $1, session_id = $2 WHERE student_id = $3 AND session_id = $4',
      [newFolderPath, toSessionId, studentId, fromSessionId]
    );

    console.log(`✓ Moved student folder from ${oldFolderPath} to ${newFolderPath}`);

    return {
      success: true,
      old_path: oldFolderPath,
      new_path: newFolderPath,
      filesCount
    };
  } catch (error) {
    console.error('Error moving student folder:', error);
    throw error;
  }
}

/**
 * Cleans up a folder and its contents
 * @param {string} folderPath - Path to folder to clean up
 * @returns {Promise<void>}
 */
export async function cleanupFolder(folderPath) {
  try {
    const exists = await fileExists(folderPath);
    if (exists) {
      await fs.rm(folderPath, { recursive: true, force: true });
      console.log(`✓ Cleaned up folder: ${folderPath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up folder ${folderPath}:`, error);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Verifies the archive structure and creates root if needed
 * @returns {Promise<void>}
 */
export async function verifyArchiveStructure() {
  try {
    console.log('Verifying archive structure...');

    // Ensure UPLOADS_BASE exists
    await ensureDirectory(UPLOADS_BASE);
    console.log(`✓ Uploads base directory: ${UPLOADS_BASE}`);

    // Ensure ARCHIVE_ROOT exists
    await ensureDirectory(ARCHIVE_ROOT);
    console.log(`✓ Archive root directory: ${ARCHIVE_ROOT}`);

    // Test write permissions
    const testFile = path.join(ARCHIVE_ROOT, '.write_test');
    await fs.writeFile(testFile, 'test', 'utf8');
    await fs.unlink(testFile);
    console.log('✓ Write permissions verified');

    return true;
  } catch (error) {
    console.error('❌ Archive structure verification failed:', error);
    throw error;
  }
}

/**
 * Gets archive statistics
 * @returns {Promise<Object>} - Statistics object
 */
export async function getArchiveStats() {
  try {
    const stats = {
      total_sessions: 0,
      total_students: 0,
      total_certificates: 0
    };

    // Count session folders
    const sessionResult = await pool.query('SELECT COUNT(*) as count FROM archive_folders');
    stats.total_sessions = parseInt(sessionResult.rows[0].count);

    // Count student folders
    const studentResult = await pool.query('SELECT COUNT(*) as count FROM student_archive_folders');
    stats.total_students = parseInt(studentResult.rows[0].count);

    // Count certificates with files
    const certResult = await pool.query('SELECT COUNT(*) as count FROM certificates WHERE file_path IS NOT NULL');
    stats.total_certificates = parseInt(certResult.rows[0].count);

    return stats;
  } catch (error) {
    console.error('Error getting archive stats:', error);
    return { error: error.message };
  }
}

export default {
  createSessionFolder,
  createStudentFolder,
  getOrCreateStudentFolder,
  moveStudentFolder,
  cleanupFolder,
  verifyArchiveStructure,
  getArchiveStats,
  ARCHIVE_ROOT
};
