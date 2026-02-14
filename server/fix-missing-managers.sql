-- FIX BUG #2: Assigner des managers aux employés assia koubis et sara sara
-- Ces employés n'ont actuellement pas de managers, ce qui bloque les approbations

-- Récupérer les IDs nécessaires
DO $$
DECLARE
  admin_emp_id UUID;
  khalid_emp_id UUID;
  assia_emp_id UUID;
  sara_emp_id UUID;
BEGIN
  -- Trouver l'ID de l'administrateur (manager de niveau supérieur)
  SELECT id INTO admin_emp_id
  FROM hr_employees
  WHERE employee_number = 'EMP-ADMIN-3991';

  -- Trouver l'ID de khalid fathi (manager de niveau intermédiaire)
  SELECT id INTO khalid_emp_id
  FROM hr_employees
  WHERE employee_number = 'EMP-KHALI-0723';

  -- Trouver les IDs des employés sans managers
  SELECT id INTO assia_emp_id
  FROM hr_employees
  WHERE employee_number = 'EMP-ASSIA-5626';

  SELECT id INTO sara_emp_id
  FROM hr_employees
  WHERE employee_number = 'EMP-SARA-5281';

  -- Afficher les IDs trouvés
  RAISE NOTICE 'Admin ID: %', admin_emp_id;
  RAISE NOTICE 'Khalid ID: %', khalid_emp_id;
  RAISE NOTICE 'Assia ID: %', assia_emp_id;
  RAISE NOTICE 'Sara ID: %', sara_emp_id;

  -- Vérifier que tous les IDs ont été trouvés
  IF admin_emp_id IS NULL OR khalid_emp_id IS NULL OR assia_emp_id IS NULL OR sara_emp_id IS NULL THEN
    RAISE EXCEPTION 'Un ou plusieurs employés n''ont pas été trouvés';
  END IF;

  -- Assigner managers à assia koubis
  -- Manager N (rank 0): khalid fathi
  -- Manager N+1 (rank 1): Administrateur
  INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
  VALUES
    (assia_emp_id, khalid_emp_id, 0, true),
    (assia_emp_id, admin_emp_id, 1, true)
  ON CONFLICT (employee_id, manager_id) DO NOTHING;

  RAISE NOTICE 'Managers assignés à assia koubis';

  -- Assigner managers à sara sara
  -- Manager N (rank 0): khalid fathi
  -- Manager N+1 (rank 1): Administrateur
  INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
  VALUES
    (sara_emp_id, khalid_emp_id, 0, true),
    (sara_emp_id, admin_emp_id, 1, true)
  ON CONFLICT (employee_id, manager_id) DO NOTHING;

  RAISE NOTICE 'Managers assignés à sara sara';

END $$;

-- Vérification finale
SELECT
  e.employee_number,
  e.first_name || ' ' || e.last_name as employee_name,
  m.first_name || ' ' || m.last_name as manager_name,
  hem.rank,
  hem.is_active
FROM hr_employee_managers hem
JOIN hr_employees e ON e.id = hem.employee_id
JOIN hr_employees m ON m.id = hem.manager_id
WHERE e.employee_number IN ('EMP-ASSIA-5626', 'EMP-SARA-5281')
ORDER BY e.employee_number, hem.rank;
