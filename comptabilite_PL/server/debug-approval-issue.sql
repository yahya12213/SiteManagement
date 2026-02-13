-- DIAGNOSTIC BUG #2: Erreur 400 sur approbation
-- Ce script vérifie les causes possibles de l'erreur d'approbation

-- ============================================
-- VÉRIFICATION 1: Profils sans hr_employee
-- ============================================
-- Liste les utilisateurs qui ont un profil mais PAS d'enregistrement hr_employee
SELECT
  p.id as profile_id,
  he.email,
  p.full_name,
  p.role,
  CASE WHEN he.id IS NULL THEN '❌ MANQUANT' ELSE '✅ OK' END as hr_employee_status
FROM profiles p
LEFT JOIN hr_employees he ON he.profile_id = p.id
WHERE p.role IN ('employee', 'gerant', 'admin')
ORDER BY hr_employee_status DESC, he.email;

-- ============================================
-- VÉRIFICATION 2: Employés sans hiérarchie
-- ============================================
-- Liste les employés qui n'ont pas de managers assignés
SELECT
  he.id as employee_id,
  he.employee_number,
  he.first_name || ' ' || he.last_name as employee_name,
  he.employment_status,
  COUNT(hem.manager_id) as nombre_managers
FROM hr_employees he
LEFT JOIN hr_employee_managers hem ON hem.employee_id = he.id AND hem.is_active = true
WHERE he.employment_status = 'active'
GROUP BY he.id, he.employee_number, he.first_name, he.last_name, he.employment_status
HAVING COUNT(hem.manager_id) = 0
ORDER BY he.employee_number;

-- ============================================
-- VÉRIFICATION 3: Hiérarchies complètes
-- ============================================
-- Affiche la hiérarchie de chaque employé actif
SELECT
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  m.first_name || ' ' || m.last_name as manager_name,
  hem.rank,
  hem.is_active,
  m.email as manager_email
FROM hr_employees e
JOIN hr_employee_managers hem ON hem.employee_id = e.id
JOIN hr_employees m ON m.id = hem.manager_id
WHERE e.employment_status = 'active'
ORDER BY e.employee_number, hem.rank;

-- ============================================
-- VÉRIFICATION 4: Demandes en attente
-- ============================================
-- Liste toutes les demandes de congé en attente avec info approbateur attendu
SELECT
  lr.id as request_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  lt.name as leave_type,
  lr.start_date,
  lr.end_date,
  lr.status,
  CASE
    WHEN lr.status = 'pending' THEN 0
    WHEN lr.status = 'approved_n1' THEN 1
    WHEN lr.status = 'approved_n2' THEN 2
    ELSE 99
  END as current_level,
  (
    SELECT m.first_name || ' ' || m.last_name || ' (' || m.email || ')'
    FROM hr_employee_managers hem
    JOIN hr_employees m ON m.id = hem.manager_id
    WHERE hem.employee_id = e.id
      AND hem.is_active = true
      AND hem.rank = CASE
        WHEN lr.status = 'pending' THEN 0
        WHEN lr.status = 'approved_n1' THEN 1
        WHEN lr.status = 'approved_n2' THEN 2
        ELSE 0
      END
    LIMIT 1
  ) as expected_approver
FROM hr_leave_requests lr
JOIN hr_employees e ON e.id = lr.employee_id
LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
WHERE lr.status IN ('pending', 'approved_n1', 'approved_n2')
ORDER BY lr.created_at DESC;

-- ============================================
-- VÉRIFICATION 5: Managers inactifs
-- ============================================
-- Liste les relations manager-employé inactives
SELECT
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  m.first_name || ' ' || m.last_name as manager_name,
  hem.rank,
  hem.is_active,
  hem.updated_at
FROM hr_employee_managers hem
JOIN hr_employees e ON e.id = hem.employee_id
JOIN hr_employees m ON m.id = hem.manager_id
WHERE hem.is_active = false
ORDER BY hem.updated_at DESC;
