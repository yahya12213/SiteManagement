-- DEBUG: Analyser la demande spécifique qui échoue
-- Request ID: 57f8ce4c-d4be-460e-bec2-4d088a29172f

-- 1. Vérifier si la demande existe
SELECT
  lr.id,
  lr.status,
  lr.start_date,
  lr.end_date,
  e.id as employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  e.profile_id as employee_profile_id,
  lt.name as leave_type
FROM hr_leave_requests lr
JOIN hr_employees e ON e.id = lr.employee_id
LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
WHERE lr.id = '57f8ce4c-d4be-460e-bec2-4d088a29172f';

-- 2. Vérifier la hiérarchie de l'employé qui a créé cette demande
SELECT
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  m.first_name || ' ' || m.last_name as manager_name,
  m.email as manager_email,
  m.profile_id as manager_profile_id,
  hem.rank,
  hem.is_active
FROM hr_leave_requests lr
JOIN hr_employees e ON e.id = lr.employee_id
LEFT JOIN hr_employee_managers hem ON hem.employee_id = e.id
LEFT JOIN hr_employees m ON m.id = hem.manager_id
WHERE lr.id = '57f8ce4c-d4be-460e-bec2-4d088a29172f'
ORDER BY hem.rank;

-- 3. Vérifier le niveau d'approbation actuel
WITH request_info AS (
  SELECT
    lr.id,
    lr.status,
    lr.employee_id,
    CASE
      WHEN lr.status = 'pending' THEN 0
      WHEN lr.status = 'approved_n1' THEN 1
      WHEN lr.status = 'approved_n2' THEN 2
      ELSE 99
    END as current_level
  FROM hr_leave_requests lr
  WHERE lr.id = '57f8ce4c-d4be-460e-bec2-4d088a29172f'
)
SELECT
  ri.id as request_id,
  ri.status,
  ri.current_level,
  m.first_name || ' ' || m.last_name as expected_approver_name,
  m.email as expected_approver_email,
  m.profile_id as expected_approver_profile_id,
  hem.rank as approver_rank
FROM request_info ri
JOIN hr_employee_managers hem ON hem.employee_id = ri.employee_id
  AND hem.rank = ri.current_level
  AND hem.is_active = true
JOIN hr_employees m ON m.id = hem.manager_id;
