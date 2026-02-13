# ✅ Checklist de déploiement - Système de gestion des prospects

## 📋 Pré-déploiement

### Configuration de la base de données
- [ ] PostgreSQL est installé et démarré
- [ ] Variable `DATABASE_URL` est configurée dans `server/.env`
- [ ] Test de connexion PostgreSQL réussi

### Vérification des fichiers
- [ ] Tous les fichiers backend créés (6 fichiers)
- [ ] Tous les fichiers frontend créés (10 fichiers)
- [ ] Tous les fichiers modifiés vérifiés (4 fichiers)
- [ ] Aucune erreur TypeScript dans le projet

---

## 🗄️ Déploiement de la base de données

### Étape 1 : Lancer la migration
```bash
# Option 1 : Via HTTP (serveur doit être démarré)
curl -X POST http://localhost:3001/api/migration-060/run

# Option 2 : Via psql
psql $DATABASE_URL -f server/src/routes/migration-060-prospects-system.js
```

- [ ] Migration exécutée sans erreur
- [ ] Tables créées : `country_phone_config`, `prospects`, `prospect_call_history`, `prospect_notifications`
- [ ] Fonctions créées : `normalize_phone_international()`, `apply_cleaning_decision()`
- [ ] Trigger créé : `update_prospect_decision()`
- [ ] 150+ pays insérés dans `country_phone_config`
- [ ] 11 permissions insérées dans `permissions`

### Étape 2 : Vérifier la migration

```sql
-- Vérifier les tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('country_phone_config', 'prospects', 'prospect_call_history', 'prospect_notifications');
-- Résultat attendu : 4 lignes

-- Vérifier les fonctions
SELECT proname FROM pg_proc WHERE proname IN ('normalize_phone_international', 'apply_cleaning_decision');
-- Résultat attendu : 2 lignes

-- Compter les pays
SELECT COUNT(*) FROM country_phone_config;
-- Résultat attendu : 150+

-- Vérifier les permissions
SELECT code FROM permissions WHERE code LIKE 'commercialisation.prospects%';
-- Résultat attendu : 11 lignes
```

- [ ] Toutes les vérifications passent

---

## 🔐 Configuration des permissions

### Étape 3 : Assigner les permissions aux rôles

**Exemple : Donner toutes les permissions prospects au rôle "Manager"**
```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'Manager'),
  id
FROM permissions
WHERE code LIKE 'commercialisation.prospects%';
```

**Exemple : Donner uniquement les permissions de visualisation à "Assistante"**
```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'Assistante'),
  id
FROM permissions
WHERE code IN (
  'commercialisation.prospects.view_page',
  'commercialisation.prospects.view',
  'commercialisation.prospects.call',
  'commercialisation.prospects.update'
);
```

- [ ] Permissions assignées au rôle Manager
- [ ] Permissions assignées au rôle Assistante
- [ ] Permissions assignées aux autres rôles pertinents

---

## 🧪 Tests backend (API)

### Étape 4 : Obtenir un token d'authentification

```bash
# Login pour obtenir un token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "votre_password"}' \
  | jq -r '.token')

echo $TOKEN  # Vérifier que le token est présent
```

- [ ] Token d'authentification obtenu

### Étape 5 : Tester les endpoints

#### Test 1 : Lister les pays supportés
```bash
curl http://localhost:3001/api/country-codes \
  -H "Authorization: Bearer $TOKEN"
```
- [ ] Response : Liste de 150+ pays avec codes

#### Test 2 : Créer un prospect
```bash
curl -X POST http://localhost:3001/api/prospects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "segment_id": "VOTRE_SEGMENT_ID",
    "phone_international": "+212612345678",
    "nom": "Test",
    "prenom": "Prospect"
  }'
```
- [ ] Response : Prospect créé avec auto-assignation
- [ ] Champs remplis : `country_code`, `country`, `assigned_to`, `ville_id`

#### Test 3 : Lister les prospects
```bash
curl http://localhost:3001/api/prospects?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```
- [ ] Response : Liste paginée avec stats (total, non_contactes, avec_rdv, etc.)

#### Test 4 : Démarrer un appel
```bash
PROSPECT_ID="ID_DU_PROSPECT_CRÉÉ"

curl -X POST http://localhost:3001/api/prospects/$PROSPECT_ID/start-call \
  -H "Authorization: Bearer $TOKEN"
```
- [ ] Response : Appel démarré, `call_start` enregistré

#### Test 5 : Terminer un appel
```bash
curl -X POST http://localhost:3001/api/prospects/$PROSPECT_ID/end-call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "statut_contact": "contacté avec rdv",
    "date_rdv": "2025-12-01 14:00:00",
    "commentaire": "RDV fixé"
  }'
```
- [ ] Response : Prospect mis à jour, durée d'appel calculée

