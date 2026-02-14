/**
 * Types for Student Payment System
 */

export type PaymentMethod = 'especes' | 'virement' | 'cheque' | 'carte' | 'autre';

export interface StudentPayment {
  id: string;
  session_etudiant_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentFormData {
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  note?: string;
}

export interface PaymentResponse {
  success: boolean;
  payment?: StudentPayment;
  updated_totals?: {
    montant_paye: number;
    montant_du: number;
    statut_paiement: 'paye' | 'partiellement_paye' | 'impaye';
  };
  error?: string;
}

export interface PaymentHistoryResponse {
  success: boolean;
  payments: StudentPayment[];
  totals: {
    montant_total: number;
    montant_paye: number;
    montant_du: number;
    statut_paiement: 'paye' | 'partiellement_paye' | 'impaye';
  };
  error?: string;
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  carte: 'Carte',
  autre: 'Autre'
};
