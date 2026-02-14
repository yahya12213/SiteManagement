# Guide de Déploiement sur Railway

Ce guide vous explique comment déployer l'application complète (Frontend + Backend + PostgreSQL) sur Railway.

## 🏗️ Architecture de Déploiement

- **Service 1**: Backend Express (Node.js)
- **Service 2**: Frontend Vite (React + TypeScript)
- **Service 3**: PostgreSQL Database

## 📋 Prérequis

1. Compte GitHub avec le repository poussé
2. Compte Railway (https://railway.app)
3. Connexion GitHub ↔ Railway

## 🚀 Étapes de Déploiement

### 1️⃣ Créer un Nouveau Projet Railway

1. Connectez-vous à [Railway](https://railway.app)
2. Cliquez sur "New Project"
3. Sélectionnez "Deploy from GitHub repo"
4. Choisissez votre repository `comptabilite_PL`

### 2️⃣ Ajouter la Base de Données PostgreSQL

1. Dans votre projet, cliquez sur "+ New"
2. Sélectionnez "Database" → "PostgreSQL"
3. Railway créera automatiquement la base de données
4. Notez les variables d'environnement générées (vous les verrez dans l'onglet "Variables")

### 3️⃣ Configurer le Service Backend

1. Railway devrait auto-détecter le dossier `server`
2. Si ce n'est pas le cas:
   - Cliquez sur le service
   - Allez dans "Settings" → "Source"
   - Définissez "Root Directory" à `/server`

3. **Variables d'Environnement du Backend**:
   ```
   DB_HOST=<fourni par Railway PostgreSQL>
   DB_PORT=<fourni par Railway PostgreSQL>
   DB_NAME=<fourni par Railway PostgreSQL>
   DB_USER=<fourni par Railway PostgreSQL>
   DB_PASSWORD=<fourni par Railway PostgreSQL>
   PORT=3001
   ```

   **Note**: Railway fournit automatiquement une variable `DATABASE_URL`. Vous devrez peut-être adapter `server/src/config/database.js` pour l'utiliser:

   ```javascript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: {
       rejectUnauthorized: false
     }
   });
   ```

4. **Build Command** (normalement auto-détecté):
   ```
   npm install
   ```

5. **Start Command**:
   ```
   npm start
   ```

6. Déployez en cliquant sur "Deploy"

### 4️⃣ Initialiser la Base de Données

Une fois le backend déployé:

1. Ouvrez un shell Railway pour le service backend
2. Exécutez la commande de setup:
   ```bash
   npm run db:setup
   ```

Cela créera toutes les tables nécessaires.

### 5️⃣ Configurer le Service Frontend

1. Cliquez sur "+ New" → "GitHub Repo"
2. Sélectionnez le même repository
3. Configurez:
   - **Root Directory**: `/` (racine)
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run preview` (ou utilisez un serveur statique)

4. **Variables d'Environnement du Frontend**:
   ```
   VITE_API_URL=https://<votre-backend>.up.railway.app/api
   ```

   Remplacez `<votre-backend>` par l'URL publique du backend Railway.

5. Pour obtenir l'URL du backend:
   - Allez dans le service backend
   - Onglet "Settings" → "Networking"
   - Copiez l'URL publique

6. Déployez le frontend

### 6️⃣ Vérification

1. **Backend**: Testez l'endpoint de santé
   ```
   https://<votre-backend>.up.railway.app/api/health
   ```

   Devrait retourner: `{ "status": "OK", "database": "Connected" }`

2. **Frontend**: Ouvrez l'URL du frontend
   ```
   https://<votre-frontend>.up.railway.app
   ```

3. **Test de Connexion**:
   - Username: `admin`
   - Password: `admin123`

## 🔧 Configuration Avancée

### Domaines Personnalisés

1. Service Backend ou Frontend → "Settings" → "Domains"
2. Cliquez sur "Generate Domain" ou "Add Custom Domain"
3. Mettez à jour `VITE_API_URL` dans le frontend si vous changez le domaine backend

### Variables d'Environnement

Toutes les variables peuvent être modifiées dans:
**Service → Variables → Raw Editor**

### Logs et Monitoring

- Consultez les logs en temps réel dans l'onglet "Deployments"
- Cliquez sur un déploiement pour voir les logs détaillés

## 💰 Coûts Estimés

- **PostgreSQL**: ~$2/mois
- **Backend Service**: ~$3/mois
- **Frontend Service**: ~$2/mois
- **Total**: ~$7/mois

Les premiers $5 sont gratuits chaque mois avec Railway.

## 🐛 Dépannage

### Le backend ne se connecte pas à PostgreSQL

- Vérifiez que toutes les variables `DB_*` sont correctement définies
- Assurez-vous que `DATABASE_URL` est utilisée si vous ne définissez pas manuellement les variables

### Le frontend ne peut pas communiquer avec le backend

- Vérifiez que `VITE_API_URL` pointe vers la bonne URL du backend
- Vérifiez les CORS dans `server/src/index.js`

### Erreurs de build

- Consultez les logs de build dans Railway
- Assurez-vous que `package.json` a les bonnes commandes `build` et `start`

## 📝 Commandes Utiles

```bash
# Logs en temps réel (via Railway CLI)
railway logs --service backend
railway logs --service frontend

# Accéder au shell du service
railway shell --service backend

# Redémarrer un service
railway restart --service backend
```

## ✅ Checklist de Déploiement

- [ ] PostgreSQL créée et connectée
- [ ] Backend déployé avec variables d'environnement
- [ ] Base de données initialisée (`npm run db:setup`)
- [ ] Frontend déployé avec `VITE_API_URL` correcte
- [ ] Test de connexion réussi
- [ ] Logs backend sans erreurs
- [ ] Logs frontend sans erreurs

## 🔗 Liens Utiles

- [Documentation Railway](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Support Railway](https://railway.app/help)

---

**Note**: Après chaque push sur `main`, Railway redéploiera automatiquement les services!
