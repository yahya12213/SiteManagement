# CONSIGNES POUR LES SESSIONS DE PROGRAMMATION

> **NOTE**: Ce fichier est temporaire et sera supprime apres utilisation.

---

## 1. AVANT CHAQUE CHANGEMENT

### Consulter le code existant
- Toujours lire le code source AVANT de proposer des modifications
- Comprendre la logique existante et les patterns utilises
- Verifier les tables et colonnes utilisees dans les requetes SQL

### Consulter la Base de Donnees Railway
Utiliser cette connexion pour verifier les donnees et la structure:

```
postgresql://postgres:kMfsYpEZqZorPiMaUPvQnOoBqysrEjQx@maglev.proxy.rlwy.net:17589/railway
```

**Commande de connexion:**
```bash
PGPASSWORD=kMfsYpEZqZorPiMaUPvQnOoBqysrEjQx psql -h maglev.proxy.rlwy.net -p 17589 -U postgres -d railway
```

**Requetes utiles:**
```sql
-- Lister les tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Voir la structure d'une table
\d nom_table

-- Verifier les donnees
SELECT * FROM table LIMIT 10;
```

---

## 2. TABLES IMPORTANTES A CONNAITRE

| Domaine | Table Francaise | Table Anglaise |
|---------|-----------------|----------------|
| Sessions | `sessions_formation` | `formation_sessions` |
| Etudiants inscrits | `session_etudiants` | `formation_enrollments` |
| Prospects | `prospects` | - |
| Profils utilisateurs | `profiles` | - |
| Segments | `professor_segments` | - |
| Villes | `professor_cities` | - |

**ATTENTION**: Les sessions utilisent les tables FRANCAISES (`sessions_formation`, `session_etudiants`)

---

## 3. APRES CHAQUE CHANGEMENT

### Commit et Push vers Railway
```bash
cd "c:\Users\pc\Desktop\systeme de calcul"
git add .
git commit -m "description du changement"
git push
```

### Verifier le deploiement
- Attendre 1-2 minutes pour le deploiement Railway
- Tester la fonctionnalite modifiee dans l'application

---

## 4. INFORMATIONS PROJET

- **Depot Git**: https://github.com/barkaamine/comptabilite_PL.git
- **Hebergement**: Railway
- **Base de donnees**: PostgreSQL sur Railway
- **Frontend**: React + TypeScript
- **Backend**: Node.js + Express

---

## 5. CONTACTS / CONTEXTE

- Utilisateur test: Oumayma (role: Assistante Formation en Ligne)
- Segment: Diray
- Ville: Rabat
