-- ============================================================================
-- ATUALIZAÇÃO PARA SISTEMA DE QUALIFICAÇÃO RIGOROSA TI/TELECOM
-- Baseado na estrutura existente das tabelas
-- ============================================================================

BEGIN;

-- Limpar dados existentes
DELETE FROM palavras_chave_ti;
DELETE FROM categorias_filtro_ti;

-- CATEGORIA 1: TELECOM E CONECTIVIDADE
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo) 
VALUES ('telecom_conectividade', 'Telecom e Conectividade', 'Serviços de telecomunicações e conectividade corporativa', '#e11d48', 'radio', 1, true);

-- CATEGORIA 2: HARDWARE E ENDPOINTS  
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo)
VALUES ('hardware_endpoints', 'Hardware e Endpoints', 'Equipamentos físicos e dispositivos finais de TI', '#3b82f6', 'monitor', 2, true);

-- CATEGORIA 3: INFRAESTRUTURA, DATACENTER E CLOUD
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo)
VALUES ('infraestrutura_cloud', 'Infraestrutura, Datacenter e Cloud', 'Servidores, storage, redes e serviços em nuvem', '#10b981', 'server', 3, true);

-- CATEGORIA 4: SEGURANÇA DA INFORMAÇÃO E SOFTWARE
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo)
VALUES ('seguranca_software', 'Segurança da Informação e Software', 'Soluções de segurança e licenciamento de software', '#f59e0b', 'shield', 4, true);

-- CATEGORIA 5: SERVIÇOS DE TI
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo)
VALUES ('servicos_ti', 'Serviços de TI', 'Suporte técnico, outsourcing e gestão de infraestrutura', '#8b5cf6', 'settings', 5, true);

-- CATEGORIA 6: EXCLUSÕES (para filtros negativos)
INSERT INTO categorias_filtro_ti (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao, ativo)
VALUES ('exclusoes', 'Filtros de Exclusão', 'Termos que invalidam a qualificação do edital', '#ef4444', 'x-circle', 99, false);

COMMIT;

-- Mostrar resultado
SELECT 'Categorias criadas com sucesso:' as status, COUNT(*) as total FROM categorias_filtro_ti;