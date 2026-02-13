# TODO: Corrections Finales de Migration

## ✅ Complété

- ✅ Backend: Ajout champ `code` à la table cities
- ✅ API Client générique créé
- ✅ Services API créés (auth, cities, segments, profiles, calculationSheets, declarations)
- ✅ AuthContext migré
- ✅ 8 hooks migrés (useCities, useSegments, useProfessors, useUsers, useCalculationSheets, useAdminDeclarations, useProfessorDeclarations, useGerantDeclarations)
- ✅ Dépendance Supabase supprimée
- ✅ Configuration Railway créée
- ✅ Documentation Railway créée

## 🔧 Corrections Restantes

### 1. Erreurs de Types API (src/lib/api/client.ts)

**Problème**: Les propriétés publiques dans le constructeur ne sont pas supportées avec `erasableSyntaxOnly`

**Solution**:
```typescript
export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
```

### 2. Ajuster les Types Create* (src/lib/api/*.ts)

**Problème**: `CreateCityInput` et `CreateSegmentInput` incluent `id`, mais les composants ne le fournissent pas

**Solution**: Rendre `id` optionnel dans les types ou l'enlever complètement:

**src/lib/api/cities.ts**:
```typescript
export interface CreateCityInput {
  name: string;
  code: string;
  segment_id: string;
  // id sera généré dans le hook
}
```

**src/lib/api/segments.ts**:
```typescript
export interface CreateSegmentInput {
  name: string;
  color: string;
  // id sera généré dans le hook
}
```

### 3. Ajouter Hooks Manquants

#### A. useProfessorDeclarations.ts

Ajouter les exports manquants:
```typescript
export { usePublishedCalculationSheets as useAvailableCalculationSheets } from './useGerantDeclarations';
export { useProfessorSegments } from './useProfessors';
export { useProfessorCities } from './useProfessors';
export type { GerantCity as ProfessorCity } from './useGerantDeclarations';
```

#### B. useUsers.ts

Ajouter:
```typescript
export { useSegments as useAllSegments } from './useSegments';
export { useCities as useAllCities } from './useCities';
export { useProfessorSegments as useUserSegments } from './useProfessors';
export { useProfessorCities as useUserCities } from './useProfessors';
```

#### C. useAdminDeclarations.ts

Ajouter:
```typescript
export { useRequestModifications as useRequestModification };
export { useDeleteDeclaration as useDeleteAdminDeclaration } from './useProfessorDeclarations';
export function useDeclarationStats() {
  // Implémenter calcul des stats
}
```

#### D. useCalculationSheets.ts

Ajouter:
```typescript
export { useToggleCalculationSheetStatus as useTogglePublishCalculationSheet };
export function useDuplicateCalculationSheet() {
  // Implémenter duplication
}
```

#### E. useGerantDeclarations.ts

Ajouter:
```typescript
export function useProfessorsBySegmentCity(segmentId: string, cityId: string) {
  // Filtrer professeurs par segment ET ville
}

export function usePublishedSheetForSegment(segmentId: string) {
  // Filtrer sheets publiées par segment
}

export { useCreateGerantDeclaration as useCreateDeclarationForProfessor };
```

### 4. Ajouter Propriétés Manquantes aux Types Declaration

**src/lib/api/declarations.ts**:
```typescript
export interface Declaration {
  // ... existant
  professor_name?: string;  // AJOUTER
}
```

Le backend doit aussi retourner ce champ dans les joins.

### 5. Corrections des Composants

#### src/pages/admin/CalculationSheetEditor.tsx

Ligne 351, remplacer:
```typescript
updateSheet.mutate({
  id: sheetId!,
  template_data: JSON.stringify(canvasData),
  segment_ids: selectedSegments,
  city_ids: selectedCities,
});
```

#### src/pages/admin/CalculationSheetsList.tsx

Ligne 342:
```typescript
createSheet.mutate({
  title: newSheetName,
  segment_ids: [],
  city_ids: [],
  template_data: '{}',  // AJOUTER
  status: 'draft',      // AJOUTER
  sheet_date: new Date().toISOString(),  // AJOUTER
});
```

Ligne 526: Même correction que ligne 351

### 6. Supprimer Imports Inutilisés

**src/hooks/useProfessors.ts** et **src/hooks/useUsers.ts**:
Supprimer `import type { Profile }` car non utilisé

### 7. Corriger les Hooks useCities et useSegments

**src/hooks/useCities.ts** ligne 43 et **src/hooks/useSegments.ts** ligne 34:

Problème: `id` spécifié deux fois dans le spread.

Solution:
```typescript
// Au lieu de:
return citiesApi.create({
  id,
  ...data,  // data contient déjà name, code, segment_id
});

// Faire:
return citiesApi.create({
  id,
  name: data.name,
  code: data.code,
  segment_id: data.segment_id,
});
```

### 8. Build Command

Après corrections, tester:
```bash
npm run build
```

## 📋 Ordre de Correction Recommandé

1. ✅ Corriger `ApiError` (src/lib/api/client.ts)
2. ✅ Ajuster types `Create*Input` pour retirer `id`
3. ✅ Corriger les hooks (spread d'id)
4. ✅ Ajouter hooks/exports manquants
5. ✅ Corriger les composants
6. ✅ Test du build
7. ✅ Commit & Push

## 🎯 Commandes de Test

```bash
# Build frontend
npm run build

# Build backend
cd server && npm install

# Test local
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend (dans un autre terminal)
npm run dev
```

## 💡 Notes

- La migration de Supabase vers API REST est complète côté architecture
- Les erreurs restantes sont principalement des ajustements de types et d'exports
- Environ 1-2h de corrections restantes pour build complet
- Le backend est prêt et fonctionnel
- La configuration Railway est prête

## 🚀 Après Corrections

1. Tester localement (backend + frontend)
2. Commit & Push vers GitHub
3. Déployer sur Railway (suivre RAILWAY_DEPLOY.md)
