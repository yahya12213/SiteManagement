# Système d'archivage automatique des documents de formation

## 📋 Vue d'ensemble

Le système d'archivage automatique organise et stocke les documents générés pour les étudiants dans une structure hiérarchique sur le serveur Railway.

## ✨ Fonctionnalités implémentées

### 1. Création automatique de dossiers de session
- ✅ Lors de la création d'une session, un dossier est automatiquement créé
- ✅ Format: `server/uploads/archive-documents/{session_sanitized_title}/`
- ✅ Contient un fichier `session-metadata.json` avec les informations de la session

### 2. Génération de certificats avec stockage serveur
- ✅ Les certificats PDF sont maintenant générés côté serveur (PDFKit)
- ✅ Création automatique de sous-dossiers par étudiant: `{prenom}_{nom}_{CIN}/`
- ✅ Stockage des PDFs avec numérotation: `certificat_CERT-YYYYMM-XXXXXX.pdf`
- ✅ Métadonnées stockées en base de données (`certificates` table)

### 3. Transfert d'étudiants entre sessions
- ✅ Nouvel endpoint: `POST /api/sessions-formation/:sessionId/students/:studentId/transfer`
- ✅ Déplacement automatique des dossiers de documents
- ✅ Préservation optionnelle de l'historique des paiements
- ✅ Mise à jour automatique des références de certificats

## 🗂️ Structure des dossiers

```
server/uploads/
├── archive-documents/              # NOUVEAU - Dossier racine
│   ├── formation_excel_2024/       # Dossier par session
│   │   ├── session-metadata.json   # Métadonnées
│   │   ├── mohamed_ali_AB123456/   # Dossier par étudiant
│   │   │   ├── certificat_CERT-202412-X7YZ9A.pdf
│   │   │   └── metadata.json
│   │   └── fatima_zahra_CD789012/
│   │       └── certificat_CERT-202412-P4QR5B.pdf
│   └── preparation_caf_hotellerie/
│       └── ...
├── backgrounds/                    # Existant
├── fonts/                          # Existant
├── profiles/                       # Existant
└── declarations/                   # Existant
```

## 🚀 Utilisation

### Créer une session (automatique)

Lors de la création d'une session via l'interface admin, le dossier est créé automatiquement.

**Endpoint**: `POST /api/sessions-formation`

```json
{
  "titre": "Formation Excel 2024",
  "description": "Formation complète Excel",
  "date_debut": "2024-01-15",
  "date_fin": "2024-02-15",
  "segment_id": "segment_123",
  "ville_id": "ville_456"
}
```

**Résultat**:
- Session créée en base de données
- Dossier `formation_excel_2024/` créé automatiquement
- Enregistrement dans la table `archive_folders`

### Générer un certificat avec PDF

**Endpoint**: `POST /api/certificates/generate`

**⚠️ Important**: Le champ `session_id` est maintenant **requis** pour la génération du PDF.

```json
{
  "student_id": "student_123",
  "formation_id": "formation_456",
  "session_id": "session_789",
  "completion_date": "2024-12-10",
  "grade": 85.5,
  "metadata": {
    "organization_name": "Centre de Formation",
    "director_name": "M. Directeur"
  }
}
```

**Résultat**:
- Enregistrement certificat en base de données
- Dossier étudiant créé: `mohamed_ali_AB123456/`
- PDF généré: `certificat_CERT-202412-X7YZ9A.pdf`
- Chemin stocké dans `certificates.file_path`

**Réponse**:
```json
{
  "success": true,
  "certificate": {
    "id": "cert_123",
    "certificate_number": "CERT-202412-X7YZ9A",
    "file_path": "/uploads/archive-documents/formation_excel_2024/mohamed_ali_AB123456/certificat_CERT-202412-X7YZ9A.pdf",
    "archive_folder": "/uploads/archive-documents/formation_excel_2024/mohamed_ali_AB123456"
  },
  "pdf_generated": true,
  "message": "Certificate created and PDF generated successfully"
}
```

### Transférer un étudiant

**Endpoint**: `POST /api/sessions-formation/:sessionId/students/:studentId/transfer`

```json
{
  "new_session_id": "nouvelle_session_123",
  "preserve_payments": true,
  "transfer_documents": true,
  "reason": "Changement de groupe"
}
```

**Résultat**:
- Enrollment supprimé de l'ancienne session
- Nouvel enrollment créé dans la nouvelle session
- Dossier de documents déplacé automatiquement
- Certificats mis à jour pour pointer vers la nouvelle session

**Réponse**:
```json
{
  "success": true,
  "message": "Étudiant transféré avec succès",
  "transfer_details": {
    "from_session": "session_old_123",
    "to_session": "session_new_456",
    "student_id": "student_789",
    "documents_moved": 3,
    "certificates_updated": 1,
    "payments_preserved": true,
    "old_folder": "/uploads/archive-documents/old_session/mohamed_ali_AB123/",
    "new_folder": "/uploads/archive-documents/new_session/mohamed_ali_AB123/"
  }
}
```

## 🗄️ Modifications de la base de données

### Nouvelles tables

