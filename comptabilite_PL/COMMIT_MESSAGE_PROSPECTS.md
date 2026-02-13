# Message de commit - Système de gestion des prospects

```
feat: Add complete prospect management system with international phone normalization

Implement comprehensive prospect management system with the following features:

BACKEND (6 new files):
- Migration 060: Database schema with 4 tables, 2 PostgreSQL functions, 1 trigger
  * Tables: country_phone_config (150+ countries), prospects, prospect_call_history, prospect_notifications
  * Function: normalize_phone_international() - Validates and formats phone numbers for 150+ countries
  * Function: apply_cleaning_decision() - Auto-calculates cleaning decisions (7-day RDV, 3-day injection rules)
  * Trigger: update_prospect_decision() - Auto-updates decision_nettoyage on prospect changes
  * Permissions: 11 new RBAC permissions for prospect management

- API Routes (server/src/routes/prospects.js):
  * 15+ endpoints with authentication and SBAC filtering
  * CRUD operations with auto-assignment algorithm
  * Call management with timer tracking
  * CSV import with validation and duplicate detection
  * Batch cleaning with dry-run mode

- Utilities (server/src/utils/):
  * phone-validator.js - International phone normalization wrapper
  * prospect-assignment.js - Intelligent workload-based auto-assignment
  * prospect-reinject.js - Duplicate detection and prospect reinjection logic
  * prospect-cleaner.js - Batch cleaning engine with stats

FRONTEND (10 new files):
- API Client & Hooks:
  * src/lib/api/prospects.ts - TypeScript API client with 13 interfaces
  * src/hooks/useProspects.ts - 12 React Query hooks (queries + mutations)

- Main Pages:
  * src/pages/admin/commercialisation/Prospects.tsx - Main management page
    - Stats cards (Total, Non contactés, Avec RDV, Sans RDV, Inscrits, À supprimer)
    - Filters (Segment, Ville, Statut, Décision, Search)
    - Paginated table with inline actions

  * src/pages/admin/ProspectsCleaningDashboard.tsx - Cleaning dashboard
    - Stats by decision (laisser, supprimer, a_revoir_manuelle)
    - Batch recalculation and deletion
    - List of prospects marked for deletion with reinject option

- Modals (src/components/prospects/):
  * QuickAddProspectModal.tsx - Quick add with real-time phone validation
  * ImportProspectsModal.tsx - CSV import with parsing and preview (valid/invalid stats)
  * CallProspectModal.tsx - Call modal with auto-starting timer (MM:SS format)
  * ReassignProspectModal.tsx - Manual reassignment (assistant + city)

MODIFIED FILES (4 files):
- server/src/index.js: Added migration-060 and prospects routes
- src/hooks/usePermission.ts: Added 12 prospect permissions + PermissionCode types
- src/components/layout/Sidebar.tsx: Added "Nettoyage Prospects" menu item
- src/App.tsx: Added /admin/commercialisation/prospects-cleaning route

KEY FEATURES:
✅ International phone normalization (150+ countries)
✅ Intelligent auto-assignment based on workload (MIN prospects per assistant → MIN prospects per city)
✅ Multi-scope support (RBAC + SBAC filtering by segments and cities)
✅ Prospect reinjection system (reuse instead of duplicates)
✅ Auto-cleaning engine (7-day RDV, 3-day injection rules)
✅ Call timer with duration tracking
✅ CSV import with validation and error handling
✅ "Sans Ville" handling with auto-assignment

CLEANING RULES:
- RDV ≥ today → keep
- RDV < today - 7 days → delete
- RDV between -7d and today + negative status → delete
- No RDV + negative status → delete
- No RDV + injection < 3 days → delete
- Recent injection (≥ 3 days) → keep

AUTO-ASSIGNMENT ALGORITHM:
1. Get all assistants with assigned cities
2. Count non-contacted prospects per assistant
3. Find assistant with MIN workload
4. Among that assistant's cities, find city with MIN total prospects
5. Assign prospect to (assistant, city)

DOCUMENTATION:
- PROSPECTS_IMPLEMENTATION_GUIDE.md - Complete deployment and testing guide
- PROSPECTS_FILES_SUMMARY.md - List of all created/modified files

STATISTICS:
- 20 files touched (16 created, 4 modified)
- ~3500 lines of code
- 15+ API endpoints
- 12 React Query hooks
- 4 interactive modals
- 150+ countries supported

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
