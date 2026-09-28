-- ============================================================================
-- SISTEMA DE QUALIFICAÇÃO RIGOROSA DE EDITAIS TI/TELECOM
-- Função que analisa e qualifica editais baseado em regras de inclusão e exclusão
-- ============================================================================

CREATE OR REPLACE FUNCTION qualificar_edital_ti_telecom(
    p_texto_objeto TEXT,
    p_texto_lotes TEXT DEFAULT NULL,
    p_texto_completo TEXT DEFAULT NULL
) RETURNS TABLE (
    qualificacao VARCHAR(50),
    score_inclusao INTEGER,
    score_exclusao INTEGER,
    score_final INTEGER,
    categorias_encontradas TEXT[],
    termos_inclusao_encontrados TEXT[],
    termos_exclusao_encontrados TEXT[],
    motivo_qualificacao TEXT,
    detalhes JSONB
) AS $$
DECLARE
    v_texto_completo_busca TEXT;
    v_score_inclusao INTEGER := 0;
    v_score_exclusao INTEGER := 0;
    v_score_final INTEGER := 0;
    v_categorias_encontradas TEXT[] := '{}';
    v_termos_inclusao TEXT[] := '{}';
    v_termos_exclusao TEXT[] := '{}';
    v_qualificacao VARCHAR(50);
    v_motivo TEXT;
    v_detalhes JSONB := '{}';
    v_categoria_record RECORD;
    v_palavra_record RECORD;
    v_encontrou_termo BOOLEAN := FALSE;
