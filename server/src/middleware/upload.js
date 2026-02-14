import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer les dossiers d'uploads s'ils n'existent pas
// Use UPLOADS_PATH env variable for Railway persistent volumes, fallback to local for development
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
const backgroundsDir = path.join(uploadsDir, 'backgrounds');
const fontsDir = path.join(uploadsDir, 'fonts');
const profilesDir = path.join(uploadsDir, 'profiles');
const declarationsDir = path.join(uploadsDir, 'declarations'); // Nouveau: pièces jointes déclarations
const employeeDocumentsDir = path.join(uploadsDir, 'employee-documents'); // Documents employé (contrats, CV, diplômes, etc.)
const employeePhotosDir = path.join(uploadsDir, 'employee-photos'); // Photos d'identité des employés

console.log('📁 Verifying upload directories...');
console.log(`📁 Base uploads path: ${uploadsDir} ${process.env.UPLOADS_PATH ? '(from UPLOADS_PATH env)' : '(default local)'}`);
[uploadsDir, backgroundsDir, fontsDir, profilesDir, declarationsDir, employeeDocumentsDir, employeePhotosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`  Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ✓ Directory created successfully`);
  } else {
    console.log(`  ✓ Directory exists: ${dir}`);
  }
});

// Storage pour les images d'arrière-plan
const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists at write time
    try {
      if (!fs.existsSync(backgroundsDir)) {
        console.log(`📁 Creating backgrounds directory at write time: ${backgroundsDir}`);
        fs.mkdirSync(backgroundsDir, { recursive: true });
      }
      console.log(`📁 Background upload destination: ${backgroundsDir}`);
      cb(null, backgroundsDir);
    } catch (err) {
      console.error(`❌ Error ensuring backgrounds directory exists:`, err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `background-${uniqueSuffix}${ext}`;
    console.log(`📁 Background filename: ${filename}`);
    cb(null, filename);
  }
});

// Storage pour les polices
const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fontsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `font-${uniqueSuffix}${ext}`);
  }
});

// Storage pour les photos de profil
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists at write time
    try {
      if (!fs.existsSync(profilesDir)) {
        console.log(`📁 Creating profiles directory at write time: ${profilesDir}`);
        fs.mkdirSync(profilesDir, { recursive: true });
      }
      console.log(`📁 Profile upload destination: ${profilesDir}`);
      cb(null, profilesDir);
    } catch (err) {
      console.error(`❌ Error ensuring profiles directory exists:`, err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `profile-${uniqueSuffix}${ext}`;
    console.log(`📁 Profile filename: ${filename}`);
    cb(null, filename);
  }
});

// Storage pour les pièces jointes de déclarations
const declarationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(declarationsDir)) {
        console.log(`📁 Creating declarations directory at write time: ${declarationsDir}`);
        fs.mkdirSync(declarationsDir, { recursive: true });
      }
      console.log(`📁 Declaration attachment upload destination: ${declarationsDir}`);
      cb(null, declarationsDir);
    } catch (err) {
      console.error(`❌ Error ensuring declarations directory exists:`, err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `declaration-${uniqueSuffix}-${safeOriginalName}`;
    console.log(`📁 Declaration attachment filename: ${filename}`);
    cb(null, filename);
  }
});

// Storage pour les documents employé (contrats, CV, diplômes, RIB, etc.)
const employeeDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(employeeDocumentsDir)) {
        console.log(`📁 Creating employee-documents directory at write time: ${employeeDocumentsDir}`);
        fs.mkdirSync(employeeDocumentsDir, { recursive: true });
      }
      console.log(`📁 Employee document upload destination: ${employeeDocumentsDir}`);
      cb(null, employeeDocumentsDir);
    } catch (err) {
      console.error(`❌ Error ensuring employee-documents directory exists:`, err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `doc-${uniqueSuffix}-${safeOriginalName}`;
    console.log(`📁 Employee document filename: ${filename}`);
    cb(null, filename);
  }
});

// Storage pour les photos d'employés (photo d'identité)
const employeePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(employeePhotosDir)) {
        console.log(`📁 Creating employee-photos directory at write time: ${employeePhotosDir}`);
        fs.mkdirSync(employeePhotosDir, { recursive: true });
      }
      console.log(`📁 Employee photo upload destination: ${employeePhotosDir}`);
      cb(null, employeePhotosDir);
    } catch (err) {
      console.error(`❌ Error ensuring employee-photos directory exists:`, err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `employee-photo-${uniqueSuffix}${ext}`;
    console.log(`📁 Employee photo filename: ${filename}`);
    cb(null, filename);
  }
});

// Filtres pour les types de fichiers
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté. Utilisez JPG, PNG, WEBP ou SVG.'), false);
  }
};

const fontFileFilter = (req, file, cb) => {
  const allowedExts = ['.ttf', '.otf', '.woff', '.woff2'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format de police non supporté. Utilisez TTF, OTF, WOFF ou WOFF2.'), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté. Utilisez PDF, Excel, Word ou images (JPG, PNG, WEBP).'), false);
  }
};

// Middlewares multer
export const uploadBackground = multer({
  storage: backgroundStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  }
}).single('background');

export const uploadFont = multer({
  storage: fontStorage,
  fileFilter: fontFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB max
  }
}).single('font');

export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3 MB max
  }
}).single('profile_image');

export const uploadDeclarationAttachment = multer({
  storage: declarationStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max
  }
}).single('attachment');

// Upload documents employé (contrats, CV, diplômes, RIB, certificats, etc.)
export const uploadEmployeeDocument = multer({
  storage: employeeDocumentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max
  }
}).single('document');

// Exporter le chemin des documents employé
export const getEmployeeDocumentsDir = () => employeeDocumentsDir;

// Upload photo employé (photo d'identité)
export const uploadEmployeePhoto = multer({
  storage: employeePhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  }
}).single('photo');

// Exporter le chemin des photos employé
export const getEmployeePhotosDir = () => employeePhotosDir;

// Helper pour supprimer un fichier
export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Copie un fichier d'arrière-plan avec un nouveau nom unique
 * Utilisé lors de la duplication de templates pour éviter le partage de fichiers
 * @param {string} sourceUrl - URL relative du fichier source (ex: /uploads/backgrounds/background-123.jpg)
 * @returns {Promise<string|null>} - Nouvelle URL du fichier copié ou null si erreur
 */
export const copyBackgroundFile = async (sourceUrl) => {
  try {
    if (!sourceUrl) return null;

    // Extraire le nom du fichier depuis l'URL
    const fileName = path.basename(sourceUrl);
    const sourcePath = path.join(backgroundsDir, fileName);

    // Vérifier que le fichier source existe
    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠ Source file not found for copy: ${sourcePath}`);
      return null;
    }

    // Générer un nouveau nom unique
    const ext = path.extname(fileName);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const newFileName = `background-${uniqueSuffix}${ext}`;
    const destPath = path.join(backgroundsDir, newFileName);

    // Copier le fichier
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✓ Background file copied: ${fileName} → ${newFileName}`);

    // Retourner la nouvelle URL relative
    return `/uploads/backgrounds/${newFileName}`;
  } catch (error) {
    console.error('Error copying background file:', error);
    return null;
  }
};

// Exporter le chemin des backgrounds pour les autres modules
export const getBackgroundsDir = () => backgroundsDir;
