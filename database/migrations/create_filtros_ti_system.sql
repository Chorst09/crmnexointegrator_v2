-- ============================================================================
-- Sistema Avançado de Filtros TI - Extensão do Portal de Busca
-- Data: 2026-09-04
-- Autor: Engenheiro de Dados Sênior
-- Descrição: Sistema de filtros inteligentes com sinônimos e variações
-- ============================================================================

-- Tabela de Categorias de TI (Hardware, Software, Serviços, etc.)
CREATE TABLE IF NOT EXISTS "categorias_filtro_ti" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) UNIQUE NOT NULL, -- hardware, software, servicos, etc.
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "cor_categoria" VARCHAR(7) DEFAULT '#3b82f6', -- cor hex para UI
    "icone" VARCHAR(50), -- nome do ícone Lucide React
    "ordem_exibicao" INTEGER DEFAULT 0,
    "ativo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Palavras-chave associadas às categorias
CREATE TABLE IF NOT EXISTS "palavras_chave_ti" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "categoria_id" UUID NOT NULL REFERENCES "categorias_filtro_ti"("id") ON DELETE CASCADE,
    "palavra_principal" VARCHAR(100) NOT NULL, -- palavra principal
    "sinonimos" TEXT[], -- array de sinônimos e variações
    "peso_relevancia" INTEGER DEFAULT 100, -- 1-1000, maior = mais relevante
    "case_sensitive" BOOLEAN DEFAULT false,
    "busca_exata" BOOLEAN DEFAULT false, -- true = palavra exata, false = contém
    "stemming_habilitado" BOOLEAN DEFAULT true,
    "ativo" BOOLEAN DEFAULT true,
    "metadata_busca" JSONB DEFAULT '{}', -- configurações avançadas de busca
    "estatisticas_uso" JSONB DEFAULT '{"hits": 0, "ultimo_uso": null}', -- tracking de uso
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para palavras-chave customizadas dos usuários (campo aberto)
CREATE TABLE IF NOT EXISTS "palavras_chave_customizadas" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "usuario_id" UUID, -- referência ao usuário (opcional - pode ser global)
    "empresa_id" UUID, -- referência à empresa (se aplicável)
    "categoria_id" UUID REFERENCES "categorias_filtro_ti"("id") ON DELETE SET NULL,
    "palavra_customizada" VARCHAR(200) NOT NULL,
    "sinonimos_customizados" TEXT[], -- sinônimos definidos pelo usuário
    "descricao" TEXT,
    "uso_publico" BOOLEAN DEFAULT false, -- permite outros usuários verem
    "contador_uso" INTEGER DEFAULT 0,
    "aprovada" BOOLEAN DEFAULT true, -- moderação se necessário
    "tags" TEXT[], -- tags para organização
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de buscas para analytics e otimização
CREATE TABLE IF NOT EXISTS "historico_buscas_ti" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "filtros_aplicados" JSONB NOT NULL, -- categorias e palavras usadas
    "termo_livre" TEXT, -- termo digitado pelo usuário
    "resultados_encontrados" INTEGER DEFAULT 0,
    "tempo_execucao_ms" INTEGER,
    "origem_busca" VARCHAR(50) DEFAULT 'portal_web', -- portal_web, api, mobile
    "ip_origem" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ÍNDICES OTIMIZADOS PARA PERFORMANCE
-- ============================================================================

-- Índices para categorias
CREATE INDEX IF NOT EXISTS "idx_categorias_filtro_ti_codigo" 
ON "categorias_filtro_ti" ("codigo");

CREATE INDEX IF NOT EXISTS "idx_categorias_filtro_ti_ativo_ordem" 
ON "categorias_filtro_ti" ("ativo", "ordem_exibicao");

-- Índices para palavras-chave
CREATE INDEX IF NOT EXISTS "idx_palavras_chave_ti_categoria" 
ON "palavras_chave_ti" ("categoria_id") WHERE "ativo" = true;

CREATE INDEX IF NOT EXISTS "idx_palavras_chave_ti_principal" 
ON "palavras_chave_ti" ("palavra_principal") WHERE "ativo" = true;

