-- ============================================================================
-- PALAVRAS-CHAVE PARA QUALIFICAÇÃO RIGOROSA DE EDITAIS TI/TELECOM
-- Baseado nas regras de inclusão e exclusão definidas
-- ============================================================================

BEGIN;

-- ===========================================================================
-- CATEGORIA 1: TELECOM E CONECTIVIDADE
-- ===========================================================================

-- Link dedicado
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'link dedicado', 
        ARRAY['link exclusivo', 'conexão dedicada', 'enlace dedicado', 'circuito dedicado'], 
        1000, 'INCLUSAO', true);

-- Fibra óptica
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'fibra óptica', 
        ARRAY['fibra optica', 'cabo de fibra', 'rede óptica', 'rede optica', 'backbone fibra'], 
        950, 'INCLUSAO', true);

-- Rádio enlace
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'rádio enlace', 
        ARRAY['radio enlace', 'link de rádio', 'link de radio', 'enlace de microondas'], 
        900, 'INCLUSAO', true);

-- Internet dedicada
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'internet dedicada', 
        ARRAY['acesso dedicado à internet', 'conexão dedicada internet', 'banda dedicada'], 
        850, 'INCLUSAO', true);

-- Transmissão de dados
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'transmissão de dados', 
        ARRAY['transmissao de dados', 'envio de dados', 'transferência de dados'], 
        800, 'INCLUSAO', true);

-- Clear channel
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'clear channel', 
        ARRAY['canal limpo', 'circuito limpo', 'clear channel E1'], 
        750, 'INCLUSAO', true);

-- SD-WAN
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'SD-WAN', 
        ARRAY['software defined WAN', 'rede WAN definida por software', 'SDWAN'], 
        700, 'INCLUSAO', true);

-- MPLS
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'MPLS', 
        ARRAY['multiprotocol label switching', 'rede MPLS', 'VPN MPLS'], 
        650, 'INCLUSAO', true);

-- Ponto a ponto
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'ponto a ponto', 
        ARRAY['P2P', 'point to point', 'conexão ponto a ponto', 'enlace P2P'], 
        600, 'INCLUSAO', true);

-- Telefonia IP
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'telefonia IP', 
        ARRAY['VoIP', 'telefone IP', 'sistema de telefonia IP', 'comunicação IP'], 
        550, 'INCLUSAO', true);

-- PABX em nuvem
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'PABX em nuvem', 
        ARRAY['PABX cloud', 'central telefônica virtual', 'PABX virtual'], 
        500, 'INCLUSAO', true);

-- Banda larga corporativa
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (1, 'banda larga corporativa', 
        ARRAY['internet corporativa', 'acesso corporativo à internet'], 
        450, 'INCLUSAO', true);

COMMIT;
-- ===========================================================================
-- CATEGORIA 2: HARDWARE E ENDPOINTS
-- ===========================================================================

BEGIN;

-- Computador
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'computador', 
        ARRAY['PC', 'microcomputador', 'equipamento de informática'], 
        1000, 'INCLUSAO', true);

-- Desktop
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'desktop', 
        ARRAY['computador de mesa', 'PC desktop', 'estação desktop'], 
        950, 'INCLUSAO', true);

-- Estação de trabalho
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'estação de trabalho', 
        ARRAY['estacao de trabalho', 'workstation'], 
        900, 'INCLUSAO', true);

-- Notebook
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'notebook', 
        ARRAY['laptop', 'computador portátil', 'computador portatil'], 
        850, 'INCLUSAO', true);

-- Tablet
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'tablet', 
        ARRAY['dispositivo tablet', 'computador tablet'], 
        800, 'INCLUSAO', true);

-- Monitor de vídeo
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'monitor de vídeo', 
        ARRAY['monitor de video', 'display', 'tela de computador', 'monitor LCD', 'monitor LED'], 
        750, 'INCLUSAO', true);

-- Tela interativa
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'tela interativa', 
        ARRAY['display interativo', 'monitor touch', 'tela touchscreen'], 
        700, 'INCLUSAO', true);

-- No-break
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (2, 'no-break', 
        ARRAY['nobreak', 'UPS', 'fonte ininterrupta', 'sistema de alimentação ininterrupta'], 
        650, 'INCLUSAO', true);

COMMIT;
-- ===========================================================================
-- CATEGORIA 3: INFRAESTRUTURA, DATACENTER E CLOUD
-- ===========================================================================

BEGIN;

