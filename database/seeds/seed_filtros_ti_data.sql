-- ============================================================================
-- CARGA INICIAL DE DADOS - SISTEMA DE FILTROS TI
-- Data: 2026-09-04
-- Descrição: Populando categorias e palavras-chave para o setor de TI
-- ============================================================================

-- Limpar dados existentes (apenas em desenvolvimento)
-- DELETE FROM "historico_buscas_ti";
-- DELETE FROM "palavras_chave_customizadas";
-- DELETE FROM "palavras_chave_ti";
-- DELETE FROM "categorias_filtro_ti";

-- ============================================================================
-- 1. INSERIR CATEGORIAS PRINCIPAIS DE TI
-- ============================================================================

INSERT INTO "categorias_filtro_ti" (codigo, nome, descricao, cor_categoria, icone, ordem_exibicao) VALUES
('termos_gerais', 'Termos Gerais', 'Termos amplos relacionados a tecnologia da informação', '#8b5cf6', 'cpu', 1),
('hardware', 'Hardware/Equipamentos', 'Equipamentos físicos e componentes de TI', '#3b82f6', 'hard-drive', 2),
('software', 'Software/Licenças', 'Softwares, licenças e sistemas operacionais', '#10b981', 'software', 3),
('servicos', 'Serviços', 'Serviços de TI, desenvolvimento e suporte técnico', '#f59e0b', 'settings', 4),
('infraestrutura', 'Infraestrutura', 'Redes, datacenters e infraestrutura de TI', '#ef4444', 'server', 5);

-- ============================================================================
-- 2. TERMOS GERAIS DE TI
-- ============================================================================

INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'termos_gerais'),
    'informática',
    ARRAY['informatica', 'informação', 'informacao', 'tecnologia da informação', 'tecnologia da informacao', 'TI', 'área de TI', 'area de TI'],
    1000
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'termos_gerais'),
    'TIC',
    ARRAY['tecnologia da informação e comunicação', 'tecnologia da informacao e comunicacao', 'TICs', 'TICS'],
    900
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'termos_gerais'),
    'processamento de dados',
    ARRAY['processamento', 'dados', 'processamento digital', 'sistema de processamento', 'centro de processamento'],
    800
);

-- ============================================================================
-- 3. HARDWARE/EQUIPAMENTOS
-- ============================================================================

INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'computador',
    ARRAY['computadores', 'microcomputador', 'microcomputadores', 'PC', 'PCs', 'desktop', 'desktops', 'CPU', 'CPUs'],
    1000
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'notebook',
    ARRAY['notebooks', 'laptop', 'laptops', 'portátil', 'portatil', 'portáteis', 'portateis', 'computador portátil', 'computador portatil'],
    950
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'servidor',
    ARRAY['servidores', 'server', 'servers', 'servidor de dados', 'servidor de aplicação', 'servidor de aplicacao', 'servidor web'],
    900
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'workstation',
    ARRAY['workstations', 'estação de trabalho', 'estacao de trabalho', 'estações de trabalho', 'estacoes de trabalho'],
    850
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'monitor',
    ARRAY['monitores', 'display', 'displays', 'tela', 'telas', 'monitor LCD', 'monitor LED', 'videomonitor', 'videomonitores'],
    800
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'impressora',
    ARRAY['impressoras', 'printer', 'printers', 'multifuncional', 'multifuncionais', 'copiadora', 'copiadoras', 'equipamento de impressão', 'equipamento de impressao'],
    750
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'scanner',
    ARRAY['scanners', 'digitalizador', 'digitalizadores', 'leitor óptico', 'leitor optico', 'digitalizador de documentos'],
    700
);
INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'switch',
    ARRAY['switches', 'comutador', 'comutadores', 'switch de rede', 'equipamento de comutação', 'equipamento de comutacao'],
    680
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'roteador',
    ARRAY['roteadores', 'router', 'routers', 'equipamento de roteamento', 'roteador de rede', 'roteador wireless'],
    670
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'nobreak',
    ARRAY['no-break', 'nobreaks', 'no-breaks', 'UPS', 'fonte ininterrupta', 'fonte de energia ininterrupta', 'sistema de alimentação ininterrupta', 'sistema de alimentacao ininterrupta'],
    650
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'storage',
    ARRAY['armazenamento', 'disco rígido', 'disco rigido', 'HD', 'SSD', 'NAS', 'SAN', 'sistema de armazenamento', 'storage de rede'],
    630
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'hardware'),
    'tablet',
    ARRAY['tablets', 'dispositivo móvel', 'dispositivo movel', 'tablet PC', 'computador tablet'],
    600
);

-- ============================================================================
-- 4. SOFTWARE/LICENÇAS
-- ============================================================================

INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'software',
    ARRAY['softwares', 'programa', 'programas', 'aplicativo', 'aplicativos', 'sistema', 'sistemas', 'solução de software', 'solucao de software'],
    1000
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'licença',
    ARRAY['licenças', 'licenca', 'licencas', 'licenciamento', 'licença de uso', 'licenca de uso', 'licença de software', 'licenca de software'],
    950
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'Microsoft',
    ARRAY['MS', 'Microsoft Office', 'Office 365', 'Windows', 'Microsoft Windows', 'MS Office', 'Microsoft SQL Server'],
    900
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'Windows',
    ARRAY['Microsoft Windows', 'Windows Server', 'sistema operacional Windows', 'SO Windows'],
    850
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'antivírus',
    ARRAY['antivirus', 'anti-vírus', 'anti-virus', 'software de proteção', 'software de protecao', 'segurança digital', 'seguranca digital'],
    800
);
INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'sistema operacional',
    ARRAY['sistema operacional', 'SO', 'OS', 'operating system', 'plataforma operacional'],
    750
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'Oracle',
    ARRAY['Oracle Database', 'Oracle DB', 'banco Oracle', 'sistema Oracle', 'Oracle Corporation'],
    700
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'Red Hat',
    ARRAY['RedHat', 'Red Hat Enterprise', 'RHEL', 'Red Hat Linux', 'sistema Red Hat'],
    650
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'software'),
    'Fortinet',
    ARRAY['FortiGate', 'FortiAnalyzer', 'segurança Fortinet', 'seguranca Fortinet', 'firewall Fortinet'],
    600
);

-- ============================================================================
-- 5. SERVIÇOS DE TI
-- ============================================================================

INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'desenvolvimento de software',
    ARRAY['desenvolvimento', 'programação', 'programacao', 'codificação', 'codificacao', 'desenvolvimento de sistemas', 'desenvolvimento de aplicações', 'desenvolvimento de aplicacoes'],
    1000
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'fábrica de software',
    ARRAY['fabrica de software', 'software factory', 'desenvolvimento ágil', 'desenvolvimento agil', 'metodologia ágil', 'metodologia agil'],
    950
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'suporte técnico',
    ARRAY['suporte tecnico', 'assistência técnica', 'assistencia tecnica', 'manutenção', 'manutencao', 'suporte de TI', 'help desk'],
    900
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'service desk',
    ARRAY['servicedesk', 'central de atendimento', 'central de servicos', 'central de serviços', 'atendimento técnico', 'atendimento tecnico'],
    850
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'nuvem',
    ARRAY['cloud', 'computação em nuvem', 'computacao em nuvem', 'serviços em nuvem', 'servicos em nuvem', 'cloud computing'],
    800
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'servicos'),
    'data center',
    ARRAY['datacenter', 'centro de dados', 'CPD', 'centro de processamento de dados', 'infraestrutura de dados'],
    750
);

-- ============================================================================
-- 6. INFRAESTRUTURA DE TI
-- ============================================================================

INSERT INTO "palavras_chave_ti" (categoria_id, palavra_principal, sinonimos, peso_relevancia) VALUES
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'infraestrutura'),
    'cabeamento estruturado',
    ARRAY['cabeamento', 'infraestrutura de rede', 'rede estruturada', 'cabeamento de rede', 'instalação de rede', 'instalacao de rede'],
    900
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'infraestrutura'),
    'fibra óptica',
    ARRAY['fibra optica', 'cabo de fibra', 'rede de fibra', 'conexão de fibra', 'conexao de fibra', 'link de fibra'],
    850
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'infraestrutura'),
    'rack',
    ARRAY['racks', 'gabinete de rede', 'armário de telecomunicações', 'armario de telecomunicacoes', 'rack de equipamentos'],
    800
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'infraestrutura'),
    'firewall',
    ARRAY['firewalls', 'parede de fogo', 'segurança de rede', 'seguranca de rede', 'proteção de rede', 'protecao de rede'],
    750
),
(
    (SELECT id FROM "categorias_filtro_ti" WHERE codigo = 'infraestrutura'),
    'access point',
    ARRAY['access points', 'ponto de acesso', 'pontos de acesso', 'AP', 'wireless access point', 'equipamento wifi', 'equipamento wi-fi'],
    700
);

-- ============================================================================
-- 7. ATUALIZAR VIEW MATERIALIZADA
-- ============================================================================

-- Refresh da view consolidada
SELECT refresh_palavras_chave_consolidadas();

-- ============================================================================
-- 8. ESTATÍSTICAS E VERIFICAÇÃO
-- ============================================================================

-- Mostrar estatísticas da carga
SELECT 
    'Resumo da Carga de Dados:' as info,
    (SELECT count(*) FROM "categorias_filtro_ti") as categorias_criadas,
    (SELECT count(*) FROM "palavras_chave_ti") as palavras_sistema,
    (SELECT count(*) FROM "mv_palavras_chave_consolidadas") as palavras_consolidadas;

-- Verificar distribuição por categoria
SELECT 
    c.nome as categoria,
    count(p.id) as quantidade_palavras,
    avg(p.peso_relevancia)::integer as peso_medio
FROM "categorias_filtro_ti" c
LEFT JOIN "palavras_chave_ti" p ON p.categoria_id = c.id
GROUP BY c.nome, c.ordem_exibicao
ORDER BY c.ordem_exibicao;

-- ============================================================================
-- SCRIPT DE CARGA CONCLUÍDO
-- ============================================================================