-- Índice GIN para busca em array de sinônimos
CREATE INDEX IF NOT EXISTS "idx_palavras_chave_ti_sinonimos_gin" 
ON "palavras_chave_ti" USING gin ("sinonimos");

-- Índice composto para performance de busca
CREATE INDEX IF NOT EXISTS "idx_palavras_chave_ti_busca_otimizada" 
ON "palavras_chave_ti" ("categoria_id", "peso_relevancia" DESC, "ativo") 
WHERE "ativo" = true;

-- Índices para palavras customizadas
CREATE INDEX IF NOT EXISTS "idx_palavras_customizadas_usuario" 
ON "palavras_chave_customizadas" ("usuario_id", "aprovada");

CREATE INDEX IF NOT EXISTS "idx_palavras_customizadas_empresa" 
ON "palavras_chave_customizadas" ("empresa_id", "uso_publico", "aprovada");

CREATE INDEX IF NOT EXISTS "idx_palavras_customizadas_categoria" 
ON "palavras_chave_customizadas" ("categoria_id");

-- Índice para busca full-text em palavras customizadas
CREATE INDEX IF NOT EXISTS "idx_palavras_customizadas_busca_texto" 
ON "palavras_chave_customizadas" 
USING gin (to_tsvector('portuguese', "palavra_customizada" || ' ' || COALESCE(array_to_string("sinonimos_customizados", ' '), '')));

