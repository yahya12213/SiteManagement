# 🔍 Guide de Diagnostic : Compte "Saadaoui Amine"

## Problème Observé
L'utilisateur "Saadaoui Amine" (rôle: Professor) voit **0 déclarations** sur la page "Gestion des Déclarations".

## Cause Possible
Le système SBAC (Scope-Based Access Control) filtre les déclarations par **segment ET ville**. Si l'utilisateur n'a pas de segments ou villes assignés, le filtre bloque tout.

---

## 🚀 Méthode 1 : Diagnostic Rapide (Recommandé)

### Étape 1 : Accéder à Railway Database

1. Allez sur **Railway Dashboard** : https://railway.app
2. Sélectionnez votre projet
3. Cliquez sur la base de données **PostgreSQL**
4. Cliquez sur l'onglet **"Data"** ou **"Query"**

### Étape 2 : Exécuter le Script Rapide

Copiez-collez tout le contenu du fichier `diagnostic-quick.sql` dans l'éditeur SQL de Railway et exécutez-le.

**Résultat attendu :**

| Colonne | Valeur Exemple | Signification |
|---------|----------------|---------------|
| user_id | abc-123-xyz | ID de l'utilisateur |
| username | saadaoui.amine | Username |
| full_name | Saadaoui Amine | Nom complet |
| role | professor | Rôle |
| Segments Assignés | {Prolean, TechCorp} | Liste des segments |
| Nombre Segments | 2 | Nombre de segments assignés |
| Villes Assignées | {Khemisset, Casablanca} | Liste des villes |
| Nombre Villes | 2 | Nombre de villes assignées |
| Déclarations Visibles | 5 | Nombre de déclarations dans le scope |
| Total Déclarations DB | 50 | Total de déclarations en base |
| **Diagnostic** | **Message d'erreur ou OK** | **IMPORTANT** |

### Étape 3 : Interpréter le Diagnostic

| Diagnostic | Signification | Action à Faire |
|------------|---------------|----------------|
| ❌ PROBLÈME: Aucun segment assigné | Pas de segments → Filtre bloque tout | **Assigner des segments** (voir ci-dessous) |
| ❌ PROBLÈME: Aucune ville assignée | Pas de villes → Filtre bloque tout | **Assigner des villes** (voir ci-dessous) |
| ⚠️  ATTENTION: Scope configuré mais aucune déclaration | A des segments ET villes, mais pas de données | **Créer une déclaration de test** |
| ✅ OK: Déclarations visibles | Tout est OK | **Bug possible dans le frontend** |

---

## 🛠️ Méthode 2 : Diagnostic Complet (Détaillé)

Si vous voulez plus de détails, utilisez le fichier `diagnostic-saadaoui-amine.sql`.

### Important :
Après avoir exécuté l'ÉTAPE 1 pour obtenir l'ID de l'utilisateur, **remplacez `<USER_ID>`** dans toutes les autres requêtes par l'ID réel.

Exemple :
```sql
-- AVANT
WHERE ps.professor_id = '<USER_ID>'

-- APRÈS (si l'ID est "abc-123-xyz")
WHERE ps.professor_id = 'abc-123-xyz'
```

---

## ✅ Actions Correctives

### Cas 1 : Assigner des Segments

1. **Lister les segments disponibles :**
```sql
SELECT id, name, color FROM segments ORDER BY name;
```

2. **Assigner un segment à l'utilisateur :**
```sql
INSERT INTO professor_segments (professor_id, segment_id)
VALUES ('<USER_ID>', '<SEGMENT_ID>');
```

**Exemple concret :**
```sql
-- Trouver l'ID de l'utilisateur
SELECT id FROM profiles WHERE full_name ILIKE '%Saadaoui%';
-- Résultat : 22c5f559-a005-4ef9-940c-869d50c2b5fb

-- Trouver l'ID du segment "Prolean"
SELECT id FROM segments WHERE name = 'Prolean';
-- Résultat : segment-123

-- Assigner
INSERT INTO professor_segments (professor_id, segment_id)
VALUES ('22c5f559-a005-4ef9-940c-869d50c2b5fb', 'segment-123');
```