#### Test 6 : Import CSV
```bash
curl -X POST http://localhost:3001/api/prospects/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "segment_id": "VOTRE_SEGMENT_ID",
    "lines": [
      {"phone_international": "+212612345678", "nom": "Alami", "prenom": "Mohammed"},
      {"phone_international": "0612345679", "nom": "Bennani", "prenom": "Fatima"}
    ]
  }'
```
- [ ] Response : Stats d'import (created, reinjected, duplicates, errors)

#### Test 7 : Nettoyage batch (dry-run)
```bash
curl -X POST http://localhost:3001/api/prospects/batch-clean \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"execute_deletion": false}'
```
- [ ] Response : Stats de nettoyage (laisser, supprimer, a_revoir)

#### Test 8 : Réinjection d'un prospect
```bash
curl -X POST http://localhost:3001/api/prospects/$PROSPECT_ID/reinject \
  -H "Authorization: Bearer $TOKEN"
```
- [ ] Response : Prospect réinjecté (statut=nouveau, nouvelle date_injection)

---

## 🖥️ Tests frontend

### Étape 6 : Démarrer le frontend

```bash
cd "c:\Users\pc\Desktop\systeme de calcul"
npm run dev
```

- [ ] Frontend démarré sur http://localhost:5173
- [ ] Aucune erreur de compilation

### Étape 7 : Tester la page principale

**URL** : http://localhost:5173/admin/commercialisation/prospects

#### Vérifications visuelles :
- [ ] **Stats cards** : 6 cartes affichent les bons chiffres
  - Total, Non contactés, Avec RDV, Sans RDV, Inscrits, À supprimer
- [ ] **Filtres** : 6 filtres fonctionnent
  - Segment → Ville (cascade) → Statut → Décision → Recherche (texte + bouton)
- [ ] **Tableau** : Colonnes correctement affichées
  - ID, Téléphone, Pays, Nom & Prénom, Ville, Assigné à, Statut, Décision, Actions
- [ ] **Actions** : Boutons visibles
  - "Ajouter prospect", "Import", "Export", "Actualiser"
- [ ] **Pagination** : Fonctionne (Précédent/Suivant)

#### Test 1 : Ajouter un prospect
- [ ] Clic sur "Ajouter prospect"
- [ ] Modal s'ouvre : QuickAddProspectModal
- [ ] Sélectionner segment (dropdown fonctionne)
- [ ] Sélectionner ville (cascade depuis segment)
- [ ] Saisir téléphone : "+33612345678"
  - [ ] Validation en temps réel : ✅ vert si valide
- [ ] Saisir téléphone invalide : "abc"
  - [ ] Validation : ❌ rouge avec message d'erreur
- [ ] Saisir nom et prénom (optionnel)
- [ ] Clic "Ajouter"
  - [ ] Toast de succès affiché
  - [ ] Modal se ferme
  - [ ] Table se rafraîchit avec nouveau prospect

#### Test 2 : Import CSV
- [ ] Clic sur "Import"
- [ ] Modal s'ouvre : ImportProspectsModal
- [ ] Sélectionner segment
- [ ] Upload fichier CSV (exemple ci-dessous)
  ```csv
  phone,nom,prenom,ville
  +212612345678,Alami,Mohammed,Casablanca
  0612345679,Bennani,Fatima,Rabat
  invalidphone,Test,Test,Test
  ```
- [ ] Parsing automatique
- [ ] Preview affiche 3 lignes
- [ ] Stats : 2 valides (vert), 1 invalide (rouge)
- [ ] Taux de validité : 66%
- [ ] Clic "Importer X prospects"
  - [ ] Toast de succès avec stats (2 créés, 0 réinjectés, 0 doublons)
  - [ ] Modal se ferme

#### Test 3 : Passer un appel
- [ ] Trouver un prospect avec statut "non contacté" ou "nouveau"
- [ ] Clic sur bouton "Appeler" (bleu)
- [ ] Modal s'ouvre : CallProspectModal
- [ ] **Timer démarre automatiquement** : 00:00 → 00:01 → 00:02...
  - [ ] Format MM:SS correct
- [ ] Infos prospect affichées (téléphone, ville, segment, assignée)
- [ ] Sélectionner statut "contacté avec rdv"
  - [ ] Champs RDV apparaissent (date + heure)
- [ ] Remplir date RDV : 2025-12-01
- [ ] Remplir heure RDV : 14:00
- [ ] Saisir commentaire (optionnel)
- [ ] Clic "Terminer l'appel"
  - [ ] Toast affiche durée d'appel
  - [ ] Modal se ferme
  - [ ] Prospect mis à jour dans la table (statut + décision)

#### Test 4 : Filtrer les prospects
- [ ] Sélectionner un segment → table se met à jour
- [ ] Sélectionner une ville → table se met à jour
- [ ] Sélectionner statut "contacté avec rdv" → table filtrée
- [ ] Sélectionner décision "supprimer" → table filtrée
- [ ] Saisir recherche "Alami" + clic rechercher → table filtrée
- [ ] Réinitialiser filtres → tous les prospects affichés

