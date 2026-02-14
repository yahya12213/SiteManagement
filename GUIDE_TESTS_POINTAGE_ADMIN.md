# Guide de Tests - Correction et Déclaration de Pointages Admin

## Préparation

### 1. Appliquer la migration de base de données

Exécutez le script SQL suivant pour ajouter les colonnes de tracking :

```bash
psql -U <votre_utilisateur> -d <votre_base_de_donnees> -f server/migrations/127-admin-correction-tracking.sql
```

OU si vous utilisez un outil comme pgAdmin, exécutez le contenu du fichier directement.

### 2. Démarrer l'application

```bash
# Backend
cd server
npm start

# Frontend (dans un autre terminal)
cd client  # ou le dossier approprié
npm run dev
```

### 3. Se connecter en tant qu'admin RH

- Ouvrez l'application dans votre navigateur
- Connectez-vous avec un compte ayant les permissions `hr.attendance.view_page` et `hr.attendance.edit`

---

## Scénario 1 : Correction d'un pointage existant

### Objectif
Vérifier qu'un admin peut corriger les heures d'un pointage existant avec un audit trail complet.

### Étapes

1. **Naviguer vers Temps & Présence**
   - Dans le menu admin, cliquez sur "Temps & Présence"
   - ✅ Vérifiez que le bouton **"Corriger / Déclarer"** (violet) est visible en haut à droite

2. **Ouvrir le modal de correction**
   - Cliquez sur le bouton "Corriger / Déclarer"
   - ✅ Vérifiez qu'un modal s'ouvre avec le titre "Corriger / Déclarer un Pointage"

