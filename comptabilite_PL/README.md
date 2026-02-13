# Système de Gestion Comptable pour Professeurs

Application web full-stack de gestion comptable et administrative pour un réseau de centres de formation.

## Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Composants personnalisés
- **Base de données**: SQL.js (SQLite en local, stockage dans localStorage)
- **Routing**: React Router v6
- **Formules**: HyperFormula (moteur Excel-like)
- **Canvas**: Fabric.js v6

## Installation

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## Connexion par défaut

- **Email**: admin@system.com
- **Mot de passe**: admin123

## Fonctionnalités

### Module Administrateur
- Gestion des segments de formation
- Gestion des villes et affectation aux segments
- Gestion des professeurs
- Création de templates de fiches de calcul
- Visualisation globale des fiches comptables

### Module Professeur
- Création de fiches comptables
- Remplissage des fiches de calcul publiées
- Visualisation de ses propres fiches
- Soumission de preuves de paiement

## Structure du Projet

```
src/
├── components/
│   ├── admin/              # Composants d'administration
│   ├── professor/          # Composants professeur
│   ├── calculation/        # Éditeurs de fiches de calcul
│   │   └── spreadsheet/    # Éditeur grille Excel-like
│   └── ui/                 # Composants UI réutilisables
├── pages/                  # Pages principales
├── contexts/               # Contextes React (Auth)
├── hooks/                  # Hooks personnalisés
└── lib/                    # Utilitaires
    ├── database/           # Gestion SQLite
    └── utils/              # Utilitaires (formules, cellules)
```

## Base de Données

La base de données est stockée localement dans le `localStorage` du navigateur sous la clé `accounting_db`.

### Tables principales:
- **profiles**: Utilisateurs (admin/professeur)
- **segments**: Segments de formation
- **cities**: Villes
- **professor_segments**: Association professeur-segment
- **professor_cities**: Association professeur-ville
- **calculation_sheets**: Templates de fiches de calcul
- **calculation_sheet_submissions**: Soumissions des professeurs
- **accounting_sheets**: Fiches comptables complètes
- **students**: Étudiants par formation
- **charges**: Charges par fiche

## Développement

```bash
# Build pour production
npm run build

# Preview du build
npm run preview
```

## Notes

- La base de données est réinitialisée si vous effacez le localStorage
- Un compte admin est créé automatiquement au premier démarrage
- Les données sont persistées dans le navigateur

## Auteur

Système développé avec React, TypeScript et SQL.js
