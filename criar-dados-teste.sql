-- Dados de teste para Tech Solutions Ltda
-- ID da empresa: e457ad5d-799b-4c8b-91e4-19c3a02d0a3f

-- 1. Criar Contratos
INSERT INTO "Contract" (id, "number", title, description, value, "startDate", "endDate", status, "companyId", "slaResponseTime", "slaResolutionTime", "slaAvailability", "slaDescription", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'CTR-2026-001', 'Contrato de Suporte Técnico', 'Suporte técnico 24/7 com SLA garantido', 15000.00, '2026-01-01', '2026-12-31', 'ACTIVE', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', 2, 4, 99.9, 'Tempo de resposta: 2h, Resolução: 4h, Disponibilidade: 99.9%', NOW(), NOW()),
  (gen_random_uuid(), 'CTR-2025-089', 'Licenciamento de Software', 'Licenças anuais para 50 usuários', 25000.00, '2025-06-01', '2026-05-31', 'ACTIVE', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', 4, 8, 99.5, 'Suporte em horário comercial', NOW(), NOW()),
  (gen_random_uuid(), 'CTR-2024-156', 'Consultoria em TI', 'Projeto de migração para cloud', 50000.00, '2024-03-01', '2025-02-28', 'EXPIRED', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', NULL, NULL, NULL, NULL, NOW(), NOW());

-- 2. Criar Oportunidades
INSERT INTO "Opportunity" (id, title, description, value, stage, "expectedCloseDate", "companyId", "ownerId", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'Expansão de Infraestrutura', 'Upgrade de servidores e storage', 80000.00, 'PROPOSAL', '2026-03-15', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Implementação de CRM', 'Sistema de gestão de relacionamento com clientes', 45000.00, 'NEGOTIATION', '2026-02-28', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Treinamento de Equipe', 'Capacitação em novas tecnologias', 12000.00, 'QUALIFICATION', '2026-04-10', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW());

-- 3. Criar Atividades
INSERT INTO "Activity" (id, subject, description, type, "dueDate", status, "companyId", "assignedToId", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'Reunião de Kickoff', 'Reunião inicial para discutir requisitos do projeto', 'MEETING', '2026-02-15 10:00:00', 'SCHEDULED', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Follow-up de Proposta', 'Ligar para verificar status da proposta enviada', 'CALL', '2026-02-13 14:00:00', 'PENDING', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Envio de Documentação', 'Enviar documentação técnica do produto', 'EMAIL', '2026-02-10 09:00:00', 'COMPLETED', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Visita Técnica', 'Visita ao cliente para levantamento de requisitos', 'MEETING', '2026-02-20 15:00:00', 'SCHEDULED', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW()),
  (gen_random_uuid(), 'Apresentação de Solução', 'Apresentar proposta técnica e comercial', 'MEETING', '2026-02-08 11:00:00', 'COMPLETED', 'e457ad5d-799b-4c8b-91e4-19c3a02d0a3f', (SELECT id FROM "User" WHERE email = 'admin@crm.com'), NOW(), NOW());
