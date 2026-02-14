/**
 * Utilitaires pour l'export de données en CSV et PDF
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StudentProgress } from '@/lib/api/analytics';

/**
 * Exporter les données en CSV
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Obtenir les en-têtes
  const headers = Object.keys(data[0]);

  // Créer le contenu CSV
  const csvContent = [
    headers.join(','), // En-têtes
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Échapper les virgules et guillemets
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  // Créer un Blob et télécharger
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exporter le rapport d'un étudiant en PDF
 */
export const exportStudentReportPDF = (studentProgress: StudentProgress) => {
  const doc = new jsPDF();
  const student = studentProgress.student;

  // En-tête du document
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246); // blue-600
  doc.text('Rapport de Progression', 14, 20);

  // Informations de l'étudiant
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Étudiant: ${student.full_name}`, 14, 35);
  doc.text(`Email: ${student.email}`, 14, 42);
  doc.text(`Inscrit le: ${new Date(student.created_at).toLocaleDateString('fr-FR')}`, 14, 49);
  doc.text(`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`, 14, 56);

  // Ligne de séparation
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.line(14, 60, 196, 60);

  // Statistiques globales
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text('Statistiques Globales', 14, 70);

  const totalVideos = studentProgress.enrollments.reduce((sum, e) => sum + e.total_videos, 0);
  const completedVideos = studentProgress.enrollments.reduce((sum, e) => sum + e.completed_videos, 0);
  const totalTests = studentProgress.enrollments.reduce((sum, e) => sum + e.total_tests, 0);
  const passedTests = studentProgress.enrollments.reduce((sum, e) => sum + e.passed_tests, 0);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Formations inscrites: ${studentProgress.enrollments.length}`, 14, 80);
  doc.text(`Formations complétées: ${studentProgress.enrollments.filter(e => e.completed_at).length}`, 14, 87);
  doc.text(`Vidéos complétées: ${completedVideos} / ${totalVideos}`, 14, 94);
  doc.text(`Tests réussis: ${passedTests} / ${totalTests}`, 14, 101);

  // Formations inscrites (tableau)
  if (studentProgress.enrollments.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('Formations Inscrites', 14, 115);

    const formationRows = studentProgress.enrollments.map((enrollment) => [
      enrollment.formation_title,
      new Date(enrollment.enrolled_at).toLocaleDateString('fr-FR'),
      enrollment.completed_at ? new Date(enrollment.completed_at).toLocaleDateString('fr-FR') : '-',
      `${enrollment.completed_videos}/${enrollment.total_videos}`,
      `${enrollment.passed_tests}/${enrollment.total_tests}`,
      enrollment.status === 'completed' ? 'Complété' : enrollment.status === 'active' ? 'En cours' : 'Inactif',
    ]);

    autoTable(doc, {
      head: [['Formation', 'Date Inscription', 'Date Complétion', 'Vidéos', 'Tests', 'Statut']],
      body: formationRows,
      startY: 120,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });
  }

  // Historique des tests (nouvelle page si nécessaire)
  if (studentProgress.test_history.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || 120;

    let startY: number;
    if (finalY > 220) {
      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text('Historique des Tests', 14, 20);
      startY = 25;
    } else {
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text('Historique des Tests', 14, finalY + 15);
      startY = finalY + 20;
    }

    const testRows = studentProgress.test_history.map((test) => {
      const percentage = test.total_points > 0
        ? ((test.score / test.total_points) * 100).toFixed(1)
        : '0';
      return [
        test.formation_title,
        test.test_title,
        `${test.score}/${test.total_points}`,
        `${percentage}%`,
        test.passed ? 'Réussi' : 'Échoué',
        new Date(test.submitted_at).toLocaleDateString('fr-FR'),
      ];
    });

    autoTable(doc, {
      head: [['Formation', 'Test', 'Score', '%', 'Résultat', 'Date']],
      body: testRows,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });
  }

  // Pied de page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text(
      `Page ${i} sur ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Sauvegarder le PDF
  const filename = `rapport_${student.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Exporter les formations en CSV
 */
export const exportFormationsCSV = (formations: any[]) => {
  const data = formations.map((formation) => ({
    ID: formation.id,
    Titre: formation.title,
    Inscriptions: formation.enrollment_count,
    Complétés: formation.completed_count,
    'Taux de Complétion (%)': formation.completion_rate,
    Prix: formation.price || 0,
  }));

  exportToCSV(data, `formations_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Exporter les étudiants actifs en CSV
 */
export const exportActiveStudentsCSV = (students: any[]) => {
  const data = students.map((student) => ({
    ID: student.id,
    Nom: student.full_name,
    Email: student.email,
    Inscriptions: student.enrollments_count,
    'Vidéos Vues': student.videos_watched,
    'Vidéos Complétées': student.videos_completed,
    'Tests Passés': student.tests_taken,
    'Tests Réussis': student.tests_passed,
  }));

  exportToCSV(data, `etudiants_actifs_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Exporter les tendances d'inscriptions en CSV
 */
export const exportEnrollmentTrendsCSV = (trends: any[]) => {
  const data = trends.map((trend) => ({
    Mois: trend.month,
    Inscriptions: trend.enrollment_count,
    Complétés: trend.completed_count,
  }));

  exportToCSV(data, `tendances_inscriptions_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Exporter le rapport d'un étudiant en CSV
 */
export const exportStudentReportCSV = (studentProgress: StudentProgress) => {
  const student = studentProgress.student;

  // Formations inscrites
  const formationsData = studentProgress.enrollments.map((enrollment) => ({
    Formation: enrollment.formation_title,
    'Date Inscription': new Date(enrollment.enrolled_at).toLocaleDateString('fr-FR'),
    'Date Complétion': enrollment.completed_at ? new Date(enrollment.completed_at).toLocaleDateString('fr-FR') : '-',
    'Vidéos Complétées': enrollment.completed_videos,
    'Total Vidéos': enrollment.total_videos,
    'Tests Réussis': enrollment.passed_tests,
    'Total Tests': enrollment.total_tests,
    Statut: enrollment.status === 'completed' ? 'Complété' : enrollment.status === 'active' ? 'En cours' : 'Inactif',
  }));

  exportToCSV(
    formationsData,
    `rapport_formations_${student.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
  );

  // Historique des tests (séparé)
  if (studentProgress.test_history.length > 0) {
    const testsData = studentProgress.test_history.map((test) => {
      const percentage = test.total_points > 0
        ? ((test.score / test.total_points) * 100).toFixed(1)
        : '0';
      return {
        Formation: test.formation_title,
        Test: test.test_title,
        Score: test.score,
        'Total Points': test.total_points,
        'Pourcentage (%)': percentage,
        Résultat: test.passed ? 'Réussi' : 'Échoué',
        Date: new Date(test.submitted_at).toLocaleDateString('fr-FR'),
      };
    });

    exportToCSV(
      testsData,
      `rapport_tests_${student.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
    );
  }
};