#### `archive_folders`
Stocke les chemins des dossiers de session.

```sql
CREATE TABLE archive_folders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `student_archive_folders`
Stocke les chemins des dossiers étudiants.

```sql
CREATE TABLE student_archive_folders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, student_id)
);
```

### Colonnes ajoutées à `certificates`

- `session_id` (TEXT) - Référence vers `sessions_formation`
- `file_path` (TEXT) - Chemin complet du fichier PDF
- `archive_folder` (TEXT) - Chemin du dossier d'archive

## 🔧 Configuration Railway

### Volume persistant

**Important**: Sur Railway, les fichiers doivent être stockés dans un volume persistant.

1. **Créer un volume**: Dashboard → Volume → New Volume
   - Nom: `uploads-volume`
   - Point de montage: `/app/server/uploads`
   - Taille: 10 GB (extensible)

2. **Variable d'environnement**:
   ```env
   UPLOADS_PATH=/app/server/uploads
   ```

3. **Vérification au démarrage**: Le serveur vérifie automatiquement la structure d'archive.

## 📦 Dépendances installées

- `pdfkit@^0.15.0` - Génération PDF côté serveur
- `canvas@^2.11.2` - Rendu d'images pour les templates

## 🔐 Permissions

### Nouvelles permissions

- `training.sessions.transfer_student` - Transférer un étudiant entre sessions

### Permissions existantes utilisées

- `training.sessions.create` - Créer une session (+ création de dossier)
- `training.certificates.generate` - Générer un certificat (+ PDF)

## 🎨 Compatibilité avec les templates

Le système utilise les templates de certificats existants (`certificate_templates` table).

**Éléments supportés**:
- Texte avec substitution de variables
- Images de fond
- Lignes, rectangles, cercles
- Polices personnalisées (via `/uploads/fonts/`)

**Variables disponibles**:
- `{student_name}` - Nom complet
- `{student_first_name}` - Prénom
- `{student_last_name}` - Nom
- `{formation_title}` - Titre de la formation
- `{completion_date}` - Date de complétion
- `{certificate_number}` - Numéro du certificat
- `{grade}` - Note (avec décimales)
- `{grade_rounded}` - Note arrondie
- `{duration_hours}` - Durée en heures
- `{current_year}` - Année actuelle
- `{cin}` - CIN de l'étudiant

## 📝 Fichiers créés/modifiés

### Fichiers créés

1. `server/src/utils/folderSanitizer.js` - Sanitisation des noms de dossiers
2. `server/src/utils/archiveManager.js` - Gestion des dossiers d'archive
3. `server/src/services/certificatePDFGenerator.js` - Génération PDF serveur
4. `server/src/routes/migration-084-archive-system.js` - Migration base de données

### Fichiers modifiés

1. `server/src/routes/sessions-formation.js`
   - Ajout du hook de création de dossier (lignes 311-329)
   - Ajout de l'endpoint de transfert (lignes 1397-1599)

2. `server/src/routes/certificates.js`
   - Remplacement complet de l'endpoint `/generate` (lignes 22-255)
   - Ajout de la génération PDF serveur

## ⚠️ Points d'attention

### Compatibilité descendante

- Les certificats existants (sans `session_id`) continuent de fonctionner
- Si `session_id` n'est pas fourni, le certificat est créé sans PDF
- Les anciens certificats peuvent être téléchargés via le client (jsPDF)

### Gestion des erreurs

- Si la création du dossier échoue, la session est quand même créée
- Si la génération PDF échoue, la transaction est annulée (rollback)
- Les dossiers sont nettoyés automatiquement en cas d'erreur

### Performance

- La génération PDF est synchrone (peut prendre 1-2 secondes)
- Recommandation future: file d'attente asynchrone pour les générations en masse

## 🧪 Tests recommandés

1. **Créer une session**
   - Vérifier que le dossier est créé dans `uploads/archive-documents/`
   - Vérifier `session-metadata.json`

2. **Générer un certificat**
   - Vérifier la création du dossier étudiant
   - Vérifier la génération du PDF
   - Télécharger et ouvrir le PDF

3. **Transférer un étudiant**
   - Vérifier le déplacement du dossier
   - Vérifier la mise à jour des certificats
   - Vérifier la préservation des paiements

## 🚀 Prochaines étapes recommandées

1. **Interface admin** - Ajouter un explorateur de fichiers pour parcourir les archives
2. **Download endpoint** - `GET /api/certificates/:id/download` pour télécharger les PDFs archivés
3. **Génération asynchrone** - File d'attente pour les générations en masse
4. **Statistiques** - Dashboard montrant l'utilisation du stockage
5. **Migration rétroactive** - Script pour créer les dossiers des sessions existantes

## 📞 Support

En cas de problème:
1. Vérifier les logs du serveur (`console.log`)
2. Vérifier l'existence du dossier `uploads/archive-documents/`
3. Vérifier les permissions du volume sur Railway
4. Vérifier la variable d'environnement `UPLOADS_PATH`

---

**Version**: 1.0.0
**Date**: 10 décembre 2024
**Migration**: 084-archive-system
