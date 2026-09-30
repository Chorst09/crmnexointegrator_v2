-- ============================================================================
-- Migração: Criação da tabela licitacoes_pncp para integração com API PNCP
-- Autor: AI Assistant (Engenheiro de Dados)
-- Data: 2026-09-03
-- Descrição: Tabela para armazenar dados consolidados de licitações do PNCP
-- ============================================================================

-- Criação da tabela principal licitacoes_pncp
CREATE TABLE IF NOT EXISTS "licitacoes_pncp" (
    -- Campos de identificação PNCP
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "numero_controle_pncp" VARCHAR(255) UNIQUE NOT NULL, -- numeroControlePNCP (chave única do PNCP)
    "numero_compra" VARCHAR(50), -- numeroCompra (número no sistema origem)
    "ano_compra" INTEGER, -- anoCompra
    "processo" VARCHAR(50), -- processo (número do processo)
    "sequencial_compra" INTEGER, -- sequencialCompra (número sequencial PNCP)
    
    -- Informações básicas da licitação
    "objeto_compra" TEXT, -- objetoCompra (descrição do objeto)
    "informacao_complementar" TEXT, -- informacaoComplementar
    "valor_total_estimado" DECIMAL(15,4) DEFAULT 0, -- valorTotalEstimado (precisão 4 decimais)
    "valor_total_homologado" DECIMAL(15,4) DEFAULT 0, -- valorTotalHomologado
    "srp" BOOLEAN DEFAULT false, -- srp (Sistema de Registro de Preços)
    
    -- Tipo de instrumento e modalidade
    "tipo_instrumento_convocatorio_id" INTEGER, -- tipoInstrumentoConvocatorioId
    "tipo_instrumento_convocatorio_nome" VARCHAR(255), -- tipoInstrumentoConvocatorioNome
    "modalidade_id" INTEGER, -- modalidadeId
    "modalidade_nome" VARCHAR(255), -- modalidadeNome
    "modo_disputa_id" INTEGER, -- modoDisputaId  
    "modo_disputa_nome" VARCHAR(255), -- modoDisputaNome
    
    -- Situação da licitação
    "situacao_compra_id" INTEGER, -- situacaoCompraId
    "situacao_compra_nome" VARCHAR(255), -- situacaoCompraNome
    
    -- Amparo legal (estrutura JSON para flexibilidade)
    "amparo_legal" JSONB, -- amparoLegal: {codigo, nome, descricao}
    
    -- Datas importantes
    "data_abertura_proposta" TIMESTAMPTZ, -- dataAberturaProposta (com timezone)
    "data_encerramento_proposta" TIMESTAMPTZ, -- dataEncerramentoProposta
    "data_publicacao_pncp" DATE, -- dataPublicacaoPncp
    "data_inclusao_pncp" DATE, -- dataInclusao
    "data_atualizacao_pncp" DATE, -- dataAtualizacao
    
    -- Dados do órgão principal (estrutura JSON para flexibilidade)
    "orgao_entidade" JSONB, -- orgaoEntidade: {cnpj, razaoSocial, poderId, esferaId}
    "unidade_orgao" JSONB, -- unidadeOrgao: {codigoUnidade, nomeUnidade, codigoIbge, municipioNome, ufSigla, ufNome}
    
    -- Dados do órgão sub-rogado (quando aplicável)
    "orgao_sub_rogado" JSONB, -- orgaoSubRogado (estrutura similar)
    "unidade_sub_rogada" JSONB, -- unidadeSubRogada (estrutura similar)
    
    -- Informações complementares
    "usuario_nome" VARCHAR(255), -- usuarioNome (sistema que enviou)
    "link_sistema_origem" TEXT, -- linkSistemaOrigem (URL para propostas)
    "justificativa_presencial" TEXT, -- justificativaPresencial
    
    -- Campos de controle interno
    "origem_dados" VARCHAR(50) DEFAULT 'PNCP_API', -- origem dos dados
    "status_processamento" VARCHAR(50) DEFAULT 'NOVO', -- NOVO, PROCESSADO, ERRO
    "metadata_processamento" JSONB, -- logs e metadados do processamento
    "hash_verificacao" VARCHAR(64), -- hash para detectar alterações nos dados
    
    -- Timestamps padrão do sistema
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ÍNDICES OTIMIZADOS PARA BUSCA RÁPIDA
-- ============================================================================

-- Índice único no número de controle PNCP (chave primária de negócio)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_licitacoes_pncp_numero_controle" 
ON "licitacoes_pncp" ("numero_controle_pncp");

-- Índice composto para busca por data de publicação (query mais comum)
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_data_publicacao" 
ON "licitacoes_pncp" ("data_publicacao_pncp" DESC);

-- Índice para busca por modalidade
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_modalidade" 
ON "licitacoes_pncp" ("modalidade_id", "modalidade_nome");

-- Índice para busca por situação
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_situacao" 
ON "licitacoes_pncp" ("situacao_compra_id");

-- Índice composto para busca por data de abertura/encerramento de propostas
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_propostas_periodo" 
ON "licitacoes_pncp" ("data_abertura_proposta", "data_encerramento_proposta") 
WHERE "data_abertura_proposta" IS NOT NULL;

-- Índice para busca por valor (licitações de maior valor)
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_valor" 
ON "licitacoes_pncp" ("valor_total_estimado" DESC NULLS LAST);

-- Índice GIN para busca em campos JSON (órgão e unidade)
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_orgao_gin" 
ON "licitacoes_pncp" USING gin ("orgao_entidade");

CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_unidade_gin" 
ON "licitacoes_pncp" USING gin ("unidade_orgao");

-- Índice para busca por CNPJ do órgão (query comum)
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_orgao_cnpj" 
ON "licitacoes_pncp" ((orgao_entidade->>'cnpj'));

-- Índice para busca por UF
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_uf" 
ON "licitacoes_pncp" ((unidade_orgao->>'ufSigla'));

-- Índice para controle de processamento
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_status_processamento" 
ON "licitacoes_pncp" ("status_processamento", "created_at");

-- Índice para busca por ano
CREATE INDEX IF NOT EXISTS "idx_licitacoes_pncp_ano" 
ON "licitacoes_pncp" ("ano_compra");

-- ============================================================================
-- TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DO TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_licitacoes_pncp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_licitacoes_pncp_updated_at
    BEFORE UPDATE ON "licitacoes_pncp"
    FOR EACH ROW
    EXECUTE FUNCTION update_licitacoes_pncp_updated_at();

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE "licitacoes_pncp" IS 'Tabela para armazenamento de licitações consolidadas da API PNCP';
COMMENT ON COLUMN "licitacoes_pncp"."numero_controle_pncp" IS 'Número de controle único no PNCP (chave de negócio)';
COMMENT ON COLUMN "licitacoes_pncp"."objeto_compra" IS 'Descrição do objeto da licitação';
COMMENT ON COLUMN "licitacoes_pncp"."valor_total_estimado" IS 'Valor total estimado da licitação (precisão 4 decimais)';
COMMENT ON COLUMN "licitacoes_pncp"."orgao_entidade" IS 'Dados do órgão licitante em JSON {cnpj, razaoSocial, poderId, esferaId}';
COMMENT ON COLUMN "licitacoes_pncp"."unidade_orgao" IS 'Dados da unidade administrativa em JSON {codigoUnidade, nomeUnidade, municipio, uf}';
COMMENT ON COLUMN "licitacoes_pncp"."hash_verificacao" IS 'Hash SHA-256 para detectar alterações nos dados originais';
COMMENT ON COLUMN "licitacoes_pncp"."status_processamento" IS 'Status do processamento: NOVO, PROCESSADO, ERRO';

-- ============================================================================
-- VIEWS ÚTEIS PARA CONSULTAS COMUNS
-- ============================================================================

-- View para licitações em andamento (propostas em aberto)
CREATE OR REPLACE VIEW "v_licitacoes_pncp_em_andamento" AS
SELECT 
    id,
    numero_controle_pncp,
    objeto_compra,
    modalidade_nome,
    valor_total_estimado,
    data_abertura_proposta,
    data_encerramento_proposta,
    orgao_entidade->>'razaoSocial' as orgao_nome,
    unidade_orgao->>'ufSigla' as uf,
    link_sistema_origem,
    created_at
FROM "licitacoes_pncp"
WHERE situacao_compra_id = 1 -- Divulgada no PNCP
  AND data_encerramento_proposta > CURRENT_TIMESTAMP
  AND status_processamento = 'PROCESSADO';

-- View para estatísticas por UF
CREATE OR REPLACE VIEW "v_estatisticas_pncp_por_uf" AS
SELECT 
    unidade_orgao->>'ufSigla' as uf,
    unidade_orgao->>'ufNome' as uf_nome,
    COUNT(*) as total_licitacoes,
    SUM(valor_total_estimado) as valor_total_estimado,
    COUNT(*) FILTER (WHERE situacao_compra_id = 1) as em_andamento,
    COUNT(*) FILTER (WHERE data_encerramento_proposta > CURRENT_TIMESTAMP) as propostas_abertas
FROM "licitacoes_pncp"
WHERE status_processamento = 'PROCESSADO'
GROUP BY unidade_orgao->>'ufSigla', unidade_orgao->>'ufNome'
ORDER BY total_licitacoes DESC;

-- ============================================================================
-- POLÍTICA DE PARTICIONAMENTO (OPCIONAL - PARA GRANDES VOLUMES)
-- ============================================================================

-- Comentário: Para volumes muito altos, considerar particionamento por data_publicacao_pncp
-- Exemplo de particionamento mensal:

-- CREATE TABLE licitacoes_pncp_y2026m01 PARTITION OF licitacoes_pncp 
-- FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ============================================================================
-- CONSTRAINTS ADICIONAIS DE INTEGRIDADE
-- ============================================================================

-- Constraint para garantir que valor estimado não seja negativo
ALTER TABLE "licitacoes_pncp" 
ADD CONSTRAINT "chk_valor_estimado_positivo" 
CHECK (valor_total_estimado >= 0);

-- Constraint para garantir que ano_compra seja razoável
ALTER TABLE "licitacoes_pncp" 
ADD CONSTRAINT "chk_ano_compra_valido" 
CHECK (ano_compra >= 2021 AND ano_compra <= 2050);

-- Constraint para garantir sequência lógica de datas
ALTER TABLE "licitacoes_pncp" 
ADD CONSTRAINT "chk_datas_propostas_logicas" 
CHECK (data_abertura_proposta IS NULL OR data_encerramento_proposta IS NULL 
       OR data_abertura_proposta <= data_encerramento_proposta);

-- ============================================================================
-- GRANTS DE PERMISSÃO (AJUSTAR CONFORME NECESSÁRIO)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE ON licitacoes_pncp TO app_user;
-- GRANT SELECT ON v_licitacoes_pncp_em_andamento TO readonly_user;

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE 'Tabela licitacoes_pncp criada com sucesso!';
    RAISE NOTICE 'Índices: % criados', (
        SELECT count(*) 
        FROM pg_indexes 
        WHERE tablename = 'licitacoes_pncp'
    );
END $$;