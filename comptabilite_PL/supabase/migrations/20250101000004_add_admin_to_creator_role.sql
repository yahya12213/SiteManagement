-- Migration pour ajouter 'admin' au CHECK constraint de creator_role
-- Permet aux administrateurs de créer des déclarations

-- Supprimer l'ancien constraint sur creator_role
ALTER TABLE professor_declarations
DROP CONSTRAINT IF EXISTS professor_declarations_creator_role_check;

-- Ajouter le nouveau constraint avec 'admin' inclus
ALTER TABLE professor_declarations
ADD CONSTRAINT professor_declarations_creator_role_check
CHECK(creator_role IN ('professor', 'gerant', 'admin'));