-- Índices para histórico (analytics)
CREATE INDEX IF NOT EXISTS "idx_historico_buscas_ti_usuario_data" 
ON "historico_buscas_ti" ("usuario_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_historico_buscas_ti_data" 
ON "historico_buscas_ti" ("created_at" DESC);

-- ============================================================================
-- FUNCTIONS PARA BUSCA TEXTUAL OTIMIZADA COM STEMMING
-- ============================================================================

-- Function para normalizar texto removendo acentos e caracteres especiais
CREATE OR REPLACE FUNCTION normalizar_texto_busca(texto TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        translate(
            unaccent(texto),
            'áàâãäéèêëíìîïóòôõöúùûüçñ',
            'aaaaaeeeeiiiiooooouuuucn'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function para busca inteligente com stemming português
CREATE OR REPLACE FUNCTION buscar_com_stemming(
    texto_busca TEXT,
    campo_destino TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Busca exata normalizada
    IF normalizar_texto_busca(campo_destino) LIKE '%' || normalizar_texto_busca(texto_busca) || '%' THEN
        RETURN TRUE;
    END IF;
    
    -- Busca com stemming usando configuração portuguesa
    IF to_tsvector('portuguese', campo_destino) @@ plainto_tsquery('portuguese', texto_busca) THEN
        RETURN TRUE;
    END IF;
    
    -- Busca por palavras similares (soundex-like)
    IF similarity(normalizar_texto_busca(campo_destino), normalizar_texto_busca(texto_busca)) > 0.3 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGERS PARA MANUTENÇÃO AUTOMÁTICA
-- ============================================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_filtros_ti_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas principais
CREATE TRIGGER trigger_categorias_filtro_ti_updated_at
    BEFORE UPDATE ON "categorias_filtro_ti"
    FOR EACH ROW
    EXECUTE FUNCTION update_filtros_ti_updated_at();

CREATE TRIGGER trigger_palavras_chave_ti_updated_at
    BEFORE UPDATE ON "palavras_chave_ti"
    FOR EACH ROW
    EXECUTE FUNCTION update_filtros_ti_updated_at();

CREATE TRIGGER trigger_palavras_customizadas_updated_at
    BEFORE UPDATE ON "palavras_chave_customizadas"
    FOR EACH ROW
    EXECUTE FUNCTION update_filtros_ti_updated_at();

-- ============================================================================
-- VIEWS MATERIALIZADAS PARA PERFORMANCE EM BUSCAS FREQUENTES
-- ============================================================================

-- View materializada com todas as palavras-chave (sistema + customizadas)
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_palavras_chave_consolidadas" AS
SELECT 
    'sistema'::text as origem,
    p.id,
    p.categoria_id,
    c.codigo as categoria_codigo,
    c.nome as categoria_nome,
    c.cor_categoria,
    c.icone,
    p.palavra_principal as palavra,
    p.sinonimos,
    p.peso_relevancia,
    p.ativo,
    p.created_at
FROM "palavras_chave_ti" p
JOIN "categorias_filtro_ti" c ON c.id = p.categoria_id
WHERE p.ativo = true AND c.ativo = true

UNION ALL

SELECT 
    'customizada'::text as origem,
    pc.id,
    pc.categoria_id,
    COALESCE(c.codigo, 'personalizada'::varchar) as categoria_codigo,
    COALESCE(c.nome, 'Personalizada'::varchar) as categoria_nome,
    COALESCE(c.cor_categoria, '#6b7280'::varchar) as cor_categoria,
    COALESCE(c.icone, 'tag'::varchar) as icone,
    pc.palavra_customizada as palavra,
    pc.sinonimos_customizados as sinonimos,
    50 as peso_relevancia, -- peso médio para customizadas
    true as ativo,
    pc.created_at
FROM "palavras_chave_customizadas" pc
LEFT JOIN "categorias_filtro_ti" c ON c.id = pc.categoria_id
WHERE pc.aprovada = true;

-- Índices na view materializada
CREATE UNIQUE INDEX IF NOT EXISTS "idx_mv_palavras_consolidadas_unique" 
ON "mv_palavras_chave_consolidadas" ("origem", "id");

CREATE INDEX IF NOT EXISTS "idx_mv_palavras_consolidadas_categoria" 
ON "mv_palavras_chave_consolidadas" ("categoria_codigo", "peso_relevancia" DESC);

CREATE INDEX IF NOT EXISTS "idx_mv_palavras_consolidadas_palavra" 
ON "mv_palavras_chave_consolidadas" ("palavra");

CREATE INDEX IF NOT EXISTS "idx_mv_palavras_consolidadas_sinonimos_gin" 
ON "mv_palavras_chave_consolidadas" USING gin ("sinonimos");

-- ============================================================================
-- FUNCTION PARA REFRESH DA VIEW MATERIALIZADA
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_palavras_chave_consolidadas()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_palavras_chave_consolidadas";
    
    -- Log da atualização
    INSERT INTO "historico_buscas_ti" (
        filtros_aplicados, 
        termo_livre, 
        resultados_encontrados,
        origem_busca
    ) VALUES (
        '{"refresh_view": true}'::jsonb,
        'system_refresh_mv',
        (SELECT count(*) FROM "mv_palavras_chave_consolidadas"),
        'system'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE "categorias_filtro_ti" IS 'Categorias principais de filtros TI (Hardware, Software, Serviços)';
COMMENT ON TABLE "palavras_chave_ti" IS 'Palavras-chave do sistema com sinônimos e configurações de busca';
COMMENT ON TABLE "palavras_chave_customizadas" IS 'Palavras-chave customizadas pelos usuários (campo aberto)';
COMMENT ON TABLE "historico_buscas_ti" IS 'Histórico de buscas para analytics e otimização do sistema';
COMMENT ON MATERIALIZED VIEW "mv_palavras_chave_consolidadas" IS 'View consolidada com todas as palavras-chave (sistema + customizadas)';

COMMENT ON COLUMN "palavras_chave_ti"."sinonimos" IS 'Array de sinônimos: ["computador", "pc", "desktop", "microcomputador"]';
COMMENT ON COLUMN "palavras_chave_ti"."peso_relevancia" IS 'Peso 1-1000, maior peso = maior relevância nos resultados';
COMMENT ON COLUMN "palavras_chave_ti"."metadata_busca" IS 'JSON com configurações: {"regex_personalizado": "\\b(server|servidor)s?\\b"}';
COMMENT ON COLUMN "historico_buscas_ti"."filtros_aplicados" IS 'JSON com filtros aplicados: {"categorias": ["hardware"], "termos": ["notebook"]}';

-- ============================================================================
-- GRANTS E PERMISSÕES (AJUSTAR CONFORME USUÁRIOS DO SISTEMA)
-- ============================================================================

-- Conceder permissões para o usuário da aplicação
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- ============================================================================
-- SCRIPT CONCLUÍDO - PRONTO PARA PRODUÇÃO
-- ============================================================================