-- Servidor
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'servidor', 
        ARRAY['server', 'servidor de dados', 'servidor de aplicação'], 
        1000, 'INCLUSAO', true);

-- Storage
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'storage', 
        ARRAY['armazenamento', 'sistema de armazenamento', 'storage de rede'], 
        950, 'INCLUSAO', true);

-- Máquina virtual
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'máquina virtual', 
        ARRAY['maquina virtual', 'VM', 'virtual machine'], 
        900, 'INCLUSAO', true);

-- VPS
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'VPS', 
        ARRAY['virtual private server', 'servidor virtual privado'], 
        850, 'INCLUSAO', true);

-- Cloud computing
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'cloud computing', 
        ARRAY['computação em nuvem', 'computacao em nuvem', 'serviços em nuvem'], 
        800, 'INCLUSAO', true);

-- Infraestrutura em nuvem
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'infraestrutura em nuvem', 
        ARRAY['infraestrutura cloud', 'IaaS', 'Infrastructure as a Service'], 
        750, 'INCLUSAO', true);

-- Backup
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'backup', 
        ARRAY['cópia de segurança', 'backup de dados'], 
        700, 'INCLUSAO', true);

-- Backup em nuvem
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'backup em nuvem', 
        ARRAY['backup cloud', 'cópia de segurança em nuvem'], 
        650, 'INCLUSAO', true);

-- Disaster recovery
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'disaster recovery', 
        ARRAY['recuperação de desastres', 'plano de continuidade'], 
        600, 'INCLUSAO', true);

-- Switch
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'switch', 
        ARRAY['comutador', 'switch de rede'], 
        550, 'INCLUSAO', true);

-- Roteador
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'roteador', 
        ARRAY['router', 'roteador de rede'], 
        500, 'INCLUSAO', true);

-- Rack
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'rack', 
        ARRAY['gabinete de rede', 'rack de equipamentos'], 
        450, 'INCLUSAO', true);

-- Cabeamento estruturado
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'cabeamento estruturado', 
        ARRAY['cabeamento de rede', 'infraestrutura de cabeamento'], 
        400, 'INCLUSAO', true);

-- Access point
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'access point', 
        ARRAY['ponto de acesso', 'AP', 'wireless access point'], 
        350, 'INCLUSAO', true);

-- Wi-Fi corporativo
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (3, 'Wi-Fi corporativo', 
        ARRAY['WiFi corporativo', 'rede wireless corporativa'], 
        300, 'INCLUSAO', true);

COMMIT;
-- ===========================================================================
-- CATEGORIA 4: SEGURANÇA DA INFORMAÇÃO E SOFTWARE
-- ===========================================================================

BEGIN;

-- Segurança da informação
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'segurança da informação', 
        ARRAY['seguranca da informacao', 'information security'], 
        1000, 'INCLUSAO', true);

-- Cibersegurança
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'cibersegurança', 
        ARRAY['ciberseguranca', 'cybersecurity', 'cyber security'], 
        950, 'INCLUSAO', true);

-- Firewall
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'firewall', 
        ARRAY['parede de fogo', 'sistema de firewall'], 
        900, 'INCLUSAO', true);

-- Antivírus
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'antivírus', 
        ARRAY['antivirus', 'anti-vírus', 'software antivírus'], 
        850, 'INCLUSAO', true);

-- Endpoint security
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'endpoint security', 
        ARRAY['segurança de endpoint', 'proteção de endpoint'], 
        800, 'INCLUSAO', true);

-- EDR
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'EDR', 
        ARRAY['endpoint detection and response', 'detecção e resposta de endpoint'], 
        750, 'INCLUSAO', true);

-- XDR
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'XDR', 
        ARRAY['extended detection and response', 'detecção e resposta estendida'], 
        700, 'INCLUSAO', true);

-- Proteção de dados
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'proteção de dados', 
        ARRAY['protecao de dados', 'data protection'], 
        650, 'INCLUSAO', true);

-- Licenciamento de software
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'licenciamento de software', 
        ARRAY['licenças de software', 'licencas de software', 'software licensing'], 
        600, 'INCLUSAO', true);

-- Solução de segurança
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'solução de segurança', 
        ARRAY['solucao de seguranca', 'sistema de segurança'], 
        550, 'INCLUSAO', true);

-- SOC
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (4, 'SOC', 
        ARRAY['security operations center', 'centro de operações de segurança'], 
        500, 'INCLUSAO', true);

COMMIT;
-- ===========================================================================
-- CATEGORIA 5: SERVIÇOS DE TI
-- ===========================================================================

