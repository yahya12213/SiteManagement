/**
 * Text Standardization Utility
 * Standardizes text input for consistent document generation
 */

/**
 * Capitalize first letter of each word (Title Case)
 * Example: "JEAN DUPONT" -> "Jean Dupont"
 *          "jean dupont" -> "Jean Dupont"
 *          "jEaN dUpOnT" -> "Jean Dupont"
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;

  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Remove multiple spaces
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      // Handle hyphenated names like "EL-MEHDI" -> "El-Mehdi"
      if (word.includes('-')) {
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('-');
      }
      // Handle apostrophes like "d'ALMEIDA" -> "D'Almeida"
      if (word.includes("'")) {
        return word.split("'")
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Convert to UPPERCASE
 * Example: "jean dupont" -> "JEAN DUPONT"
 */
export function toUpperCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Convert to lowercase
 * Example: "JEAN DUPONT" -> "jean dupont"
 */
export function toLowerCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Capitalize first letter only (Sentence case)
 * Example: "MOHAMMEDIA" -> "Mohammedia"
 */
export function toSentenceCase(str) {
  if (!str || typeof str !== 'string') return str;
  const trimmed = str.toLowerCase().trim().replace(/\s+/g, ' ');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Format CIN (National ID) - Always uppercase, remove spaces
 * Example: "t 209876" -> "T209876"
 *          "ab 123456" -> "AB123456"
 */
export function formatCIN(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Format phone number - Remove spaces and format consistently
 * Example: "06 12 34 56 78" -> "0612345678"
 *          "+212 612345678" -> "+212612345678"
 */
export function formatPhone(str) {
  if (!str || typeof str !== 'string') return str;
  // Keep only digits and + sign
  return str.replace(/[^\d+]/g, '').trim();
}

/**
 * Format email - Always lowercase, trim spaces
 * Example: "John.Doe@Gmail.COM " -> "john.doe@gmail.com"
 */
export function formatEmail(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().trim();
}

/**
 * Format address - Title case for city names, capitalize first letter of street
 * Example: "123 RUE MOHAMMED V, CASABLANCA" -> "123 Rue Mohammed V, Casablanca"
 */
export function formatAddress(str) {
  if (!str || typeof str !== 'string') return str;
  return toTitleCase(str);
}

/**
 * Format date string - Ensure consistent date format
 * Keeps the date as is but trims spaces
 */
export function formatDate(str) {
  if (!str || typeof str !== 'string') return str;
  return str.trim();
}

/**
 * Format formation/course name - Title case
 * Example: "FORMATION EN SECOURISME" -> "Formation En Secourisme"
 */
export function formatFormationName(str) {
  if (!str || typeof str !== 'string') return str;
  return toTitleCase(str);
}

/**
 * Format certificate number - Uppercase, no extra spaces
 * Example: "cert-2024-001" -> "CERT-2024-001"
 */
export function formatCertificateNumber(str) {
  if (!str || typeof str !== 'string') return str;
  return str.toUpperCase().trim().replace(/\s+/g, '');
}

/**
 * Standardization rules configuration
 * Maps field names to their standardization functions
 */
export const STANDARDIZATION_RULES = {
  // Personal information
  firstName: toTitleCase,
  lastName: toTitleCase,
  first_name: toTitleCase,
  last_name: toTitleCase,
  prenom: toTitleCase,
  nom: toTitleCase,
  fullName: toTitleCase,
  full_name: toTitleCase,
  name: toTitleCase,

  // Identification
  cin: formatCIN,
  CIN: formatCIN,
  nationalId: formatCIN,
  national_id: formatCIN,

  // Contact
  email: formatEmail,
  phone: formatPhone,
  telephone: formatPhone,
  mobile: formatPhone,

  // Location
  city: toTitleCase,
  ville: toTitleCase,
  birthPlace: toTitleCase,
  birth_place: toTitleCase,
  lieuNaissance: toTitleCase,
  lieu_naissance: toTitleCase,
  address: formatAddress,
  adresse: formatAddress,

  // Formation
  formationName: formatFormationName,
  formation_name: formatFormationName,
  courseName: formatFormationName,
  course_name: formatFormationName,

  // Certificate
  certificateNumber: formatCertificateNumber,
  certificate_number: formatCertificateNumber,
};

/**
 * Standardize a single field based on its name
 * @param {string} fieldName - The name of the field
 * @param {string} value - The value to standardize
 * @returns {string} - The standardized value
 */
export function standardizeField(fieldName, value) {
  if (!value || typeof value !== 'string') return value;

  const rule = STANDARDIZATION_RULES[fieldName];
  if (rule) {
    return rule(value);
  }

  // Default: trim spaces
  return value.trim();
}

/**
 * Standardize an entire object based on field names
 * @param {Object} data - The object containing fields to standardize
 * @param {Array<string>} fieldsToStandardize - Optional list of specific fields to standardize
 * @returns {Object} - The object with standardized values
 */
export function standardizeObject(data, fieldsToStandardize = null) {
  if (!data || typeof data !== 'object') return data;

  const result = { ...data };
  const fields = fieldsToStandardize || Object.keys(STANDARDIZATION_RULES);

  for (const field of fields) {
    if (result[field] !== undefined && typeof result[field] === 'string') {
      result[field] = standardizeField(field, result[field]);
    }
  }

  return result;
}

/**
 * Standardize student data
 * @param {Object} student - Student object
 * @returns {Object} - Standardized student object
 */
export function standardizeStudent(student) {
  if (!student) return student;

  const standardized = { ...student };

  // Name fields
  if (standardized.first_name) standardized.first_name = toTitleCase(standardized.first_name);
  if (standardized.last_name) standardized.last_name = toTitleCase(standardized.last_name);
  if (standardized.firstName) standardized.firstName = toTitleCase(standardized.firstName);
  if (standardized.lastName) standardized.lastName = toTitleCase(standardized.lastName);
  if (standardized.prenom) standardized.prenom = toTitleCase(standardized.prenom);
  if (standardized.nom) standardized.nom = toTitleCase(standardized.nom);
  if (standardized.name) standardized.name = toTitleCase(standardized.name);
  if (standardized.full_name) standardized.full_name = toTitleCase(standardized.full_name);

  // CIN
  if (standardized.cin) standardized.cin = formatCIN(standardized.cin);
  if (standardized.CIN) standardized.CIN = formatCIN(standardized.CIN);

  // Contact
  if (standardized.email) standardized.email = formatEmail(standardized.email);
  if (standardized.phone) standardized.phone = formatPhone(standardized.phone);
  if (standardized.telephone) standardized.telephone = formatPhone(standardized.telephone);

  // Location
  if (standardized.city) standardized.city = toTitleCase(standardized.city);
  if (standardized.ville) standardized.ville = toTitleCase(standardized.ville);
  if (standardized.birth_place) standardized.birth_place = toTitleCase(standardized.birth_place);
  if (standardized.birthPlace) standardized.birthPlace = toTitleCase(standardized.birthPlace);
  if (standardized.lieu_naissance) standardized.lieu_naissance = toTitleCase(standardized.lieu_naissance);
  if (standardized.address) standardized.address = formatAddress(standardized.address);
  if (standardized.adresse) standardized.adresse = formatAddress(standardized.adresse);

  return standardized;
}

/**
 * Standardize certificate data for PDF generation
 * @param {Object} certData - Certificate data object
 * @returns {Object} - Standardized certificate data
 */
export function standardizeCertificateData(certData) {
  if (!certData) return certData;

  const standardized = { ...certData };

  // Student name
  if (standardized.studentName) standardized.studentName = toTitleCase(standardized.studentName);
  if (standardized.student_name) standardized.student_name = toTitleCase(standardized.student_name);
  if (standardized.fullName) standardized.fullName = toTitleCase(standardized.fullName);

  // CIN
  if (standardized.cin) standardized.cin = formatCIN(standardized.cin);
  if (standardized.studentCin) standardized.studentCin = formatCIN(standardized.studentCin);

  // Birth place
  if (standardized.birthPlace) standardized.birthPlace = toTitleCase(standardized.birthPlace);
  if (standardized.birth_place) standardized.birth_place = toTitleCase(standardized.birth_place);
  if (standardized.lieuNaissance) standardized.lieuNaissance = toTitleCase(standardized.lieuNaissance);

  // Formation
  if (standardized.formationName) standardized.formationName = toTitleCase(standardized.formationName);
  if (standardized.formation_name) standardized.formation_name = toTitleCase(standardized.formation_name);

  // Certificate number - keep uppercase
  if (standardized.certificateNumber) standardized.certificateNumber = formatCertificateNumber(standardized.certificateNumber);
  if (standardized.certificate_number) standardized.certificate_number = formatCertificateNumber(standardized.certificate_number);

  // City
  if (standardized.city) standardized.city = toTitleCase(standardized.city);

  return standardized;
}

export default {
  toTitleCase,
  toUpperCase,
  toLowerCase,
  toSentenceCase,
  formatCIN,
  formatPhone,
  formatEmail,
  formatAddress,
  formatDate,
  formatFormationName,
  formatCertificateNumber,
  standardizeField,
  standardizeObject,
  standardizeStudent,
  standardizeCertificateData,
  STANDARDIZATION_RULES
};