BEGIN
    -- Preparar texto completo para busca (normalizar e limpar)
    v_texto_completo_busca := COALESCE(p_texto_objeto, '') || ' ' || 
                              COALESCE(p_texto_lotes, '') || ' ' || 
                              COALESCE(p_texto_completo, '');
    
    -- Normalizar texto: remover acentos, converter para minúsculas
    v_texto_completo_busca := LOWER(
        TRANSLATE(
            v_texto_completo_busca,
            'áàâãäéèêëíìîïóòôõöúùûüçñ',
            'aaaaaeeeeiiiiooooobuuuucn'
        )
    );
    
    -- FASE 1: BUSCAR TERMOS DE INCLUSÃO
    FOR v_palavra_record IN 
        SELECT p.palavra_principal, p.sinonimos, p.peso_relevancia, c.codigo as categoria_codigo, c.nome as categoria_nome
        FROM palavras_chave_ti p
        JOIN categorias_filtro_ti c ON c.id = p.categoria_id
        WHERE p.tipo_palavra = 'INCLUSAO' AND p.ativo = true AND c.ativo = true
        ORDER BY p.peso_relevancia DESC
    LOOP
        v_encontrou_termo := FALSE;
        
        -- Verificar palavra principal
        IF v_texto_completo_busca ILIKE '%' || LOWER(v_palavra_record.palavra_principal) || '%' THEN
            v_encontrou_termo := TRUE;
        END IF;
        
        -- Verificar sinônimos
        IF NOT v_encontrou_termo AND v_palavra_record.sinonimos IS NOT NULL THEN
            FOR i IN 1..array_length(v_palavra_record.sinonimos, 1) LOOP
                IF v_texto_completo_busca ILIKE '%' || LOWER(v_palavra_record.sinonimos[i]) || '%' THEN
                    v_encontrou_termo := TRUE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        
        -- Se encontrou termo, adicionar aos resultados
        IF v_encontrou_termo THEN
            v_score_inclusao := v_score_inclusao + v_palavra_record.peso_relevancia;
            v_termos_inclusao := array_append(v_termos_inclusao, v_palavra_record.palavra_principal);
            
            -- Adicionar categoria se ainda não foi adicionada
            IF NOT (v_palavra_record.categoria_codigo = ANY(v_categorias_encontradas)) THEN
                v_categorias_encontradas := array_append(v_categorias_encontradas, v_palavra_record.categoria_codigo);
            END IF;
        END IF;
    END LOOP;
    
    -- FASE 2: BUSCAR TERMOS DE EXCLUSÃO
    FOR v_palavra_record IN 
        SELECT p.palavra_principal, p.sinonimos, ABS(p.peso_relevancia) as peso_relevancia
        FROM palavras_chave_ti p
        JOIN categorias_filtro_ti c ON c.id = p.categoria_id
        WHERE p.tipo_palavra = 'EXCLUSAO' AND p.ativo = true
        ORDER BY ABS(p.peso_relevancia) DESC
    LOOP
        v_encontrou_termo := FALSE;
        
        -- Verificar palavra principal
        IF v_texto_completo_busca ILIKE '%' || LOWER(v_palavra_record.palavra_principal) || '%' THEN
            v_encontrou_termo := TRUE;
        END IF;
        
        -- Verificar sinônimos
        IF NOT v_encontrou_termo AND v_palavra_record.sinonimos IS NOT NULL THEN
            FOR i IN 1..array_length(v_palavra_record.sinonimos, 1) LOOP
                IF v_texto_completo_busca ILIKE '%' || LOWER(v_palavra_record.sinonimos[i]) || '%' THEN
                    v_encontrou_termo := TRUE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        
        -- Se encontrou termo de exclusão, penalizar
        IF v_encontrou_termo THEN
            v_score_exclusao := v_score_exclusao + v_palavra_record.peso_relevancia;
            v_termos_exclusao := array_append(v_termos_exclusao, v_palavra_record.palavra_principal);
        END IF;
    END LOOP;
    
    -- FASE 3: CALCULAR SCORE FINAL E QUALIFICAÇÃO
    v_score_final := v_score_inclusao - v_score_exclusao;
    
    -- REGRAS DE QUALIFICAÇÃO:
    -- 1. Se não encontrou nenhum termo de inclusão: DESCARTADO
    -- 2. Se encontrou termo de exclusão forte (score > 800): DESCARTADO
    -- 3. Se score final >= 500 e sem exclusões críticas: APROVADO
    -- 4. Se score final >= 200 e exclusões menores: REVISÃO MANUAL
    -- 5. Caso contrário: DESCARTADO
    
    IF array_length(v_termos_inclusao, 1) IS NULL THEN
        v_qualificacao := 'DESCARTADO';
        v_motivo := 'Nenhum termo de TI/Telecom encontrado no objeto do edital';
    ELSIF v_score_exclusao > 800 THEN
        v_qualificacao := 'DESCARTADO';
        v_motivo := 'Encontrados termos de exclusão críticos: ' || array_to_string(v_termos_exclusao, ', ');
    ELSIF v_score_final >= 500 AND v_score_exclusao = 0 THEN
        v_qualificacao := 'APROVADO - TI/TELECOM';
        v_motivo := 'Edital qualificado para TI/Telecom - Score: ' || v_score_final::TEXT;
    ELSIF v_score_final >= 200 AND v_score_exclusao <= 400 THEN
        v_qualificacao := 'REVISÃO MANUAL';
        v_motivo := 'Score moderado com possíveis conflitos - Revisar manualmente';
    ELSE
        v_qualificacao := 'DESCARTADO';
        v_motivo := 'Score insuficiente ou muitos termos de exclusão';
    END IF;
    
    -- Preparar detalhes em JSON
    v_detalhes := jsonb_build_object(
        'categorias_detalhadas', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'codigo', c.codigo,
                    'nome', c.nome,
                    'peso', c.peso_categoria
                )
            )
            FROM categorias_filtro_ti c
            WHERE c.codigo = ANY(v_categorias_encontradas)
        ),
        'threshold_aprovacao', 500,
        'threshold_revisao', 200,
        'threshold_exclusao_critica', 800,
        'texto_analisado_length', length(v_texto_completo_busca)
    );
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        v_qualificacao,
        v_score_inclusao,
        v_score_exclusao,
        v_score_final,
        v_categorias_encontradas,
        v_termos_inclusao,
        v_termos_exclusao,
        v_motivo,
        v_detalhes;
        
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO SIMPLIFICADA PARA BUSCA EM LOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION qualificar_editais_lote(
    p_limite INTEGER DEFAULT 100
) RETURNS TABLE (
    edital_id TEXT,
    titulo TEXT,
    objeto TEXT,
    qualificacao VARCHAR(50),
    score_final INTEGER,
    categorias_encontradas TEXT[],
    motivo TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id::TEXT as edital_id,
        COALESCE(e.titulo, e.nome, 'Sem título') as titulo,
        COALESCE(e.objeto, e.descricao, 'Sem objeto') as objeto,
        q.qualificacao,
        q.score_final,
        q.categorias_encontradas,
        q.motivo_qualificacao as motivo
    FROM (
        SELECT id, titulo, nome, objeto, descricao
        FROM licitacoes_pncp 
        WHERE status_processamento = 'PROCESSADO'
        LIMIT p_limite
    ) e
    CROSS JOIN LATERAL qualificar_edital_ti_telecom(
        COALESCE(e.objeto, e.descricao), 
        NULL, 
        NULL
    ) q
    WHERE q.qualificacao IN ('APROVADO - TI/TELECOM', 'REVISÃO MANUAL')
    ORDER BY q.score_final DESC;
END;
$$ LANGUAGE plpgsql;

-- Comentários da função
COMMENT ON FUNCTION qualificar_edital_ti_telecom IS 'Qualifica editais baseado em regras rigorosas de inclusão e exclusão para TI/Telecom';
COMMENT ON FUNCTION qualificar_editais_lote IS 'Qualifica editais em lote, retornando apenas os aprovados ou em revisão manual';