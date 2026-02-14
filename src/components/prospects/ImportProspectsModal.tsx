// @ts-nocheck
/**
 * Modal d'import en masse de prospects
 * Support CSV/Excel avec validation
 */

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useImportProspects } from '@/hooks/useProspects';
import { useSegments } from '@/hooks/useSegments';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface ImportProspectsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedLine {
  phone: string;
  nom?: string;
  prenom?: string;
  ville?: string;
  valid: boolean;
  error?: string;
}

export function ImportProspectsModal({ open, onClose }: ImportProspectsModalProps) {
  const [segmentId, setSegmentId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: segments, isLoading: segmentsLoading } = useSegments();
  const importProspectsMutation = useImportProspects();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Lire et parser le fichier
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseFile(content);
    };
    reader.readAsText(selectedFile);
  };

  const parseFile = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());

    // Détecter le séparateur (virgule, point-virgule, tab)
    const firstLine = lines[0] || '';
    const separator = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

    // Parser chaque ligne
    const parsed: ParsedLine[] = [];
    let valid = 0;
    let invalid = 0;

    lines.forEach((line, index) => {
      // Ignorer la première ligne si c'est un header
      if (index === 0 && (line.toLowerCase().includes('phone') || line.toLowerCase().includes('nom'))) {
        return;
      }

      const columns = line.split(separator).map(col => col.trim());

      if (columns.length === 0 || !columns[0]) {
        return;
      }

      const phone = columns[0];
      const nom = columns[1] || undefined;
      const prenom = columns[2] || undefined;
      const ville = columns[3] || undefined;

      // Validation basique
      const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
      const isValid = /^[\+0-9]+$/.test(cleanedPhone) && cleanedPhone.length >= 8 && cleanedPhone.length <= 15;

      if (isValid) {
        valid++;
      } else {
        invalid++;
      }

      parsed.push({
        phone,
        nom,
        prenom,
        ville,
        valid: isValid,
        error: isValid ? undefined : 'Numéro invalide',
      });
    });

    setParsedLines(parsed);
    setValidCount(valid);
    setInvalidCount(invalid);
  };

  const handleImport = () => {
    if (!segmentId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un segment',
      });
      return;
    }

    if (validCount === 0) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Aucun numéro valide à importer',
      });
      return;
    }

    // Préparer les lignes valides pour l'import
    const linesToImport = parsedLines
      .filter(line => line.valid)
      .map(line => ({
        phone_international: line.phone,
        nom: line.nom || null,
        prenom: line.prenom || null,
        ville_name: line.ville || null,
      }));

    importProspectsMutation.mutate(
      { segment_id: segmentId, lines: linesToImport },
      {
        onSuccess: (result) => {
          toast({
            title: 'Import réussi',
            description: `${result.created} prospects créés, ${result.reinjected || 0} réinjectés, ${result.duplicates || 0} doublons ignorés`,
          });
          onClose();
          // Reset
          setFile(null);
          setParsedLines([]);
          setValidCount(0);
          setInvalidCount(0);
          setSegmentId('');
        },
        onError: (error: any) => {
          toast({
            variant: 'destructive',
            title: 'Erreur d\'import',
            description: error.message || "Impossible d'importer les prospects",
          });
        },
      }
    );
  };

  const handleReset = () => {
    setFile(null);
    setParsedLines([]);
    setValidCount(0);
    setInvalidCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer des prospects en masse
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Segment */}
          <div className="space-y-2">
            <Label htmlFor="segment">Segment *</Label>
            <Select value={segmentId} onValueChange={setSegmentId} disabled={segmentsLoading}>
              <SelectTrigger id="segment">
                <SelectValue placeholder="Sélectionnez un segment" />
              </SelectTrigger>
              <SelectContent>
                {segments?.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format attendu */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Format du fichier</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>Le fichier doit être au format CSV avec les colonnes suivantes (séparateur: , ou ;):</p>
              <code className="block bg-gray-100 p-2 rounded text-xs">
                phone,nom,prenom,ville
                <br />
                +212612345678,Alami,Mohammed,Casablanca
                <br />
                0612345679,Bennani,Fatima,Rabat
              </code>
              <p className="text-xs text-gray-600">
                Seule la colonne <strong>phone</strong> est obligatoire. Les autres colonnes sont optionnelles.
              </p>
            </AlertDescription>
          </Alert>

          {/* Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Fichier CSV</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="flex-1"
              />
              {file && (
                <Button variant="outline" size="icon" onClick={handleReset}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Résumé du parsing */}
          {parsedLines.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{parsedLines.length}</div>
                  <div className="text-sm text-blue-600">Lignes détectées</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{validCount}</div>
                  <div className="text-sm text-green-600">Numéros valides</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{invalidCount}</div>
                  <div className="text-sm text-red-600">Numéros invalides</div>
                </div>
              </div>

              {/* Progress */}
              {validCount > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Taux de validité</span>
                    <span className="font-medium">{Math.round((validCount / parsedLines.length) * 100)}%</span>
                  </div>
                  <Progress value={(validCount / parsedLines.length) * 100} />
                </div>
              )}

              {/* Preview des erreurs */}
              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Lignes invalides ({invalidCount})</AlertTitle>
                  <AlertDescription className="text-xs max-h-40 overflow-y-auto">
                    {parsedLines
                      .filter(line => !line.valid)
                      .slice(0, 5)
                      .map((line, index) => (
                        <div key={index} className="py-1">
                          <strong>{line.phone}</strong>: {line.error}
                        </div>
                      ))}
                    {invalidCount > 5 && (
                      <div className="text-xs text-gray-600 mt-2">
                        ... et {invalidCount - 5} autres
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview des valides */}
              {validCount > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                    <CheckCircle className="h-4 w-4" />
                    Aperçu des prospects valides (5 premiers)
                  </div>
                  <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                    {parsedLines
                      .filter(line => line.valid)
                      .slice(0, 5)
                      .map((line, index) => (
                        <div key={index} className="flex gap-4 text-xs">
                          <span className="font-mono">{line.phone}</span>
                          {line.nom && <span>{line.nom}</span>}
                          {line.prenom && <span>{line.prenom}</span>}
                          {line.ville && <span className="text-gray-600">({line.ville})</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={importProspectsMutation.isPending || validCount === 0 || !segmentId}
          >
            {importProspectsMutation.isPending
              ? 'Import en cours...'
              : `Importer ${validCount} prospects`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
