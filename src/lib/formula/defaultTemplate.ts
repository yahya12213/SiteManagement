import type { SessionCalculationSheet } from './types';

/**
 * Template par défaut pour une fiche de clôture de session
 */
export const DEFAULT_CALCULATION_TEMPLATE: Omit<SessionCalculationSheet, 'audit' | 'signatures'> = {
  version: '1.0.0',
  meta: {
    title: 'Clôture Session',
    currency: 'MAD',
    locale: 'fr-MA',
    status: 'Brouillon',
  },
  actors: {
    centre: {
      name: '',
      rc: '',
      ice: '',
    },
    prof: {
      id: '',
      name: '',
      cin: '',
      rib: '',
    },
  },
  session: {
    ref: '',
    title: '',
    location: '',
    dates: [],
    participants: {
      inscrits: 0,
      presents: 0,
    },
  },
  params: {
    taux_centre: 30,
    taux_prof: 70,
    tva: 0,
    ir_prof: 0,
    cnss_prof: 0,
  },
  fields: [
    // En-tête
    {
      id: 'lbl_header',
      type: 'label',
      props: { label: 'FICHE DE CLÔTURE DE SESSION' },
      layout: { x: 40, y: 20, w: 720, h: 40 },
    },

    // Section Heures & Tarifs
    {
      id: 'lbl_heures',
      type: 'label',
      props: { label: 'Heures & Tarifs' },
      layout: { x: 40, y: 80, w: 200, h: 32 },
    },
    {
      id: 'f_heures_prevues',
      type: 'number',
      ref: 'HEURES_PREVUES',
      props: { label: 'Heures prévues', decimals: 2, default: 0 },
      layout: { x: 40, y: 120, w: 160, h: 32 },
    },
    {
      id: 'f_heures_real',
      type: 'number',
      ref: 'HEURES_REAL',
      props: { label: 'Heures réalisées', decimals: 2, default: 0 },
      layout: { x: 220, y: 120, w: 160, h: 32 },
    },
    {
      id: 'f_tarif_h',
      type: 'number',
      ref: 'TARIF_H',
      props: { label: 'Tarif horaire', decimals: 2, default: 0 },
      layout: { x: 400, y: 120, w: 160, h: 32 },
    },
    {
      id: 'f_montant_brut',
      type: 'formula',
      ref: 'MONTANT_BRUT',
      props: {
        label: 'Montant brut',
        expression: 'HEURES_REAL*TARIF_H',
        decimals: 2,
      },
      layout: { x: 580, y: 120, w: 220, h: 32 },
    },

    // Section Frais
    {
      id: 'lbl_frais',
      type: 'label',
      props: { label: 'Frais & Retenues' },
      layout: { x: 40, y: 170, w: 200, h: 32 },
    },
    {
      id: 'f_frais_salle',
      type: 'number',
      ref: 'FRAIS_SALLE',
      props: { label: 'Frais salle', decimals: 2, default: 0 },
      layout: { x: 40, y: 210, w: 160, h: 32 },
    },
    {
      id: 'f_frais_supports',
      type: 'number',
      ref: 'FRAIS_SUPPORTS',
      props: { label: 'Frais supports', decimals: 2, default: 0 },
      layout: { x: 220, y: 210, w: 160, h: 32 },
    },
    {
      id: 'f_frais_depl',
      type: 'number',
      ref: 'FRAIS_DEPL',
      props: { label: 'Frais déplacement', decimals: 2, default: 0 },
      layout: { x: 400, y: 210, w: 160, h: 32 },
    },
    {
      id: 'f_frais_total',
      type: 'formula',
      ref: 'FRAIS_TOTAL',
      props: {
        label: 'Total frais',
        expression: 'SUM(FRAIS_SALLE,FRAIS_SUPPORTS,FRAIS_DEPL)',
        decimals: 2,
      },
      layout: { x: 580, y: 210, w: 220, h: 32 },
    },

    // Section Répartition
    {
      id: 'lbl_repartition',
      type: 'label',
      props: { label: 'Répartition Centre / Professeur' },
      layout: { x: 40, y: 260, w: 300, h: 32 },
    },
    {
      id: 'f_base_partage',
      type: 'formula',
      ref: 'BASE_PARTAGE',
      props: {
        label: 'Base de partage',
        expression: 'MONTANT_BRUT-FRAIS_TOTAL',
        decimals: 2,
      },
      layout: { x: 40, y: 300, w: 220, h: 32 },
    },
    {
      id: 'f_taux_centre',
      type: 'number',
      ref: 'TAUX_CENTRE',
      props: { label: 'Taux centre (%)', decimals: 2, default: 30 },
      layout: { x: 280, y: 300, w: 160, h: 32 },
    },
    {
      id: 'f_part_centre',
      type: 'formula',
      ref: 'PART_CENTRE',
      props: {
        label: 'Part centre',
        expression: 'ROUND(BASE_PARTAGE*TAUX_CENTRE/100,2)',
        decimals: 2,
      },
      layout: { x: 460, y: 300, w: 200, h: 32 },
    },
    {
      id: 'f_part_prof_brute',
      type: 'formula',
      ref: 'PART_PROF_BRUTE',
      props: {
        label: 'Part prof brute',
        expression: 'BASE_PARTAGE-PART_CENTRE',
        decimals: 2,
      },
      layout: { x: 680, y: 300, w: 220, h: 32 },
    },

    // Section Retenues Professeur
    {
      id: 'lbl_retenues',
      type: 'label',
      props: { label: 'Retenues Professeur' },
      layout: { x: 40, y: 350, w: 200, h: 32 },
    },
    {
      id: 'f_avance_prof',
      type: 'number',
      ref: 'AVANCE_PROF',
      props: { label: 'Avance versée', decimals: 2, default: 0 },
      layout: { x: 40, y: 390, w: 160, h: 32 },
    },
    {
      id: 'f_penalites',
      type: 'number',
      ref: 'PENALITES',
      props: { label: 'Pénalités', decimals: 2, default: 0 },
      layout: { x: 220, y: 390, w: 160, h: 32 },
    },
    {
      id: 'f_ir_prof',
      type: 'number',
      ref: 'IR_PROF',
      props: { label: 'IR/RS', decimals: 2, default: 0 },
      layout: { x: 400, y: 390, w: 160, h: 32 },
    },
    {
      id: 'f_cnss_prof',
      type: 'number',
      ref: 'CNSS_PROF',
      props: { label: 'CNSS', decimals: 2, default: 0 },
      layout: { x: 580, y: 390, w: 160, h: 32 },
    },
    {
      id: 'f_retenues_prof',
      type: 'formula',
      ref: 'RETENUES_PROF',
      props: {
        label: 'Total retenues',
        expression: 'SUM(AVANCE_PROF,PENALITES,IR_PROF,CNSS_PROF)',
        decimals: 2,
      },
      layout: { x: 760, y: 390, w: 220, h: 32 },
    },

    // Total Final
    {
      id: 'lbl_total',
      type: 'label',
      props: { label: 'TOTAL À PAYER AU PROFESSEUR' },
      layout: { x: 40, y: 440, w: 400, h: 40 },
    },
    {
      id: 'f_part_prof_net',
      type: 'formula',
      ref: 'PART_PROF_NET',
      props: {
        label: 'Net à payer',
        expression: 'PART_PROF_BRUTE-RETENUES_PROF',
        decimals: 2,
      },
      layout: { x: 460, y: 440, w: 340, h: 40 },
    },
  ],
};
