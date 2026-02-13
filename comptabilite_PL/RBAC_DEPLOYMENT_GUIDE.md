# Guide de Déploiement - Système RBAC (Rôles et Permissions)

## 🎯 Résumé

Ce guide vous explique comment déployer le nouveau système de gestion des rôles et permissions (RBAC - Role-Based Access Control) dans votre application.

## 📦 Fichiers Créés/Modifiés

### Backend (Server)
- ✅ `server/src/middleware/auth.js` - Middleware JWT et vérification des permissions
- ✅ `server/src/routes/auth.js` - Authentification avec tokens JWT
- ✅ `server/src/routes/roles.js` - API de gestion des rôles
- ✅ `server/src/routes/migration-029-rbac-system.js` - Migration base de données
- ✅ `server/src/index.js` - Enregistrement des nouvelles routes
- ✅ `server/.env.example` - Configuration exemple avec JWT_SECRET
- ✅ `server/backup-database.js` - Script de sauvegarde

### Frontend
- ✅ `src/lib/api/client.ts` - Client API avec gestion des tokens JWT
- ✅ `src/lib/api/auth.ts` - API d'authentification améliorée
- ✅ `src/lib/api/roles.ts` - API de gestion des rôles
- ✅ `src/contexts/AuthContext.tsx` - Contexte avec permissions
- ✅ `src/pages/admin/RolesManagement.tsx` - Interface admin de gestion des rôles
- ✅ `src/App.tsx` - Route ajoutée
- ✅ `src/components/layout/Sidebar.tsx` - Menu ajouté

---

## 🚀 Étapes de Déploiement

### ÉTAPE 1 : Configurer JWT_SECRET (CRITIQUE)

Ajoutez ces variables dans votre fichier `server/.env` :

```bash
# Génération d'un secret sécurisé (exécutez cette commande) :
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ajoutez dans .env :
JWT_SECRET=<votre_secret_généré>
JWT_EXPIRES_IN=24h
```

⚠️ **IMPORTANT** : Ne jamais utiliser le secret par défaut en production !

### ÉTAPE 2 : Sauvegarder la Base de Données

```bash
cd server
node backup-database.js
```

Cela créera un fichier dans `server/backups/` avec toutes vos données.

### ÉTAPE 3 : Installer les Dépendances

```bash
cd server
npm install jsonwebtoken express-rate-limit
```

### ÉTAPE 4 : Exécuter la Migration RBAC

Démarrez le serveur puis exécutez :

```bash
# Via API (POST) :
curl -X POST http://localhost:3001/api/migration-029/run

# Ou via votre navigateur, faites un POST vers :
# http://localhost:3001/api/migration-029/run
```

Cette migration :
- Crée les tables `roles`, `permissions`, `role_permissions`
- Ajoute la colonne `role_id` à `profiles`
- Insère les rôles par défaut (admin, gerant, professor, assistante, comptable, superviseur)
- Insère 35+ permissions granulaires
- Migre vos utilisateurs existants vers le nouveau système
- **NE SUPPRIME AUCUNE DONNÉE EXISTANTE**

### ÉTAPE 5 : Vérifier le Statut de Migration

```bash
curl http://localhost:3001/api/migration-029/status
```

Vous devriez voir :
```json
{
  "success": true,
  "migrationComplete": true,
  "checks": {
    "rolesTableExists": true,
    "permissionsTableExists": true,
    "rolePermissionsTableExists": true,
    "roleIdColumnExists": true,
    "rolesCount": 6,
    "permissionsCount": 35,
    "migratedUsersCount": <nombre_de_vos_utilisateurs>
  }
}
```

### ÉTAPE 6 : Tester l'Application

1. Redémarrez le serveur backend
2. Reconnectez-vous à l'application (votre ancien token ne sera plus valide)
3. Accédez à **Gestion Comptable > Rôles & Permissions**

---

## 🔐 Fonctionnalités Implémentées

### 1. Authentification JWT
- Tokens sécurisés avec expiration (24h par défaut)
- Rate limiting sur la connexion (5 tentatives / 15 min)
- Refresh de token automatique
- Déconnexion sécurisée

### 2. Rôles Dynamiques
Vous pouvez maintenant créer des rôles personnalisés comme :
- **Assistante** - Génération de documents seulement
- **Comptable** - Gestion financière
- **Superviseur** - Vue d'ensemble sans modification
- Et plus encore...

### 3. Permissions Granulaires (35+ permissions)

| Module | Permissions Disponibles |
|--------|------------------------|
| **Utilisateurs** | view, create, edit, delete, manage_roles |
| **Étudiants** | view, create, edit, delete, manage_status |
| **Sessions** | view, create, edit, delete, manage_students, manage_professors |
| **Documents** | generate, bulk_generate, view_templates, manage_templates |
| **Finances** | view, manage_payments, manage_discounts, view_reports |
| **Formations** | view, create, edit, delete |
| **Paramètres** | view, edit, manage_segments, manage_cities, manage_corps |
| **Rapports** | view, export, dashboard |

### 4. Interface Admin
- Création de nouveaux rôles avec nom et description
- Attribution de permissions par module
- Visualisation des utilisateurs par rôle
- Protection des rôles système (admin ne peut pas être supprimé)

---

## 🛡️ Sécurité

### Ce qui est Protégé
- ✅ Toutes les routes API nécessitent un token JWT valide
- ✅ Les tokens expirent automatiquement (24h)
- ✅ Les permissions sont vérifiées côté serveur
- ✅ Rate limiting contre les attaques par force brute
- ✅ Les mots de passe restent hashés avec bcrypt

### Points d'Attention
⚠️ **IMPORTANT** : Les routes API ne sont pas encore toutes protégées individuellement. Pour une sécurité maximale, vous devrez ajouter le middleware `requirePermission()` sur chaque route sensible.

Exemple :
```javascript
// Dans server/src/routes/students.js
import { authenticateToken, requirePermission } from '../middleware/auth.js';

router.get('/', authenticateToken, requirePermission('students.view'), async (req, res) => {
  // ...
});

router.post('/', authenticateToken, requirePermission('students.create'), async (req, res) => {
  // ...
});
```

---

## 🔄 Rollback (En Cas de Problème)

Si vous devez annuler la migration :

```bash
curl -X POST http://localhost:3001/api/migration-029/rollback
```

Cela supprimera les nouvelles tables mais conservera l'ancien système de rôles (colonne `role` dans `profiles`).

Pour restaurer complètement vos données depuis le backup :
```bash
cd server
node backup-database.js restore backups/backup_XXXXX.json
```

---

## 📋 Prochaines Étapes Recommandées

1. **Tester en environnement de développement** avant la production
2. **Mettre à jour Railway** avec la variable JWT_SECRET
3. **Protéger les routes sensibles** avec `requirePermission()`
4. **Former les administrateurs** sur le nouveau système
5. **Documenter les rôles** créés et leurs responsabilités

---

## 📞 Support

En cas de problème :
1. Vérifiez les logs du serveur
2. Vérifiez le statut de la migration : `GET /api/migration-029/status`
3. Utilisez le backup pour restaurer si nécessaire

**Bon déploiement !** 🚀
