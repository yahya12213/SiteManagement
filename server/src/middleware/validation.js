/**
 * Input Validation Middleware
 * Uses express-validator for input sanitization and validation
 * Prevents injection attacks and ensures data integrity
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to check validation results
 * Returns 400 with errors if validation failed
 * Usage: Add after validation chains
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
  }
  next();
};

/**
 * Common validation chains
 */

// UUID validation for IDs
export const validateUUID = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) :
                    location === 'query' ? query(field) :
                    body(field);

  return validator
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

// Integer validation for pagination
export const validateInteger = (field, location = 'query', min = 1, max = 1000) => {
  const validator = location === 'query' ? query(field) : body(field);

  return validator
    .optional()
    .isInt({ min, max })
    .withMessage(`${field} must be an integer between ${min} and ${max}`)
    .toInt();
};

// Date validation (ISO 8601 format)
export const validateDate = (field, location = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .isISO8601()
    .withMessage(`${field} must be a valid date (ISO 8601 format)`);
};

// Status enum validation
export const validateStatus = (field, allowedStatuses, location = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .isIn(allowedStatuses)
    .withMessage(`${field} must be one of: ${allowedStatuses.join(', ')}`);
};

// String sanitization (trim, escape HTML)
export const sanitizeString = (field, location = 'body', maxLength = 500) => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .trim()
    .escape()
    .isLength({ max: maxLength })
    .withMessage(`${field} must not exceed ${maxLength} characters`);
};

// Email validation
export const validateEmail = (field, location = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .isEmail()
    .withMessage(`${field} must be a valid email address`)
    .normalizeEmail();
};

// Password strength validation (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
export const validatePassword = (field) => {
  return body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least 1 uppercase, 1 lowercase, and 1 number');
};

// Phone number validation (international format)
export const validatePhone = (field, location = 'body') => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage(`${field} must be a valid phone number`);
};

// Numeric validation (float)
export const validateNumeric = (field, location = 'body', min = 0) => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .isFloat({ min })
    .withMessage(`${field} must be a number greater than or equal to ${min}`)
    .toFloat();
};

/**
 * Pre-built validation chains for common routes
 */

// Pagination validation
export const paginationValidation = [
  validateInteger('limit', 'query', 1, 1000),
  validateInteger('offset', 'query', 0, 1000000),
  validate,
];

// ID parameter validation
export const idParamValidation = [
  validateUUID('id', 'param'),
  validate,
];

// Declaration status validation
export const declarationStatusValidation = [
  validateStatus('status', ['brouillon', 'a_declarer', 'soumise', 'en_cours', 'approuvee', 'refusee'], 'body'),
  validate,
];

// Date range validation
export const dateRangeValidation = [
  validateDate('start_date', 'query'),
  validateDate('end_date', 'query'),
  validate,
];

/**
 * SQL Injection prevention helpers
 * Already using parameterized queries, but these add extra safety
 */

// Sanitize table/column names (only allow alphanumeric + underscore)
export const sanitizeIdentifier = (identifier) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid identifier: must be alphanumeric with underscores');
  }
  return identifier;
};

// Sanitize ORDER BY direction
export const sanitizeOrderDirection = (direction) => {
  const normalized = direction?.toUpperCase();
  if (normalized !== 'ASC' && normalized !== 'DESC') {
    return 'ASC'; // Safe default
  }
  return normalized;
};

// Sanitize LIMIT/OFFSET values
export const sanitizePagination = (limit, offset) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);
  return { limit: safeLimit, offset: safeOffset };
};

export default {
  validate,
  validateUUID,
  validateInteger,
  validateDate,
  validateStatus,
  sanitizeString,
  validateEmail,
  validatePassword,
  validatePhone,
  validateNumeric,
  paginationValidation,
  idParamValidation,
  declarationStatusValidation,
  dateRangeValidation,
  sanitizeIdentifier,
  sanitizeOrderDirection,
  sanitizePagination,
};
