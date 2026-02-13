# Plan : Système de Suivi des Documents Générés

## Objectif
Permettre aux administrateurs de voir facilement quels documents ont été générés pour chaque étudiant dans une session, et préparer l'intégration avec QZ Tray pour l'impression automatique.

## 🎯 Besoin Client

1. **Dans le menu Sessions de Formation**, pour chaque étudiant :
   - Voir la liste des documents déjà générés
   - Savoir quel type de document (certificat, attestation, badge, etc.)
   - Télécharger ou réimprimer un document existant
   - Identifier rapidement quels documents manquent

2. **Préparation pour QZ Tray** :
   - Associer chaque document à une imprimante spécifique
   - Définir les options d'impression par type de document
   - Workflow : Génération → Consultation → Impression automatique

## 📋 État Actuel vs État Souhaité

### État Actuel ✅
- Table `certificates` existe et stocke les documents générés
- Colonnes : `student_id`, `formation_id`, `session_id`, `file_path`, `certificate_number`
- API : `GET /api/certificates/student/:studentId` retourne les certificats
- Génération de documents dans SessionDetail.tsx (lignes 54-161)

### Manquants ❌
- **Pas de colonne `document_type`** dans la table `certificates`
- Pas d'interface UI pour voir les documents générés par étudiant
- Pas de lien entre document et configuration d'imprimante
- Pas de système de tracking pour savoir quels documents ont été imprimés

## 🏗️ Architecture Recommandée

### Phase 1 : Migration Base de Données

**Migration 085 : Add document_type and printer tracking to certificates**

```sql
-- 1. Ajouter document_type
ALTER TABLE certificates
ADD COLUMN document_type VARCHAR(50) DEFAULT 'certificat';

-- 2. Ajouter template_name pour référence
ALTER TABLE certificates
ADD COLUMN template_name TEXT;

-- 3. Ajouter print tracking
ALTER TABLE certificates
ADD COLUMN printed_at TIMESTAMP;

ALTER TABLE certificates
ADD COLUMN printer_name TEXT;

ALTER TABLE certificates
ADD COLUMN print_status VARCHAR(50) DEFAULT 'not_printed';
-- Valeurs possibles: 'not_printed', 'printing', 'printed', 'print_failed'

-- 4. Index pour performance
CREATE INDEX idx_certificates_document_type ON certificates(document_type);
CREATE INDEX idx_certificates_print_status ON certificates(print_status);
```

### Phase 2 : Backend API

**Nouvel endpoint : Liste des documents par étudiant dans une session**

```javascript
// GET /api/sessions-formation/:sessionId/students/:studentId/documents
router.get('/:sessionId/students/:studentId/documents',
  authenticateToken,
  requirePermission('training.sessions.view_page'),
  async (req, res) => {
    const { sessionId, studentId } = req.params;

    const documents = await pool.query(`
      SELECT
        c.id,
        c.certificate_number,
        c.document_type,
        c.template_name,
        c.issued_at,
        c.file_path,
        c.archive_folder,
        c.grade,
        c.printed_at,
        c.printer_name,
        c.print_status,
        ct.name as template_display_name,
        ct.preview_image_url
      FROM certificates c
      LEFT JOIN certificate_templates ct ON c.template_id = ct.id
      WHERE c.student_id = $1 AND c.session_id = $2
      ORDER BY c.issued_at DESC
    `, [studentId, sessionId]);

    res.json({
      success: true,
      documents: documents.rows
    });
  }
);
```

**Endpoint d'impression : Marquer un document comme imprimé**

```javascript
// POST /api/certificates/:id/mark-printed
router.post('/:id/mark-printed',
  authenticateToken,
  requirePermission('training.certificates.generate'),
  async (req, res) => {
    const { id } = req.params;
    const { printer_name } = req.body;

    await pool.query(`
      UPDATE certificates
      SET printed_at = NOW(),
          printer_name = $1,
          print_status = 'printed'
      WHERE id = $2
    `, [printer_name, id]);

    res.json({ success: true });
  }
);
```

### Phase 3 : Frontend UI

**Option A : Modal "Documents Générés" (Recommandé)**

Fichier : `src/components/admin/sessions-formation/StudentDocumentsModal.tsx`

```typescript
interface StudentDocumentsModalProps {
  studentId: string;
  sessionId: string;
  studentName: string;
  onClose: () => void;
  onPrint?: (documentId: string, documentType: string) => void;
}

export function StudentDocumentsModal({
  studentId,
  sessionId,
  studentName,
  onClose,
  onPrint
}: StudentDocumentsModalProps) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [studentId, sessionId]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(
        `/api/sessions-formation/${sessionId}/students/${studentId}/documents`
      );
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (doc) => {
    if (onPrint) {
      await onPrint(doc.id, doc.document_type);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Documents de {studentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div>Chargement...</div>
        ) : (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <p className="text-muted-foreground">
                Aucun document généré pour cet étudiant.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut impression</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge>{doc.document_type}</Badge>
                      </TableCell>
                      <TableCell>{doc.certificate_number}</TableCell>
                      <TableCell>
                        {new Date(doc.issued_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        {doc.print_status === 'printed' ? (
                          <span className="text-green-600">✓ Imprimé</span>
                        ) : (
                          <span className="text-gray-400">Non imprimé</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Télécharger */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(doc.file_path)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          {/* Imprimer */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(doc)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Option B : Colonne "Documents" dans la table des étudiants**

Modifier `SessionDetail.tsx` pour ajouter une colonne :

```typescript
// Ajouter dans le TableHeader
<TableHead>Documents</TableHead>

