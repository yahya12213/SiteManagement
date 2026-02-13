/**
 * Folder Sanitizer Utility
 * Converts any string into a safe filesystem folder name
 */

/**
 * Sanitizes a string to make it safe for use as a folder name
 * @param {string} name - The original folder name
 * @returns {string} - Sanitized folder name
 */
export function sanitizeFolderName(name) {
  if (!name || typeof name !== 'string') {
    return 'unnamed_folder';
  }

  return name
    .normalize('NFD')                     // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')      // Remove diacritics
    .replace(/[^a-zA-Z0-9_\-\s]/g, '_')   // Replace special chars with underscore
    .replace(/\s+/g, '_')                 // Replace spaces with underscore
    .replace(/_+/g, '_')                  // Collapse multiple underscores
    .replace(/^_+|_+$/g, '')              // Trim underscores from start/end
    .substring(0, 100)                    // Limit length to 100 chars
    .toLowerCase()                        // Convert to lowercase
    || 'unnamed_folder';                  // Fallback if result is empty
}

/**
 * Sanitizes student information to create a unique folder name
 * Format: {prenom}_{nom}_{CIN}
 * @param {Object} student - Student object
 * @param {string} student.prenom - Student first name
 * @param {string} student.nom - Student last name
 * @param {string} student.cin - Student CIN (national ID)
 * @returns {string} - Sanitized student folder name
 */
export function sanitizeStudentFolderName(student) {
  if (!student) {
    return 'unknown_student';
  }

  const prenom = sanitizeFolderName(student.prenom || 'unknown');
  const nom = sanitizeFolderName(student.nom || 'student');
  const cin = sanitizeFolderName(student.cin || 'no_cin');

  return `${prenom}_${nom}_${cin}`;
}

/**
 * Validates if a string is a safe folder name
 * @param {string} name - Folder name to validate
 * @returns {boolean} - True if safe, false otherwise
 */
export function isValidFolderName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Check for unsafe patterns
  const unsafePatterns = [
    /\.\./,           // Parent directory reference
    /^[.]/,           // Hidden files/folders
    /[<>:"|?*]/,      // Windows invalid chars
    /[\x00-\x1f]/,    // Control characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows reserved names
  ];

  return !unsafePatterns.some(pattern => pattern.test(name));
}

/**
 * Creates a unique folder name by adding a timestamp suffix if needed
 * @param {string} baseName - Base folder name
 * @returns {string} - Unique folder name
 */
export function makeUniqueFolderName(baseName) {
  const sanitized = sanitizeFolderName(baseName);
  const timestamp = new Date().getTime();
  return `${sanitized}_${timestamp}`;
}

export default {
  sanitizeFolderName,
  sanitizeStudentFolderName,
  isValidFolderName,
  makeUniqueFolderName
};
