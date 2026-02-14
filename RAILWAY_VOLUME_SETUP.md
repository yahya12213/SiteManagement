# Configuration du Volume Railway pour le Stockage Persistant

## Pourquoi c'est nécessaire

Par défaut, Railway utilise un système de fichiers **éphémère**. Cela signifie que :
- ❌ Les fichiers uploadés (photos d'étudiants) sont **perdus** à chaque redéploiement
- ❌ À chaque mise à jour du code, toutes les photos disparaissent
- ❌ Les redémarrages de conteneur suppriment les uploads

**Solution** : Créer un **Volume Railway** pour un stockage persistant.

---

## Guide de Configuration

### Étape 1 : Accéder au Dashboard Railway

1. Connectez-vous à [Railway Dashboard](https://railway.app)
2. Sélectionnez votre projet `comptabilite_PL`
3. Cliquez sur votre service (probablement nommé `web` ou `main`)

### Étape 2 : Créer le Volume

1. Dans la page du service, allez dans l'onglet **"Settings"**
2. Faites défiler jusqu'à la section **"Volumes"**
3. Cliquez sur le bouton **"New Volume"** ou **"+ Add Volume"**

### Étape 3 : Configurer le Volume

Remplissez les informations suivantes :

| Champ | Valeur |
|-------|--------|
| **Mount Path** | `/app/server/uploads` |
| **Size** | Commencez avec 1 GB (peut être augmenté plus tard) |

**Important** : Le Mount Path DOIT être exactement `/app/server/uploads`

### Étape 4 : Enregistrer et Redéployer

1. Cliquez sur **"Add"** ou **"Create Volume"**
2. Railway va automatiquement redéployer votre application
3. Attendez que le déploiement soit terminé (environ 2-5 minutes)

---

## Vérification

Une fois le volume créé et le déploiement terminé :

1. **Testez l'upload d'une photo** :
   - Allez dans une session de formation
   - Cliquez sur la photo d'un étudiant (ou ses initiales)
   - Uploadez et recadrez une photo
   - Cliquez "Enregistrer"

2. **Vérifiez la persistance** :
   - Déclenchez un nouveau déploiement (push un petit changement)
   - Attendez la fin du déploiement
   - ✅ La photo devrait toujours être visible après le redéploiement

---

## Logs de Vérification

Après le déploiement avec le volume configuré, vérifiez les logs Railway :

Vous devriez voir ces lignes au démarrage :
```
📁 Uploads path: /app/server/uploads
📂 Uploads exists? true
🌍 Environment: production
📁 Created profiles subdirectory
📁 Created backgrounds subdirectory
📁 Created fonts subdirectory
```

---

## Troubleshooting

### ❌ Problème : Les photos disparaissent toujours

**Solution** : Vérifiez que :
1. Le Mount Path est exactement `/app/server/uploads` (sensible à la casse)
2. Le volume est bien lié au bon service
3. Le déploiement a réussi sans erreurs

### ❌ Problème : Erreur "Permission denied"

**Solution** : Railway gère automatiquement les permissions. Si vous voyez cette erreur :
1. Supprimez le volume
2. Recréez-le avec exactement le même Mount Path
3. Redéployez

### ❌ Problème : "Volume not found"

**Solution** : Le volume prend quelques secondes à se monter. Attendez 30 secondes et rafraîchissez.

---

## Capacité du Volume

### Combien d'espace est nécessaire ?

| Nombre de photos | Espace estimé |
|------------------|---------------|
| 100 photos | ~50 MB |
| 500 photos | ~250 MB |
| 1000 photos | ~500 MB |
| 5000 photos | ~2.5 GB |

**Recommandation** : Commencez avec **1 GB** et augmentez si nécessaire.

### Comment augmenter la taille ?

1. Allez dans Settings → Volumes
2. Cliquez sur le volume existant
3. Modifiez la taille
4. Enregistrez (pas besoin de redéployer)

---

## Coût

- Railway offre **100 GB gratuits** de stockage volume
- Au-delà : ~$0.25/GB/mois
- Pour une application de gestion d'étudiants : **coût négligeable**

---

## Alternative : Migration vers Cloudinary (futur)

Si vous avez besoin de plus de fonctionnalités (CDN, optimisation automatique, etc.) :

1. Créer compte Cloudinary (gratuit jusqu'à 25 crédits/mois)
2. Ajouter variables d'environnement :
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Modifier `server/src/middleware/upload.js` pour utiliser Cloudinary

Mais pour l'instant, **Railway Volumes suffisent largement**.

---

## Résumé

✅ **Volume créé** : `/app/server/uploads`
✅ **Taille** : 1 GB minimum
✅ **Photos persistantes** : Même après redéploiement
✅ **Prêt à utiliser** : Upload et recadrage fonctionnels

---

**Note** : Cette configuration est déjà préparée dans le code (`railway.toml` et `server/src/index.js`). Vous devez juste créer le volume dans le Dashboard Railway !
