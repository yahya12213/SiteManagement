import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/contexts/AuthContext';

interface Formation {
  id: string;
  title: string;
  price: number;
  is_pack: boolean;
}

interface Session {
  id: string;
  titre: string;
}

interface EditStudentModalProps {
  student: {
    id: string; // session_etudiants.id
    session_id: string;
    student_id: string;
    student_name?: string;
    student_first_name?: string;
    student_last_name?: string;
    student_cin?: string;
    student_email?: string;
    student_phone?: string;
    student_whatsapp?: string;
    student_birth_date?: string;
    student_birth_place?: string;
    student_address?: string;
    profile_image_url?: string;
    date_inscription?: string;
    // Formation info
    formation_id?: string;
    formation_title?: string;
    formation_original_price?: number | string;
    montant_paye?: number | string;
    discount_percentage?: number | string;
    numero_bon?: string;
    statut_compte?: string;
  };
  sessionId: string;
  corpsFormationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  sessionId,
  corpsFormationId,
  onClose,
  onSuccess,
}) => {
  const { isAdmin } = useAuth();

  // Extraire nom et prénom - utiliser les champs séparés si disponibles
  const nom = student.student_first_name || student.student_name?.split(' ')[0] || '';
  const prenom = student.student_last_name || student.student_name?.split(' ').slice(1).join(' ') || '';

  const [formData, setFormData] = useState({
    // Personal info
    nom: nom,
    prenom: prenom,
    cin: student.student_cin || '',
    email: student.student_email || '',
    phone: student.student_phone || '',
    whatsapp: student.student_whatsapp || '',
    // Administrative info
    date_naissance: student.student_birth_date ? student.student_birth_date.split('T')[0] : '',
    lieu_naissance: student.student_birth_place || '',
    adresse: student.student_address || '',
    date_inscription: student.date_inscription ? student.date_inscription.split('T')[0] : '',
    // Formation info
    session_id: sessionId,
    formation_id: student.formation_id || '',
    numero_bon: student.numero_bon || '',
    discount_percentage: String(student.discount_percentage || '0'),
    avance: String(student.montant_paye || '0'),
    statut_compte: student.statut_compte || 'actif',
  });

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>(
    student.profile_image_url || ''
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown data
  const [formations, setFormations] = useState<Formation[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingFormations, setLoadingFormations] = useState(false);

  // Selected formation details
  const selectedFormation = formations.find((f) => f.id === formData.formation_id);

  // Load formations and sessions
  useEffect(() => {
    if (corpsFormationId) {
      fetchFormations();
      fetchSessions();
    }
  }, [corpsFormationId]);

  const fetchFormations = async () => {
    try {
      setLoadingFormations(true);
      const data = await apiClient.get<Formation[]>(`/cours?corps_id=${corpsFormationId}`);
      setFormations(data);
    } catch (error) {
      console.error('Error fetching formations:', error);
    } finally {
      setLoadingFormations(false);
    }
  };

  const fetchSessions = async () => {
    try {
      // Charger TOUTES les sessions (pour permettre le transfert entre sessions)
      const response = await apiClient.get(`/sessions-formation`);
      setSessions((response as any).sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Personal info
    if (!formData.nom.trim()) newErrors.nom = 'Le nom est obligatoire';
    if (!formData.prenom.trim()) newErrors.prenom = 'Le prénom est obligatoire';
    if (!formData.cin.trim()) newErrors.cin = 'Le CIN est obligatoire';
    if (!formData.phone.trim()) newErrors.phone = 'Le téléphone est obligatoire';

    // Administrative info
    if (!formData.date_naissance) newErrors.date_naissance = 'La date de naissance est obligatoire';
    if (!formData.lieu_naissance.trim()) newErrors.lieu_naissance = 'Le lieu de naissance est obligatoire';
    if (!formData.adresse.trim()) newErrors.adresse = "L'adresse est obligatoire";

    // Validation de la date d'insertion (seulement pour les admins)
    if (isAdmin && !formData.date_inscription) {
      newErrors.date_inscription = "La date d'insertion est obligatoire";
    }

    // Formation info
    if (!formData.formation_id) newErrors.formation = 'La formation est obligatoire';
    if (!formData.numero_bon.trim()) newErrors.numero_bon = 'Le numéro de bon est obligatoire';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Mettre à jour les données personnelles de l'étudiant
      const studentData = new FormData();
      studentData.append('nom', formData.nom.trim());
      studentData.append('prenom', formData.prenom.trim());
      studentData.append('cin', formData.cin.trim());
      studentData.append('email', formData.email.trim());
      studentData.append('phone', formData.phone.trim());
      studentData.append('whatsapp', formData.whatsapp.trim());
      studentData.append('date_naissance', formData.date_naissance);
      studentData.append('lieu_naissance', formData.lieu_naissance.trim());
      studentData.append('adresse', formData.adresse.trim());
      studentData.append('statut_compte', formData.statut_compte);

      if (profileImage) {
        studentData.append('profile_image', profileImage);
      }

      await apiClient.put(`/students/${student.student_id}`, studentData);

      // 2. Mettre à jour les données d'inscription (session_etudiants)
      const formationPrice = selectedFormation?.price || parseFloat(String(student.formation_original_price)) || 0;
      const discountPct = parseFloat(formData.discount_percentage) || 0;
      const discountAmount = (formationPrice * discountPct) / 100;
      const priceAfterDiscount = formationPrice - discountAmount;
      const avance = parseFloat(formData.avance) || 0;

      // Vérifier si l'étudiant est transféré vers une autre session
      const isTransfer = formData.session_id !== sessionId;

      const enrollmentPayload: any = {
        formation_id: formData.formation_id,
        numero_bon: formData.numero_bon.trim(),
        discount_percentage: discountPct,
        montant_paye: avance,
        statut_paiement:
          avance >= priceAfterDiscount
            ? 'paye'
            : avance > 0
            ? 'partiellement_paye'
            : 'impaye',
        // Nouveau: session de destination pour le transfert
        new_session_id: isTransfer ? formData.session_id : undefined,
      };

      // Ajouter date_inscription SEULEMENT si admin
      if (isAdmin && formData.date_inscription) {
        enrollmentPayload.date_inscription = formData.date_inscription;
      }

      await apiClient.put(`/sessions-formation/${sessionId}/etudiants/${student.id}`, enrollmentPayload);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating student:', error);
      setErrors({ submit: error.message || "Erreur lors de la mise à jour de l'étudiant" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculer le montant restant après remise
  const formationPrice = selectedFormation?.price || parseFloat(String(student.formation_original_price)) || 0;
  const discountPct = parseFloat(formData.discount_percentage) || 0;
  const discountAmount = (formationPrice * discountPct) / 100;
  const priceAfterDiscount = formationPrice - discountAmount;
  const montantRestant = formData.avance
    ? Math.max(0, priceAfterDiscount - parseFloat(formData.avance))
    : priceAfterDiscount;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Modifier l'étudiant</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Mettez à jour les informations de l'étudiant
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Section: Informations Personnelles */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value.toUpperCase() })}
                  placeholder="Nom"
                  className={errors.nom ? 'border-red-300' : ''}
                />
                {errors.nom && <p className="text-xs text-red-600 mt-1">{errors.nom}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value.toUpperCase() })}
                  placeholder="Prénom"
                  className={errors.prenom ? 'border-red-300' : ''}
                />
                {errors.prenom && <p className="text-xs text-red-600 mt-1">{errors.prenom}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CIN <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.cin}
                  onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                  placeholder="CIN"
                  className={errors.cin ? 'border-red-300' : ''}
                />
                {errors.cin && <p className="text-xs text-red-600 mt-1">{errors.cin}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Téléphone"
                  className={errors.phone ? 'border-red-300' : ''}
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="WhatsApp"
                />
              </div>
            </div>
          </div>

          {/* Section: Informations Administratives */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Administratives</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de naissance <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formData.date_naissance}
                  onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                  className={errors.date_naissance ? 'border-red-300' : ''}
                />
                {errors.date_naissance && (
                  <p className="text-xs text-red-600 mt-1">{errors.date_naissance}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lieu de naissance <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.lieu_naissance}
                  onChange={(e) => setFormData({ ...formData, lieu_naissance: e.target.value })}
                  placeholder="Lieu de naissance"
                  className={errors.lieu_naissance ? 'border-red-300' : ''}
                />
                {errors.lieu_naissance && (
                  <p className="text-xs text-red-600 mt-1">{errors.lieu_naissance}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  placeholder="Adresse"
                  className={errors.adresse ? 'border-red-300' : ''}
                />
                {errors.adresse && <p className="text-xs text-red-600 mt-1">{errors.adresse}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'insertion {isAdmin && <span className="text-red-500">*</span>}
                  {!isAdmin && <span className="text-xs text-gray-500">(Admin uniquement)</span>}
                </label>
                <Input
                  type="date"
                  value={formData.date_inscription}
                  onChange={(e) => setFormData({ ...formData, date_inscription: e.target.value })}
                  disabled={!isAdmin}
                  className={!isAdmin ? 'bg-gray-100 cursor-not-allowed' : errors.date_inscription ? 'border-red-300' : ''}
                />
                {isAdmin && errors.date_inscription && (
                  <p className="text-xs text-red-600 mt-1">{errors.date_inscription}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image de profil
                </label>
                <div className="flex items-center gap-4">
                  {profileImagePreview && (
                    <img
                      src={profileImagePreview}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  )}
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {profileImagePreview ? 'Changer la photo' : 'Choisir une photo'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Informations de Formation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de Formation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.session_id}
                  onChange={(e) => setFormData({ ...formData, session_id: e.target.value })}
                  title="Session de formation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.titre}
                      </option>
                    ))
                  ) : (
                    <option value={sessionId}>Session actuelle</option>
                  )}
                </select>
                {formData.session_id !== sessionId && (
                  <p className="text-xs text-orange-600 mt-1 font-medium">
                    ⚠️ L'étudiant sera transféré vers cette nouvelle session
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formation <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.formation_id}
                  onChange={(e) => setFormData({ ...formData, formation_id: e.target.value })}
                  title="Formation"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.formation ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={loadingFormations}
                >
                  <option value="">Choisir une formation</option>
                  {formations.map((formation) => (
                    <option key={formation.id} value={formation.id}>
                      {formation.title} ({formation.price} DH)
                      {formation.is_pack && ' - Pack'}
                    </option>
                  ))}
                </select>
                {errors.formation && <p className="text-xs text-red-600 mt-1">{errors.formation}</p>}
                {selectedFormation && (
                  <p className="text-xs text-blue-600 mt-1">
                    Prix de la formation: {selectedFormation.price} DH
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de bon <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.numero_bon}
                  onChange={(e) => setFormData({ ...formData, numero_bon: e.target.value })}
                  placeholder="Numéro de bon"
                  className={errors.numero_bon ? 'border-red-300' : ''}
                />
                {errors.numero_bon && <p className="text-xs text-red-600 mt-1">{errors.numero_bon}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remise (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                  placeholder="0"
                />
                {selectedFormation && discountPct > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Remise: {discountPct.toFixed(2)}% (-{discountAmount.toFixed(2)} DH)
                  </p>
                )}
                {formationPrice > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Prix après remise: {priceAfterDiscount.toFixed(2)} DH
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avance payée (DH)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.avance}
                  onChange={(e) => setFormData({ ...formData, avance: e.target.value })}
                  placeholder="Avance"
                />
                {formData.avance && formationPrice > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Montant restant: {montantRestant.toFixed(2)} DH
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut de compte
                </label>
                <select
                  value={formData.statut_compte}
                  onChange={(e) => setFormData({ ...formData, statut_compte: e.target.value })}
                  title="Statut de compte"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                  <option value="diplome">Diplômé</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Mise à jour...</span>
                </div>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