// Ajouter dans le TableBody
<TableCell>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      setSelectedStudentForDocs(student);
      setShowDocumentsModal(true);
    }}
  >
    <FileText className="h-4 w-4 mr-2" />
    {student.documents_count || 0}
  </Button>
</TableCell>
```

### Phase 4 : Intégration QZ Tray

**Configuration des imprimantes par type de document**

Fichier : `src/lib/printer-config.ts`

```typescript
export const PRINTER_CONFIG = {
  certificat: {
    printerName: 'HP LaserJet Pro',
    options: {
      orientation: 'landscape',
      colorType: 'color',
      copies: 1,
      duplex: false,
      size: { width: 11, height: 8.5 } // A4 landscape
    }
  },
  attestation: {
    printerName: 'HP LaserJet Pro',
    options: {
      orientation: 'portrait',
      colorType: 'color',
      copies: 1,
      duplex: false,
      size: { width: 8.5, height: 11 } // A4 portrait
    }
  },
  badge: {
    printerName: 'Zebra Card Printer',
    options: {
      orientation: 'portrait',
      colorType: 'color',
      copies: 1,
      duplex: false,
      size: { width: 3.375, height: 2.125 } // Standard badge size
    }
  }
};
```

**Service d'impression avec QZ Tray**

Fichier : `src/lib/services/qzTrayService.ts`

```typescript
import qz from 'qz-tray';
import { PRINTER_CONFIG } from '../printer-config';

export class QZTrayService {
  private static instance: QZTrayService;

  static getInstance() {
    if (!QZTrayService.instance) {
      QZTrayService.instance = new QZTrayService();
    }
    return QZTrayService.instance;
  }

  async connect() {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
  }

  async printDocument(documentId: string, documentType: string, pdfUrl: string) {
    await this.connect();

    // Récupérer la config pour ce type de document
    const config = PRINTER_CONFIG[documentType] || PRINTER_CONFIG.certificat;

    // Créer la config d'impression
    const printerConfig = qz.configs.create(config.printerName, {
      orientation: config.options.orientation,
      colorType: config.options.colorType,
      copies: config.options.copies,
      duplex: config.options.duplex,
      size: config.options.size
    });

    // Télécharger le PDF
    const pdfData = await fetch(pdfUrl).then(r => r.blob());

    // Imprimer
    await qz.print(printerConfig, [{
      type: 'pdf',
      format: 'base64',
      data: await this.blobToBase64(pdfData)
    }]);

    // Marquer comme imprimé
    await this.markAsPrinted(documentId, config.printerName);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async markAsPrinted(documentId: string, printerName: string) {
    await fetch(`/api/certificates/${documentId}/mark-printed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer_name: printerName })
    });
  }
}
```

**Utilisation dans le composant**

```typescript
const handlePrintDocument = async (documentId: string, documentType: string, filePath: string) => {
  try {
    const qzService = QZTrayService.getInstance();
    await qzService.printDocument(documentId, documentType, filePath);

    toast.success('Document envoyé à l\'imprimante');

    // Recharger la liste pour mettre à jour le statut
    await loadDocuments();
  } catch (error) {
    console.error('Print error:', error);
    toast.error('Erreur lors de l\'impression');
  }
};
```

## 📦 Résumé des Fichiers à Créer/Modifier

### Créer :
1. `server/src/routes/migration-085-document-tracking.js` - Migration
2. `src/components/admin/sessions-formation/StudentDocumentsModal.tsx` - Modal documents
3. `src/lib/printer-config.ts` - Configuration imprimantes
4. `src/lib/services/qzTrayService.ts` - Service d'impression
5. `DOCUMENT_TRACKING_PLAN.md` - Ce document

### Modifier :
1. `server/src/routes/sessions-formation.js` - Ajouter endpoint documents
2. `server/src/routes/certificates.js` - Ajouter endpoint mark-printed
3. `src/pages/admin/SessionDetail.tsx` - Ajouter bouton "Documents"

## 🎯 Workflow Final

```
1. Admin ouvre SessionDetail
2. Clique sur "Documents" pour un étudiant
3. Modal affiche tous les documents générés
4. Admin peut :
   - Voir le statut (imprimé/non imprimé)
   - Télécharger le PDF
   - Imprimer via QZ Tray
5. QZ Tray applique automatiquement la bonne config
6. Document marqué comme imprimé dans la base
```

## ⏱️ Estimation

- **Migration 085** : 30 min
- **Backend API** : 1h
- **Frontend Modal** : 2h
- **QZ Tray Integration** : 2h
- **Tests** : 1h

**Total : ~6-7 heures**

## 🚀 Prochaines Étapes

Voulez-vous que je :
1. ✅ Commence par la Migration 085 ?
2. ✅ Crée le composant StudentDocumentsModal ?
3. ✅ Configure QZ Tray ?

Dites-moi par quelle partie commencer ! 🎉