BEGIN;

-- Suporte técnico
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'suporte técnico', 
        ARRAY['suporte tecnico', 'assistência técnica', 'technical support'], 
        1000, 'INCLUSAO', true);

-- Outsourcing de impressão
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'outsourcing de impressão', 
        ARRAY['outsourcing de impressao', 'terceirização de impressão'], 
        950, 'INCLUSAO', true);

-- Outsourcing de TI
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'outsourcing de TI', 
        ARRAY['terceirização de TI', 'outsourcing de tecnologia'], 
        900, 'INCLUSAO', true);

-- Service desk
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'service desk', 
        ARRAY['central de atendimento', 'help desk'], 
        850, 'INCLUSAO', true);

-- Manutenção de computadores
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'manutenção de computadores', 
        ARRAY['manutencao de computadores', 'manutenção de equipamentos de TI'], 
        800, 'INCLUSAO', true);

-- Gestão de infraestrutura
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (5, 'gestão de infraestrutura', 
        ARRAY['gestao de infraestrutura', 'gerenciamento de infraestrutura'], 
        750, 'INCLUSAO', true);

COMMIT;
-- ===========================================================================
-- PALAVRAS DE EXCLUSÃO (PREVENÇÃO DE FALSOS POSITIVOS)
-- ===========================================================================

BEGIN;

-- Categoria especial para exclusões
INSERT INTO categorias_filtro_ti (id, codigo, nome, descricao, peso_categoria, cor_categoria, icone, ordem_exibicao, ativo) 
VALUES (6, 'exclusoes', 'Filtros de Exclusão', 'Termos que invalidam a qualificação do edital', -1000, '#ef4444', 'x-circle', 99, false)
ON CONFLICT (id) DO UPDATE SET 
    codigo = EXCLUDED.codigo,
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao;

-- Equipamentos médicos (conflito com "monitor")
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'monitor cardíaco', 
        ARRAY['monitor cardiaco', 'equipamento cardíaco', 'equipamento cardiaco'], 
        -1000, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'monitor fetal', 
        ARRAY['equipamento obstétrico', 'equipamento obstetrico'], 
        -950, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'equipamento médico', 
        ARRAY['equipamento medico', 'dispositivo médico', 'dispositivo medico'], 
        -900, 'EXCLUSAO', true);

-- Material escolar (conflito com "notebook" papelaria)
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'material escolar', 
        ARRAY['material didático', 'material didatico'], 
        -850, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'caderno', 
        ARRAY['caderno escolar', 'caderno estudantil'], 
        -800, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'papelaria', 
        ARRAY['material de papelaria', 'artigos de papelaria'], 
        -750, 'EXCLUSAO', true);

-- Construção e obras
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'construção civil', 
        ARRAY['construcao civil', 'obra civil'], 
        -700, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'pavimentação', 
        ARRAY['pavimentacao', 'asfaltamento'], 
        -650, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'obras de engenharia', 
        ARRAY['engenharia civil', 'construção predial'], 
        -600, 'EXCLUSAO', true);

-- Outros serviços não-TI
INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'merenda', 
        ARRAY['merenda escolar', 'alimentação escolar'], 
        -550, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'limpeza', 
        ARRAY['serviço de limpeza', 'limpeza predial'], 
        -500, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'conservação', 
        ARRAY['manutenção predial', 'conservação predial'], 
        -450, 'EXCLUSAO', true);

INSERT INTO palavras_chave_ti (categoria_id, palavra_principal, sinonimos, peso_relevancia, tipo_palavra, ativo)
VALUES (6, 'banda larga residencial', 
        ARRAY['internet residencial', 'banda larga domiciliar'], 
        -400, 'EXCLUSAO', true);

-- Atualizar view materializada
REFRESH MATERIALIZED VIEW palavras_chave_consolidadas;

-- Mostrar resumo final
SELECT 
    'RESUMO DA CARGA DE QUALIFICAÇÃO TI/TELECOM:' as info,
    (SELECT COUNT(*) FROM categorias_filtro_ti WHERE ativo = true) as categorias_ativas,
    (SELECT COUNT(*) FROM palavras_chave_ti WHERE tipo_palavra = 'INCLUSAO') as palavras_inclusao,
    (SELECT COUNT(*) FROM palavras_chave_ti WHERE tipo_palavra = 'EXCLUSAO') as palavras_exclusao,
    (SELECT COUNT(*) FROM palavras_chave_consolidadas) as total_consolidadas;

COMMIT;