### Étape 8 : Tester le dashboard de nettoyage

**URL** : http://localhost:5173/admin/commercialisation/prospects-cleaning

#### Vérifications visuelles :
- [ ] **Stats cards** : 3 cartes affichées
  - À garder (vert), À supprimer (rouge), À revoir (orange)
- [ ] **Actions** : 3 boutons
  - "Recalculer les décisions", "Supprimer définitivement (X)", "Actualiser"
- [ ] **Tableau** : Prospects marqués "supprimer"
  - Colonnes : Téléphone, Nom, Ville, Statut, Date RDV, Date injection, Actions

#### Test 1 : Recalculer les décisions
- [ ] Clic "Recalculer les décisions"
- [ ] Confirmation demandée
- [ ] Toast de succès avec stats
- [ ] Stats cards mises à jour
- [ ] Tableau mis à jour

#### Test 2 : Réinjecter un prospect
- [ ] Trouver un prospect dans la liste "à supprimer"
- [ ] Clic "Réinjecter"
- [ ] Confirmation demandée
- [ ] Toast de succès
- [ ] Prospect disparaît de la liste "à supprimer"
- [ ] Stats mises à jour

#### Test 3 : Suppression définitive (ATTENTION)
⚠️ **IMPORTANT** : Ce test est destructif et irréversible

- [ ] Clic "Supprimer définitivement (X)"
- [ ] **Première confirmation** : Alerte avec nombre de prospects
- [ ] **Deuxième confirmation** : "Dernière chance pour annuler"
- [ ] Toast de succès avec nombre de prospects supprimés
- [ ] Tableau vidé (ou prospects restants si pagination)
- [ ] Stats mises à jour (nombre "à supprimer" = 0)

---

## 🔍 Vérifications post-déploiement

### Étape 9 : Vérifications finales

#### Base de données
```sql
-- Vérifier les prospects créés
SELECT COUNT(*) FROM prospects;

-- Vérifier les appels enregistrés
SELECT COUNT(*) FROM prospect_call_history;

-- Vérifier la distribution par décision
SELECT decision_nettoyage, COUNT(*) FROM prospects GROUP BY decision_nettoyage;

-- Vérifier les pays utilisés
SELECT country, COUNT(*) FROM prospects GROUP BY country ORDER BY COUNT(*) DESC;
```

- [ ] Au moins quelques prospects créés
- [ ] Historique d'appels enregistré
- [ ] Décisions de nettoyage calculées correctement
- [ ] Pays correctement identifiés

#### Logs serveur
- [ ] Aucune erreur dans les logs backend
- [ ] Requêtes SQL exécutées correctement
- [ ] Authentification fonctionne
- [ ] SBAC filtering actif (utilisateur voit uniquement ses scopes)

#### Console frontend
- [ ] Aucune erreur dans la console navigateur
- [ ] React Query cache fonctionne
- [ ] Invalidations de cache se produisent après mutations
- [ ] Pas d'avertissements TypeScript

---

## 📊 Performance et optimisation

### Étape 10 : Tests de performance (optionnel)

#### Import en masse
- [ ] Importer 100 prospects via CSV
  - Temps : _____ secondes
  - Résultat : _____ créés, _____ réinjectés, _____ doublons
- [ ] Importer 1000 prospects via CSV
  - Temps : _____ secondes
  - Résultat : _____ créés, _____ réinjectés, _____ doublons

#### Nettoyage batch
- [ ] Recalculer décisions pour 100 prospects
  - Temps : _____ secondes
- [ ] Recalculer décisions pour 1000 prospects
  - Temps : _____ secondes

#### Temps de chargement page
- [ ] Page prospects avec 50 résultats : _____ ms
- [ ] Page prospects avec filtres actifs : _____ ms
- [ ] Dashboard de nettoyage : _____ ms

---

## ✅ Déploiement réussi !

Si toutes les cases sont cochées, votre système de gestion des prospects est déployé avec succès et prêt pour la production !

### Prochaines étapes recommandées :

1. **Formation des utilisateurs**
   - Former les agents d'entrée sur l'ajout/import de prospects
   - Former les assistantes sur le passage d'appels et la qualification
   - Former les managers sur le dashboard de nettoyage

2. **Surveillance**
   - Monitorer les logs pour détecter les erreurs
   - Vérifier régulièrement les stats de nettoyage
   - Analyser les taux de conversion (nouveau → inscrit)

3. **Optimisations futures**
   - Implémenter l'export CSV
   - Ajouter les notifications J-1 pour les RDV
   - Créer un dashboard analytique (graphiques)
   - Intégrer un système de téléphonie (Twilio, etc.)

---

**Date de déploiement** : ___________________
**Déployé par** : ___________________
**Environnement** : Production / Staging / Development
**Version** : 1.0.0
