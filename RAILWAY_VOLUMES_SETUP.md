# Configuration des Volumes Railway - Guide Complet

Ce guide explique comment configurer les volumes persistants Railway pour le stockage de fichiers.

## 📋 Vue d'ensemble

Avec l'abonnement Railway Hobby, vous pouvez créer des volumes persistants pour stocker les fichiers uploadés par les utilisateurs. Cette application utilise 4 dossiers de stockage:

### Structure des Dossiers

```
/app/server/uploads/              (Volume Railway - Persistent)
├── profiles/                     (Photos des étudiants - 3 MB max)
├── backgrounds/                  (Backgrounds de certificats - 5 MB max)
├── fonts/                        (Polices personnalisées - 2 MB max)
└── declarations/                 (Pièces jointes déclarations - 10 MB max) [NOUVEAU]
```

### Types de Fichiers Supportés

| Dossier | Types de Fichiers | Taille Max | Utilisation |
|---------|-------------------|------------|-------------|
| **profiles/** | JPG, PNG, WEBP, SVG | 3 MB | Photos de profil des étudiants |
| **backgrounds/** | JPG, PNG, WEBP, SVG | 5 MB | Images de fond pour certificats |
| **fonts/** | TTF, OTF, WOFF, WOFF2 | 2 MB | Polices personnalisées pour certificats |
| **declarations/** | PDF, Excel, Word, Images | 10 MB | Documents joints aux déclarations professeurs |

---

## 🚀 Étape 1: Créer un Volume Railway

### Via le Dashboard Railway

1. **Accédez à votre projet Railway**
   - Connectez-vous à [railway.app](https://railway.app)
   - Sélectionnez votre projet

2. **Créer le volume**
   - Cliquez sur votre service
   - Allez dans **Settings** → **Volumes**
   - Cliquez sur **+ New Volume**

3. **Configurer le volume**
   - **Name**: `uploads` (ou un nom de votre choix)
   - **Mount Path**: `/app/server/uploads`
   - **Size**: 2 GB minimum recommandé (peut être augmenté plus tard)

4. **Créer et redéployer**
   - Cliquez sur **Add**
   - Railway redéploiera automatiquement votre application

---

## ⚙️ Étape 2: Configurer les Variables d'Environnement

### Dans Railway Dashboard

1. **Accédez aux variables d'environnement**
   - Service → **Variables**

2. **Ajouter la variable UPLOADS_PATH**
   ```
   UPLOADS_PATH=/app/server/uploads
   ```

3. **Vérifier les autres variables**
   Assurez-vous que ces variables sont définies:
   ```env
   DATABASE_URL=postgresql://...  (déjà configuré par Railway)
   JWT_SECRET=votre-secret-jwt-32-chars-minimum
   NODE_ENV=production
   PORT=3001
   ```

4. **Sauvegarder**
   - Railway redéploiera automatiquement

---

## 🗄️ Étape 3: Exécuter la Migration de Base de Données

La nouvelle table `declaration_attachments` doit être créée.

### Option A: Via l'API (Recommandé)

Une fois l'application déployée, exécutez:

```bash
# Vérifier le statut de la migration
curl https://votre-app.railway.app/api/migration-057/status

# Exécuter la migration
curl -X POST https://votre-app.railway.app/api/migration-057/run
```

### Option B: Via l'Interface Admin

Si vous avez un panneau d'administration des migrations:
1. Allez dans **Admin** → **Migrations**
2. Trouvez **Migration 057: Declaration Attachments**
3. Cliquez sur **Run Migration**

---

## ✅ Étape 4: Vérification et Tests

### 1. Vérifier la Création des Dossiers

Consultez les logs Railway au démarrage:

```
📁 Verifying upload directories...
📁 Base uploads path: /app/server/uploads (from UPLOADS_PATH env)
  ✓ Directory exists: /app/server/uploads
  ✓ Directory exists: /app/server/uploads/backgrounds
  ✓ Directory exists: /app/server/uploads/fonts
  ✓ Directory exists: /app/server/uploads/profiles
  ✓ Directory exists: /app/server/uploads/declarations
```

### 2. Tester l'Upload de Photos Étudiants

1. Allez dans **Admin** → **Students**
2. Créez ou éditez un étudiant
3. Uploadez une photo de profil (max 3 MB)
4. Vérifiez que la photo s'affiche correctement

### 3. Tester l'Upload de Backgrounds Certificats

1. Allez dans **Admin** → **Certificate Templates**
2. Sélectionnez un template
3. Uploadez un background (max 5 MB)
4. Vérifiez l'aperçu

### 4. Tester l'Upload de Polices Personnalisées

1. Allez dans **Admin** → **Certificate Templates**
2. Cliquez sur **Custom Fonts**
3. Uploadez une police TTF/OTF (max 2 MB)
4. Utilisez la police dans un template

### 5. Tester les Pièces Jointes de Déclarations [NOUVEAU]

1. **En tant que Professeur:**
   - Allez dans **Mes Déclarations**
   - Ouvrez ou créez une déclaration
   - Dans la section "Pièces jointes":
     - Drag & drop un fichier PDF ou Excel
     - Ou cliquez sur "Ajouter un fichier"
   - Vérifiez que le fichier apparaît dans la liste
   - Téléchargez le fichier pour vérifier l'intégrité

2. **En tant qu'Admin/Gérant:**
   - Allez dans **Gestion** → **Déclarations**
   - Ouvrez une déclaration avec pièces jointes
   - Vérifiez que vous pouvez voir et télécharger les fichiers

### 6. Endpoint de Diagnostic (Certificats)

Testez l'endpoint de diagnostic pour vérifier les permissions:

```bash
curl https://votre-app.railway.app/api/certificate-templates/debug/storage
```

Réponse attendue:
```json
{
  "success": true,
  "uploadsDir": "/app/server/uploads",
  "subdirectories": {
    "backgrounds": {
      "exists": true,
      "writable": true,
      "path": "/app/server/uploads/backgrounds"
    },
    "fonts": {
      "exists": true,
      "writable": true,
      "path": "/app/server/uploads/fonts"
    }
  }
}
```

---

## 📊 Surveillance de l'Espace Disque

### Via Railway Dashboard

1. **Service** → **Metrics** → **Volume Usage**
2. Surveillez l'utilisation de l'espace
3. Augmentez la taille du volume si nécessaire

### Estimation de l'Espace Nécessaire

| Nombre d'Étudiants | Photos (~500 KB) | Déclarations (3 docs/prof) | Total Estimé |
|---------------------|------------------|----------------------------|--------------|
| 100 étudiants | 50 MB | 150 MB | ~250 MB |
| 500 étudiants | 250 MB | 750 MB | ~1.2 GB |
| 1000 étudiants | 500 MB | 1.5 GB | ~2.2 GB |

**Recommandation initiale:** 2 GB
**Recommandation pour 1000+ étudiants:** 5 GB

---

## 🔧 Dépannage

### Problème: "UPLOADS_PATH not defined"

**Solution:**
1. Vérifiez que la variable d'environnement `UPLOADS_PATH` est définie dans Railway
2. Valeur attendue: `/app/server/uploads`
3. Redéployez après modification

### Problème: "Permission denied" lors de l'upload

**Cause:** Le volume n'est pas monté correctement

**Solution:**
1. Vérifiez le mount path dans Railway: `/app/server/uploads`
2. Vérifiez les logs au démarrage
3. Recréez le volume si nécessaire

### Problème: Fichiers perdus après redéploiement

**Cause:** Volume non persistant ou mal configuré

**Solution:**
1. Vérifiez que le volume est de type **Persistent** (pas Ephemeral)
2. Vérifiez que le mount path est correct
3. Les fichiers dans `/app/server/uploads` doivent persister entre les déploiements

### Problème: Upload échoue avec "File too large"

**Solutions selon le type:**
- **Photos étudiants:** Max 3 MB → Réduire la taille de l'image
- **Backgrounds:** Max 5 MB → Compresser l'image
- **Polices:** Max 2 MB → Utiliser format WOFF2 (plus compact)
- **Déclarations:** Max 10 MB → Compresser le PDF ou diviser le fichier

### Problème: "Declaration not found" lors de l'upload d'attachment

**Cause:** La déclaration n'existe pas ou l'utilisateur n'a pas accès

**Solution:**
1. Vérifiez que la déclaration existe
2. Vérifiez les permissions de l'utilisateur (SBAC)
3. Un professeur ne peut ajouter des pièces jointes qu'à ses propres déclarations

---

## 🔒 Sécurité

### Validation des Fichiers

L'application valide automatiquement:
- ✅ Type MIME du fichier
- ✅ Extension du fichier
- ✅ Taille du fichier
- ✅ Permissions de l'utilisateur (SBAC)

### Permissions d'Accès

| Action | Admin | Gérant | Professeur | Comptable |
|--------|-------|--------|------------|-----------|
| Upload attachment | ✅ | ✅ | ✅ (ses déclarations) | ❌ |
| View attachments | ✅ | ✅ | ✅ (ses déclarations) | ✅ |
| Delete attachment | ✅ | ✅ | ✅ (ses déclarations) | ❌ |

### Scope-Based Access Control (SBAC)

- Les professeurs ne voient que les déclarations de leurs segments/villes assignés
- Les pièces jointes suivent automatiquement les règles SBAC
- Un professeur ne peut pas accéder aux pièces jointes d'un autre professeur

---

## 📝 Routes API Ajoutées

### Upload Attachment
```http
POST /api/declarations/:declarationId/attachments
Content-Type: multipart/form-data

body: { attachment: File }
```

### List Attachments
```http
GET /api/declarations/:declarationId/attachments
```

### Delete Attachment
```http
DELETE /api/declarations/:declarationId/attachments/:attachmentId
```

### Fichier Statique
```http
GET /uploads/declarations/:filename
```

---

## 🎯 Checklist de Déploiement

- [ ] Volume Railway créé avec mount path `/app/server/uploads`
- [ ] Variable `UPLOADS_PATH=/app/server/uploads` définie
- [ ] Migration 057 exécutée avec succès
- [ ] Logs montrent création des 4 dossiers (profiles, backgrounds, fonts, declarations)
- [ ] Test upload photo étudiant réussi
- [ ] Test upload background certificat réussi
- [ ] Test upload police personnalisée réussi
- [ ] Test upload pièce jointe déclaration réussi
- [ ] Test téléchargement fichier réussi
- [ ] Test suppression fichier réussi
- [ ] Vérification espace disque disponible
- [ ] Backup plan en place (Railway fait des snapshots automatiques)

---

## 📚 Ressources

- [Railway Volumes Documentation](https://docs.railway.app/reference/volumes)
- [Railway Hobby Plan](https://railway.app/pricing)
- Fichiers modifiés dans cette migration:
  - `server/src/middleware/upload.js` - Configuration chemins
  - `server/.env.example` - Documentation variables
  - `.gitignore` - Exclusion uploads
  - `server/src/routes/migration-057-declaration-attachments.js` - Migration DB
  - `server/src/routes/declarations.js` - Routes API
  - `src/types/declarations.ts` - Types TypeScript
  - `src/lib/api/declarations-attachments.ts` - Client API
  - `src/components/admin/declarations/DeclarationAttachmentsManager.tsx` - UI

---

## 🆘 Support

En cas de problème:
1. Consultez les logs Railway: `railway logs`
2. Testez l'endpoint diagnostic: `/api/certificate-templates/debug/storage`
3. Vérifiez la migration: `/api/migration-057/status`
4. Vérifiez les permissions dans la base de données

**Note:** Les fichiers uploadés sont stockés dans le volume Railway et persistent entre les redéploiements. Assurez-vous de ne jamais supprimer le volume sans backup préalable!
