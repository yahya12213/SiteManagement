-- Seed data pour l'environnement de développement

-- Insérer un admin par défaut
-- Mot de passe: admin123 (hashé avec bcrypt)
INSERT INTO profiles (id, username, password, full_name, role)
VALUES (
  'admin_1',
  'admin',
  '$2a$10$XQZ9cKZJ6rPzN.z5w5vZDeH8YnZ1vQxZJ7XZ7qJzN1vQxZJ7XZ7qJ',
  'Administrateur',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