### Cas 2 : Assigner des Villes

1. **Lister les villes disponibles :**
```sql
SELECT c.id, c.name, s.name as segment_name
FROM cities c
LEFT JOIN segments s ON c.segment_id = s.id
ORDER BY s.name, c.name;
```

2. **Assigner une ville à l'utilisateur :**
```sql
INSERT INTO professor_cities (professor_id, city_id)
VALUES ('<USER_ID>', '<CITY_ID>');
```

**Exemple concret :**
```sql
-- Trouver l'ID de la ville "Khemisset"
SELECT id FROM cities WHERE name = 'Khemisset';
-- Résultat : city-456

-- Assigner
INSERT INTO professor_cities (professor_id, city_id)
VALUES ('22c5f559-a005-4ef9-940c-869d50c2b5fb', 'city-456');
```

### Cas 3 : Créer une Déclaration de Test

Si l'utilisateur a des segments ET villes, mais aucune déclaration ne correspond :

```sql
-- 1. Récupérer l'ID d'une fiche de calcul
SELECT id, title FROM calculation_sheets WHERE status = 'published' LIMIT 1;

-- 2. Récupérer les segments/villes de l'utilisateur
SELECT ps.segment_id, pc.city_id
FROM professor_segments ps
CROSS JOIN professor_cities pc
WHERE ps.professor_id = '<USER_ID>'
  AND pc.professor_id = '<USER_ID>'
LIMIT 1;

-- 3. Créer une déclaration de test
INSERT INTO professor_declarations (
  id,
  professor_id,
  calculation_sheet_id,
  segment_id,
  city_id,
  start_date,
  end_date,
  form_data,
  status
)
VALUES (
  gen_random_uuid()::text,
  '<USER_ID>',
  '<SHEET_ID>',
  '<SEGMENT_ID_FROM_STEP_2>',
  '<CITY_ID_FROM_STEP_2>',
  '2025-01-01',
  '2025-01-31',
  '{}',
  'brouillon'
);
```

---

## 🧪 Vérification Après Correction

1. **Exécuter à nouveau le diagnostic rapide** pour vérifier que les affectations sont bien enregistrées

2. **Tester dans le navigateur** :
   - Déconnectez-vous
   - Reconnectez-vous avec le compte "Saadaoui Amine"
   - Allez sur "Gestion des Déclarations"
   - Vérifiez que les déclarations apparaissent

3. **Vérifier les logs Railway** :
```bash
railway logs --follow
```
Cherchez la ligne :
```
Declarations query: { isAdmin: false, segments: X, cities: Y }
```
- Si `segments: 0` → Problème persiste
- Si `segments: 1, cities: 1` → OK ✓

---

## 📊 Utilisation via Railway CLI (Alternative)

Si vous préférez utiliser la ligne de commande :

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Sélectionner le projet
railway link

# 4. Se connecter à la base de données
railway run psql $DATABASE_URL

# 5. Dans psql, exécuter le script
\i server/diagnostic-quick.sql
```

---

## 🆘 Support

Si après avoir suivi ce guide le problème persiste :

1. Copiez les résultats du diagnostic rapide
2. Copiez les logs Railway (dernières 50 lignes)
3. Prenez une capture d'écran de la page
4. Ouvrez un ticket avec ces informations

---

## ✅ Checklist de Vérification

- [ ] Exécuté le diagnostic rapide
- [ ] Identifié l'ID de l'utilisateur
- [ ] Vérifié les segments assignés
- [ ] Vérifié les villes assignées
- [ ] Corrigé les affectations si nécessaires
- [ ] Re-testé dans le navigateur
- [ ] Vérifié les logs Railway
- [ ] Confirmé que les déclarations apparaissent