3. **Rechercher un employé avec pointage existant**
   - Sélectionnez un employé dans le dropdown (ex: "Jean Dupont")
   - Sélectionnez une date qui a un pointage (ex: aujourd'hui ou hier)
   - Cliquez sur "Rechercher"
   - ✅ Vérifiez que l'écran "État actuel" s'affiche
   - ✅ Vérifiez que les informations du pointage sont affichées :
     - Entrée: HH:MM
     - Sortie: HH:MM
     - Temps travaillé
     - Statut
     - Source (ex: biometric, manual)

4. **Corriger le pointage**
   - Cliquez sur le bouton "Corriger ce pointage"
   - Modifiez l'heure d'entrée (ex: de 08:30 à 08:00)
   - Dans "Raison de correction", tapez : "Badge défaillant, présence confirmée par manager direct"
   - Ajoutez une note optionnelle : "Correction suite à réclamation employé"
   - ✅ Vérifiez que le "Temps calculé" se met à jour automatiquement
   - Cliquez sur "Enregistrer"
   - ✅ Vérifiez qu'un message de succès s'affiche : "✅ Pointage mis à jour avec succès"
   - ✅ Vérifiez que le modal se ferme

5. **Vérifier en base de données**

```sql
SELECT
  e.employee_number,
  a.attendance_date,
  a.original_check_in,
  a.check_in_time,
  a.original_check_out,
  a.check_out_time,
  a.corrected_by,
  a.correction_reason,
  a.corrected_at,
  a.is_manual_entry,
  a.source
FROM hr_attendance_records a
JOIN hr_employees e ON a.employee_id = e.id
WHERE e.employee_number = 'E001'  -- Remplacez par le numéro d'employé testé
  AND a.attendance_date = '2026-01-20'  -- Date testée
ORDER BY a.created_at DESC
LIMIT 1;
```

**Résultats attendus :**
- ✅ `original_check_in` = ancienne valeur (ex: '08:30:00')
- ✅ `check_in_time` = nouvelle valeur (ex: '08:00:00')
- ✅ `corrected_by` = UUID de votre utilisateur admin
- ✅ `correction_reason` = "Badge défaillant..."
- ✅ `corrected_at` = timestamp récent
- ✅ `is_manual_entry` = true
- ✅ `source` = 'manual'

---

## Scénario 2 : Déclaration d'une journée complète (congé)

### Objectif
Vérifier qu'un admin peut déclarer une absence pour une date sans pointage.

### Étapes

1. **Ouvrir le modal**
   - Cliquez sur "Corriger / Déclarer"

2. **Rechercher une date sans pointage**
   - Sélectionnez un employé (ex: "Marie Martin")
   - Sélectionnez une date future ou passée **sans pointage** (ex: dans 3 jours)
   - Cliquez sur "Rechercher"
   - ✅ Vérifiez que le message s'affiche : "Aucun pointage trouvé"
   - ✅ Vérifiez que deux boutons sont disponibles :
     - "Déclarer présence"
     - "Déclarer absence"

3. **Déclarer un congé**
   - Cliquez sur "Déclarer absence"
   - Dans "Type d'absence", sélectionnez **"Congé (leave)"**
   - Dans "Raison / Notes", tapez : "Congé approuvé - email du 10/01/2026"
   - Cliquez sur "Enregistrer"
   - ✅ Vérifiez le message : "✅ Pointage mis à jour avec succès"

4. **Vérifier en base de données**

```sql
SELECT
  e.employee_number,
  a.attendance_date,
  a.status,
  a.check_in_time,
  a.check_out_time,
  a.worked_minutes,
  a.is_manual_entry,
  a.source,
  a.notes
FROM hr_attendance_records a
JOIN hr_employees e ON a.employee_id = e.id
WHERE e.first_name = 'Marie' AND e.last_name = 'Martin'
  AND a.attendance_date = '2026-01-23'  -- Date testée
LIMIT 1;
```

**Résultats attendus :**
- ✅ `status` = 'leave'
- ✅ `check_in_time` = NULL
- ✅ `check_out_time` = NULL
- ✅ `worked_minutes` = NULL
- ✅ `is_manual_entry` = true
- ✅ `source` = 'manual'
- ✅ `notes` = "Congé approuvé..."

---

## Scénario 3 : Déclaration d'une présence manuelle

### Objectif
Vérifier qu'un admin peut déclarer une présence avec des horaires pour un jour sans pointage.

### Étapes

1. **Rechercher une date sans pointage**
   - Ouvrez le modal "Corriger / Déclarer"
   - Sélectionnez un employé
   - Sélectionnez une date sans pointage
   - Recherchez

2. **Déclarer présence manuelle**
   - Cliquez sur "Déclarer présence"
   - Heure d'entrée : 09:00
   - Heure de sortie : 17:00
   - ✅ Vérifiez que "Temps calculé" affiche : 8h00
   - Dans "Raison / Notes", tapez : "Employé en télétravail sans VPN, présence confirmée"
   - Cliquez sur "Enregistrer"
   - ✅ Vérifiez le succès

3. **Vérifier en base de données**

```sql
SELECT
  a.check_in_time,
  a.check_out_time,
  a.worked_minutes,
  a.status,
  a.is_manual_entry,
  a.notes
FROM hr_attendance_records a
WHERE a.attendance_date = '...' -- votre date
ORDER BY a.created_at DESC
LIMIT 1;
```

**Résultats attendus :**
- ✅ `check_in_time` = '09:00:00'
- ✅ `check_out_time` = '17:00:00'
- ✅ `worked_minutes` = 480 (8 heures)
- ✅ `status` = 'present'
- ✅ `is_manual_entry` = true

---

## Scénario 4 : Annulation automatique de demande de correction en attente

### Objectif
Vérifier que quand l'admin corrige un pointage, les demandes de correction en attente sont annulées automatiquement.

### Préparation

Créez une demande de correction en tant qu'employé :

```sql
-- Insérer une fausse demande de correction (ou créez-la via l'interface employé)
INSERT INTO hr_attendance_correction_requests (
  employee_id,
  request_date,
  requested_check_in,
  requested_check_out,
  reason,
  status,
  created_at
)
VALUES (
  (SELECT id FROM hr_employees WHERE employee_number = 'E001'),
  '2026-01-18',
  '08:00',
  '17:45',
  'Demande de correction pour badge défaillant',
  'pending',
  NOW()
);
```

### Étapes

1. **Rechercher le même employé et date**
   - Ouvrez "Corriger / Déclarer"
   - Sélectionnez l'employé qui a la demande en attente
   - Sélectionnez la date 18/01/2026
   - Recherchez

2. **Vérifier l'avertissement**
   - ✅ Vérifiez qu'un encadré jaune s'affiche :
     - **"Demande de correction en attente"**
     - Détails de la demande (heures demandées)
     - Note : "(Cette demande sera annulée automatiquement si vous corrigez le pointage)"

3. **Corriger le pointage**
   - Cliquez sur "Corriger ce pointage"
   - Modifiez les heures
   - Remplissez la raison de correction
   - Enregistrez

4. **Vérifier l'annulation en DB**

```sql
SELECT
  status,
  admin_cancelled_at,
  admin_cancelled_by,
  admin_cancellation_reason
FROM hr_attendance_correction_requests
WHERE employee_id = (SELECT id FROM hr_employees WHERE employee_number = 'E001')
  AND request_date = '2026-01-18';
```

**Résultats attendus :**
- ✅ `status` = 'cancelled'
- ✅ `admin_cancelled_at` = timestamp récent
- ✅ `admin_cancelled_by` = UUID de votre utilisateur admin
- ✅ `admin_cancellation_reason` = 'Remplacée par correction admin directe'

---

## Scénario 5 : Validation des erreurs

### Test 5.1 : Heure de sortie avant heure d'entrée

1. Ouvrez le modal, recherchez un employé
2. Cliquez "Corriger ce pointage"
3. Entrée : 17:00
4. Sortie : 08:00
5. Remplissez la raison de correction
6. Cliquez "Enregistrer"
7. ✅ **Attendu** : Alert "⚠️ L'heure de sortie doit être après l'heure d'entrée"

### Test 5.2 : Raison de correction trop courte

1. Correction d'un pointage
2. Raison : "Test" (moins de 10 caractères)
3. Cliquez "Enregistrer"
4. ✅ **Attendu** : Alert "⚠️ Une raison de correction (min 10 caractères) est requise"

### Test 5.3 : Notes trop courtes pour déclaration

1. Déclarez une absence
2. Type : Congé
3. Notes : "OK" (moins de 5 caractères)
4. Cliquez "Enregistrer"
5. ✅ **Attendu** : Alert "⚠️ Des notes (min 5 caractères) sont requises pour une déclaration"

### Test 5.4 : Tentative de déclarer sur une date avec pointage existant

1. Recherchez une date avec pointage
2. Essayez manuellement via l'API :

```bash
curl -X PUT http://localhost:3000/api/hr/attendance/admin/edit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "employee_id": "...",
    "date": "2026-01-20",
    "action": "declare",
    "absence_status": "leave",
    "notes": "Test de validation"
  }'
```

5. ✅ **Attendu** : Erreur 409 "Des pointages existent déjà pour cette date. Utilisez action='edit' pour les modifier."

---

## Scénario 6 : Avertissements jours fériés et récupération

### Test 6.1 : Jour férié

**Préparation** : Assurez-vous d'avoir un jour férié dans `hr_public_holidays` (ex: 01/01/2026)

1. Recherchez un employé + date du jour férié
2. ✅ Vérifiez qu'un encadré orange s'affiche : **"Jour férié"** avec le nom
3. Vous pouvez quand même corriger ou déclarer si nécessaire

### Test 6.2 : Jour de récupération

**Préparation** : Assurez-vous d'avoir une récupération dans `hr_recovery_declarations`

1. Recherchez un employé qui a un jour de récupération
2. ✅ Vérifiez qu'un encadré bleu s'affiche : **"Jour de récupération"**

---

## Tests de Performance

### Test P1 : Recherche rapide

1. Sélectionnez un employé et une date
2. Cliquez "Rechercher"
3. ✅ **Attendu** : Réponse en < 2 secondes
4. Vérifiez l'onglet Network dans DevTools pour voir l'appel `/api/hr/attendance/by-date`

### Test P2 : Sauvegarde rapide

1. Corrigez un pointage
2. Cliquez "Enregistrer"
3. ✅ **Attendu** : Sauvegarde en < 1 seconde
4. Vérifiez l'appel `/api/hr/attendance/admin/edit` dans Network

---

## Checklist de Validation Finale

Avant de déployer en production, vérifiez :

### Backend
- [x] GET `/api/hr/attendance/by-date` retourne toutes les infos
- [x] PUT `/api/hr/attendance/admin/edit` action='edit' fonctionne
- [x] PUT `/api/hr/attendance/admin/edit` action='declare' fonctionne
- [ ] Validation : format HH:MM vérifié
- [ ] Validation : check_out > check_in vérifié
- [ ] Audit trail : original_* stockés correctement
- [ ] Demandes de correction annulées automatiquement
- [ ] Anomalies résolues lors de la correction
- [ ] Permissions vérifiées (403 si pas autorisé)

### Frontend
- [x] Modal s'ouvre/ferme correctement
- [ ] Recherche affiche résultats
- [ ] Recherche affiche "aucun pointage"
- [ ] Warnings affichés (demande en attente, jour férié, récupération)
- [ ] Formulaire correction pré-rempli avec valeurs existantes
- [ ] Calcul automatique du temps travaillé
- [ ] Validation côté client fonctionne
- [ ] Messages d'erreur clairs
- [ ] Loading states pendant les appels API

### Base de données
- [ ] Migration 127 exécutée
- [ ] Colonnes admin_cancelled_* existent
- [ ] Index créé pour performance

### Tests E2E
- [ ] Scénario 1 : Correction pointage existant ✅
- [ ] Scénario 2 : Déclaration congé ✅
- [ ] Scénario 3 : Déclaration présence manuelle ✅
- [ ] Scénario 4 : Annulation demande en attente ✅
- [ ] Scénario 5 : Validations erreurs ✅
- [ ] Scénario 6 : Avertissements jours spéciaux ✅

---

## Dépannage

### Erreur : "employee_id et date sont requis"
- Vérifiez que vous avez bien sélectionné un employé ET une date

### Erreur : "Employé non trouvé"
- Vérifiez que l'employé existe dans `hr_employees` et est actif

### Erreur : "Permission denied"
- Vérifiez que votre utilisateur a la permission `hr.attendance.edit`
- Vérifiez dans `user_permissions` ou `role_permissions`

### Modal ne s'ouvre pas
- Vérifiez la console du navigateur pour les erreurs
- Vérifiez que le bouton est bien cliquable (`hr.canEditAttendance`)

### Demande de correction non annulée
- Vérifiez que la migration a bien été exécutée
- Vérifiez les logs du serveur pour des erreurs SQL

---

## Logs utiles

### Backend logs

```bash
# Voir les logs en temps réel
tail -f server/logs/app.log  # si configuré

# Ou dans la console où le serveur tourne
```

### Vérifier les appels API dans le navigateur

1. Ouvrez DevTools (F12)
2. Onglet Network
3. Filtrez par "XHR" ou "Fetch"
4. Cherchez les appels :
   - `/api/hr/attendance/by-date`
   - `/api/hr/attendance/admin/edit`
5. Vérifiez :
   - Status code (200, 400, 500, etc.)
   - Request payload
   - Response data

---

**Fin du guide de tests**

Pour toute question ou bug découvert, contactez l'équipe de développement avec :
- Scénario reproduisant le bug
- Captures d'écran
- Logs du serveur
- Données de test utilisées
