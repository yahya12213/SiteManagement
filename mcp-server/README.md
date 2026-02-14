# Comptabilité PL - MCP Server

Ce serveur MCP permet à **Claude Desktop** d'accéder directement aux données prospects de l'application Comptabilité PL.

## Avantages

- **Gratuit** : Utilise votre abonnement Claude Desktop/Pro, pas d'API payante
- **Direct** : Claude accède aux données en temps réel
- **Intelligent** : Posez des questions en langage naturel

## Installation

### 1. Configurer la base de données

Copiez `.env.example` vers `.env` et ajoutez votre URL de base de données :

```bash
cp .env.example .env
```

Éditez `.env` avec votre DATABASE_URL Railway :

```env
DATABASE_URL=postgresql://postgres:xxxxx@containers-us-west-xxx.railway.app:5432/railway
```

### 2. Compiler le serveur

```bash
npm install
npm run build
```

### 3. Configurer Claude Desktop

Ouvrez le fichier de configuration Claude Desktop :

**Windows** : `%APPDATA%\Claude\claude_desktop_config.json`
**Mac** : `~/Library/Application Support/Claude/claude_desktop_config.json`

Ajoutez cette configuration :

```json
{
  "mcpServers": {
    "comptabilite-pl": {
      "command": "node",
      "args": ["C:/Users/pc/Desktop/systeme de calcul/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:xxxxx@containers-us-west-xxx.railway.app:5432/railway"
      }
    }
  }
}
```

**Important** : Remplacez le chemin et DATABASE_URL par vos valeurs.

### 4. Redémarrer Claude Desktop

Fermez et rouvrez Claude Desktop pour charger le serveur MCP.

## Utilisation

Dans Claude Desktop, vous pouvez maintenant demander :

### Prospects
- "Liste-moi les 10 derniers prospects"
- "Recherche le prospect avec le numéro 0612345678"
- "Montre-moi les prospects non contactés de Casablanca"
- "Détails du prospect 12345678"

### Statistiques
- "Quelles sont les statistiques des prospects ce mois-ci?"
- "Quel est le taux de conversion?"
- "Statistiques par segment"
- "Statistiques par ville"
- "Statistiques par assistante"

### Analyse
- "Analyse la santé commerciale"
- "Donne-moi des recommandations"
- "Quels sont les écarts d'inscription?"

### Référentiels
- "Liste les segments disponibles"
- "Liste les villes"
- "Liste les assistantes commerciales"

## Outils Disponibles

| Outil | Description |
|-------|-------------|
| `list_prospects` | Liste les prospects avec filtres |
| `search_prospects` | Recherche par téléphone/nom |
| `get_prospect` | Détails d'un prospect |
| `get_prospect_calls` | Historique des appels |
| `get_stats` | Statistiques globales |
| `get_stats_by_segment` | Stats par segment |
| `get_stats_by_ville` | Stats par ville |
| `get_stats_by_assistant` | Stats par assistante |
| `get_cleaning_stats` | Stats de nettoyage |
| `get_ecart_details` | Écarts d'inscription |
| `list_segments` | Liste des segments |
| `list_villes` | Liste des villes |
| `list_assistants` | Liste des assistantes |
| `analyze_health` | Score de santé (0-100) |
| `get_recommendations` | Recommandations automatiques |
| `test_connection` | Test de connexion DB |

## Dépannage

### Le serveur n'apparaît pas dans Claude Desktop

1. Vérifiez que le chemin dans `claude_desktop_config.json` est correct
2. Vérifiez que le fichier `dist/index.js` existe
3. Redémarrez complètement Claude Desktop

### Erreur de connexion à la base de données

1. Vérifiez que DATABASE_URL est correcte
2. Vérifiez que Railway est en ligne
3. Testez avec l'outil `test_connection`

### Erreurs de requête

Les erreurs sont affichées dans la réponse de Claude. Vérifiez :
- Les paramètres passés aux outils
- La syntaxe des filtres

## Sécurité

- Le serveur MCP a accès en **lecture seule** aux données
- Ne partagez pas votre `claude_desktop_config.json` (contient DATABASE_URL)
- Les mots de passe et données sensibles ne sont pas exposés
