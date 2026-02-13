# Guide de Démarrage - Système de Gestion Comptable

## 🚀 Démarrage Rapide

### 1. Installer les dépendances

```bash
cd "C:\Users\pc\Desktop\systeme de calcul"
npm install
```

### 2. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur **http://localhost:5173** (ou 5174 si le port est occupé)

### 3. Se connecter

Utilisez les identifiants par défaut :
- **Email**: `admin@system.com`
- **Mot de passe**: `admin123`

## 📋 Fonctionnalités Implémentées

### ✅ Infrastructure de Base
- [x] Configuration React 18 + TypeScript + Vite
- [x] Base de données SQLite locale (SQL.js)
- [x] Persistance des données dans localStorage
- [x] Système d'authentification
- [x] Routing avec React Router
- [x] Interface Tailwind CSS

### ✅ Module Administration
- [x] Page de connexion sécurisée
- [x] Dashboard administrateur
- [x] Gestion des segments de formation (CRUD complet)
  - Création avec nom, couleur, logo
  - Modification et suppression
  - Affichage en cartes colorées

### ✅ Utilitaires Avancés
- [x] **FormulaEngine** : Moteur de calcul Excel-like avec HyperFormula
  - Support des formules (SUM, AVERAGE, IF, etc.)
  - Références de cellules (A1, B2, etc.)
  - Calcul automatique

- [x] **CellUtils** : Fonctions de manipulation de cellules
  - Conversion colonne ↔ lettre (A-Z, AA-ZZ)
  - Parsing de références
  - Vérification de plages

- [x] **SpreadsheetEditor** : Éditeur de grille type Excel
  - Interface de tableau dynamique
  - Support des types de cellules (label, number, text, formula)
  - Mode lecture/écriture configurable

## 🗄️ Base de Données

Toutes les tables sont créées automatiquement :

| Table | Description |
|-------|-------------|
| **profiles** | Utilisateurs (admin/professeur) |
| **segments** | Segments de formation |
| **cities** | Villes |
| **professor_segments** | Association professeur-segment |
| **professor_cities** | Association professeur-ville |
| **calculation_sheets** | Templates de fiches de calcul |
| **calculation_sheet_submissions** | Soumissions professeur |
| **accounting_sheets** | Fiches comptables complètes |
| **students** | Étudiants par formation |
| **charges** | Charges par fiche |

## 📂 Structure des Fichiers Créés

```
C:\Users\pc\Desktop\systeme de calcul\
│
├── src/
│   ├── App.tsx                          # Application principale avec routing
│   ├── main.tsx                         # Point d'entrée
│   ├── index.css                        # Styles Tailwind CSS
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx              # Bouton réutilisable
│   │   │   ├── input.tsx               # Input réutilisable
│   │   │   └── card.tsx                # Cartes réutilisables
│   │   │
│   │   └── calculation/
│   │       └── spreadsheet/
│   │           └── SpreadsheetEditor.tsx  # Éditeur de grille Excel
│   │
│   ├── pages/
│   │   ├── Login.tsx                   # Page de connexion
│   │   ├── Dashboard.tsx               # Tableau de bord
│   │   └── admin/
│   │       └── Segments.tsx            # Gestion des segments
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx             # Contexte d'authentification
│   │
│   └── lib/
│       ├── database/
│       │   ├── db.ts                   # Gestion SQLite
│       │   └── schema.ts               # Schéma de la BDD
│       │
│       └── utils/
│           ├── cellUtils.ts            # Utilitaires cellules
│           ├── formulaEngine.ts        # Moteur de formules
│           └── canvasSerializer.ts     # Sérialisation canvas
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── README.md
└── GUIDE_DEMARRAGE.md (ce fichier)
```

## 🎯 Prochaines Étapes (À Développer)

Pour compléter le système, vous pouvez ajouter :

1. **Gestion des Villes** (page `/admin/cities`)
   - Créer, modifier, supprimer des villes
   - Associer aux segments

2. **Gestion des Professeurs** (page `/admin/professors`)
   - Créer des comptes professeurs
   - Assigner segments et villes

3. **Module Professeur** (pages `/professor/*`)
   - Création de fiches comptables
   - Remplissage de fiches de calcul
   - Visualisation personnelle

4. **Éditeur de Fiches de Calcul** (page `/admin/calculation-sheets`)
   - Créer des templates
   - Publier pour les professeurs
   - Mode preview avec formules actives

5. **Système de Canvas** avec Fabric.js
   - Éditeur visuel
   - Blocs déplaçables

## 🔧 Commandes Utiles

```bash
# Développement
npm run dev

# Build pour production
npm run build

# Aperçu de la production
npm run preview

# Réinitialiser la BDD
# Ouvrir la console du navigateur et taper :
localStorage.removeItem('accounting_db')
# Puis rafraîchir la page
```

## 🐛 Dépannage

### La BDD ne se crée pas
1. Ouvrir la console du navigateur (F12)
2. Vérifier les erreurs dans l'onglet Console
3. Vérifier localStorage → clé `accounting_db`

### Erreur de connexion
- Vérifiez que la BDD est initialisée
- Utilisez les identifiants par défaut
- En cas d'échec, supprimez `current_user` de localStorage

### Port déjà utilisé
Si le port 5173 est occupé, Vite utilisera automatiquement 5174 ou 5175.

## 📖 Technologies Utilisées

- **React 18** : Framework UI
- **TypeScript** : Typage statique
- **Vite** : Build tool ultra-rapide
- **Tailwind CSS** : Framework CSS utilitaire
- **React Router** : Routing
- **SQL.js** : SQLite en JavaScript
- **HyperFormula** : Moteur de formules Excel
- **Fabric.js** : Canvas interactif
- **Lucide React** : Icônes

## ✨ Points Forts du Système

1. **100% Local** : Aucun serveur externe requis
2. **Persistance** : Données stockées dans le navigateur
3. **Performance** : Interface réactive et fluide
4. **Modulaire** : Architecture composants réutilisables
5. **Extensible** : Facile d'ajouter de nouvelles fonctionnalités

## 🎨 Personnalisation

### Changer les couleurs du thème
Modifiez `tailwind.config.js` :

```js
theme: {
  extend: {
    colors: {
      primary: '#3b82f6',  // Bleu par défaut
      secondary: '#10b981', // Vert
      // ...
    }
  }
}
```

### Ajouter une nouvelle page
1. Créer le composant dans `src/pages/`
2. Ajouter la route dans `App.tsx`
3. Ajouter le lien dans `Dashboard.tsx`

## 📞 Support

Pour toute question ou problème :
1. Vérifier la console du navigateur (F12)
2. Consulter les fichiers de logs de Vite
3. Vérifier la structure de la base de données

---

**Bon développement ! 🚀**
