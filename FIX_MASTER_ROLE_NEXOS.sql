-- Corrigir role MASTER no nexos
-- Execute linha por linha e me mostre o resultado de cada uma

-- 1. Verificar estado atual
SELECT id, name, email, role FROM users WHERE email = 'admin@crm.com';

-- 2. Deletar e recriar o usuário com role MASTER correto
-- (Apenas se a atualização simples não funcionar)

-- 3. Atualização simples (tente primeiro)
UPDATE users SET role = 'MASTER' WHERE email = 'admin@crm.com';

-- 4. Verificar se funcionou
SELECT id, name, email, role FROM users WHERE email = 'admin@crm.com';

-- 5. Se ainda não funcionar, tente com aspas duplas
UPDATE users SET role = "MASTER" WHERE email = 'admin@crm.com';

-- 6. Verificar novamente
SELECT id, name, email, role FROM users WHERE email = 'admin@crm.com';
