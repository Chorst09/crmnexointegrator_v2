-- ============================================================================
-- SISTEMA RIGOROSO DE QUALIFICAÇÃO DE EDITAIS TI/TELECOM
-- Atualização das palavras-chave com filtros de inclusão e exclusão
-- ============================================================================

BEGIN;

-- Limpar dados existentes
DELETE FROM palavras_chave_ti;
DELETE FROM categorias_filtro_ti;

-- CATEGORIA 1: TELECOM E CONECTIVIDADE
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo) 
VALUES (1, 'telecom_conectividade', 'Telecom e Conectividade', 'Serviços de telecomunicações e conectividade', 1000, '#e11d48', 'radio', 1, true);

-- CATEGORIA 2: HARDWARE E ENDPOINTS  
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo)
VALUES (2, 'hardware_endpoints', 'Hardware e Endpoints', 'Equipamentos físicos e dispositivos finais', 950, '#3b82f6', 'monitor', 2, true);

-- CATEGORIA 3: INFRAESTRUTURA, DATACENTER E CLOUD
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo)
VALUES (3, 'infraestrutura_cloud', 'Infraestrutura, Datacenter e Cloud', 'Servidores, storage, redes e serviços em nuvem', 900, '#10b981', 'server', 3, true);

-- CATEGORIA 4: SEGURANÇA DA INFORMAÇÃO E SOFTWARE
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo)
VALUES (4, 'seguranca_software', 'Segurança da Informação e Software', 'Soluções de segurança e licenciamento', 850, '#f59e0b', 'shield', 4, true);

-- CATEGORIA 5: SERVIÇOS DE TI
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo)
VALUES (5, 'servicos_ti', 'Serviços de TI', 'Suporte, outsourcing e gestão de infraestrutura', 800, '#8b5cf6', 'settings', 5, true);

COMMIT;