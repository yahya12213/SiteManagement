# Réinitialiser la base de données

## Méthode 1 : Via la console du navigateur

1. Ouvrez la console du navigateur (F12)
2. Allez dans l'onglet "Console"
3. Tapez cette commande et appuyez sur Entrée :

```javascript
localStorage.removeItem('accounting_db');
location.reload();
```

## Méthode 2 : Via les outils de développement

1. Ouvrez les outils de développement (F12)
2. Allez dans l'onglet "Application" (ou "Stockage")
3. Dans le menu de gauche, cliquez sur "Local Storage"
4. Cliquez sur votre site (localhost:5173)
5. Trouvez la clé `accounting_db`
6. Cliquez droit dessus et sélectionnez "Supprimer"
7. Rechargez la page (F5)

La base de données sera automatiquement recréée avec la nouvelle structure (username au lieu de email).
