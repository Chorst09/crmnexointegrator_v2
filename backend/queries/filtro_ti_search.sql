-- ============================================================================
-- CONSULTA OTIMIZADA PARA BUSCA COM FILTROS TI
-- Exemplo: Buscar editais que contenham termos relacionados a "Hardware"
-- ============================================================================

-- FUNÇÃO PRINCIPAL DE BUSCA COM FILTROS TI
CREATE OR REPLACE FUNCTION buscar_editais_com_filtros_ti(
    p_categorias_selecionadas TEXT[] DEFAULT '{}', -- ['hardware', 'software']
    p_termo_livre TEXT DEFAULT NULL, -- termo digitado pelo usuário
    p_uf VARCHAR(2) DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL,
    p_valor_min DECIMAL DEFAULT NULL,
    p_valor_max DECIMAL DEFAULT NULL,
    p_limite INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_usuario_id UUID DEFAULT NULL -- para incluir palavras customizadas
) 
RETURNS TABLE(
    id UUID,
    numero_controle_pncp VARCHAR(255),
    objeto_compra TEXT,
    valor_total_estimado DECIMAL(15,4),
    modalidade_nome VARCHAR(255),
    situacao_compra_nome VARCHAR(255),
    orgao_nome TEXT,
    uf_sigla VARCHAR(2),
    data_abertura_proposta TIMESTAMPTZ,
    data_encerramento_proposta TIMESTAMPTZ,
    score_relevancia NUMERIC,
    termos_encontrados TEXT[],
    fonte_dados VARCHAR(50)
) AS $$
DECLARE
    query_palavras_chave TEXT;
    query_final TEXT;
    contador_resultados INTEGER;
BEGIN
    -- Log da busca para analytics
    INSERT INTO historico_buscas_ti (
        usuario_id, 
        filtros_aplicados, 
        termo_livre,
        origem_busca
    ) VALUES (
        p_usuario_id,
        json_build_object(
            'categorias', p_categorias_selecionadas,
            'uf', p_uf,
            'periodo', json_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
            'valor', json_build_object('min', p_valor_min, 'max', p_valor_max)
        ),
        p_termo_livre,
        'api_function'
    );

    -- Construir lista de palavras-chave baseada nas categorias selecionadas
    WITH palavras_filtradas AS (
        SELECT DISTINCT
            mv.palavra,
            mv.sinonimos,
            mv.peso_relevancia,
            mv.categoria_nome
        FROM mv_palavras_chave_consolidadas mv
        WHERE (
            array_length(p_categorias_selecionadas, 1) IS NULL 
            OR mv.categoria_codigo = ANY(p_categorias_selecionadas)
        )
        AND mv.ativo = true
    ),
    todas_palavras AS (
        SELECT 
            palavra as termo,
            peso_relevancia,
            categoria_nome
        FROM palavras_filtradas
        
        UNION ALL
        
        SELECT 
            unnest(sinonimos) as termo,
            peso_relevancia,
            categoria_nome
        FROM palavras_filtradas
        WHERE sinonimos IS NOT NULL
    )
    SELECT string_agg(
        DISTINCT '(' || 
            'normalizar_texto_busca(l.objeto_compra) LIKE ' || 
            quote_literal('%' || lower(termo) || '%') || 
            ' OR ' ||
            'normalizar_texto_busca(l.informacao_complementar) LIKE ' ||
            quote_literal('%' || lower(termo) || '%') ||
        ')',
        ' OR '
    ) INTO query_palavras_chave
    FROM todas_palavras;

    -- Construir query final dinâmica
    query_final := 'SELECT DISTINCT
        l.id,
        l.numero_controle_pncp,
        l.objeto_compra,
        l.valor_total_estimado,
        l.modalidade_nome,
        l.situacao_compra_nome,
        (l.orgao_entidade->>''razaoSocial'') as orgao_nome,
        (l.unidade_orgao->>''ufSigla'') as uf_sigla,
        l.data_abertura_proposta,
        l.data_encerramento_proposta,';

    -- Calcular score de relevância baseado em múltiplos fatores
    query_final := query_final || '
        (CASE
            WHEN l.valor_total_estimado > 1000000 THEN 100
            WHEN l.valor_total_estimado > 500000 THEN 80
            WHEN l.valor_total_estimado > 100000 THEN 60
            ELSE 40
        END +
        CASE
            WHEN l.data_encerramento_proposta > CURRENT_TIMESTAMP THEN 50
            ELSE 0
        END +
        CASE
            WHEN l.modalidade_nome ILIKE ''%pregão%'' THEN 30
            ELSE 20
        END) as score_relevancia,';

    -- Array dos termos encontrados (para debugging/highlight)
    query_final := query_final || '
        ARRAY[]::TEXT[] as termos_encontrados,
        l.origem_dados as fonte_dados
    FROM licitacoes_pncp l
    WHERE l.status_processamento = ''PROCESSADO''';

    -- Aplicar filtros de palavras-chave se existir
    IF query_palavras_chave IS NOT NULL THEN
        query_final := query_final || ' AND (' || query_palavras_chave || ')';
    END IF;

    -- Aplicar termo livre se fornecido
    IF p_termo_livre IS NOT NULL AND length(trim(p_termo_livre)) > 2 THEN
        query_final := query_final || ' AND (
            normalizar_texto_busca(l.objeto_compra) LIKE ' || 
            quote_literal('%' || lower(trim(p_termo_livre)) || '%') || 
            ' OR normalizar_texto_busca(l.informacao_complementar) LIKE ' ||
            quote_literal('%' || lower(trim(p_termo_livre)) || '%') ||
            ' OR to_tsvector(''portuguese'', l.objeto_compra) @@ plainto_tsquery(''portuguese'', ' ||
            quote_literal(trim(p_termo_livre)) || ')
        )';
    END IF;

    -- Filtros adicionais
    IF p_uf IS NOT NULL THEN
        query_final := query_final || ' AND (l.unidade_orgao->>''ufSigla'') = ' || quote_literal(p_uf);
    END IF;

    IF p_data_inicio IS NOT NULL THEN
        query_final := query_final || ' AND l.data_publicacao_pncp >= ' || quote_literal(p_data_inicio);
    END IF;

    IF p_data_fim IS NOT NULL THEN
        query_final := query_final || ' AND l.data_publicacao_pncp <= ' || quote_literal(p_data_fim);
    END IF;

    IF p_valor_min IS NOT NULL THEN
        query_final := query_final || ' AND l.valor_total_estimado >= ' || p_valor_min;
    END IF;

    IF p_valor_max IS NOT NULL THEN
        query_final := query_final || ' AND l.valor_total_estimado <= ' || p_valor_max;
    END IF;

    -- Ordenação por relevância e data
    query_final := query_final || '
    ORDER BY score_relevancia DESC, l.data_publicacao_pncp DESC
    LIMIT ' || p_limite || ' OFFSET ' || p_offset;

    -- Executar query dinâmica
    RETURN QUERY EXECUTE query_final;

    -- Atualizar contador de resultados no histórico
    GET DIAGNOSTICS contador_resultados = ROW_COUNT;
    
    UPDATE historico_buscas_ti 
    SET resultados_encontrados = contador_resultados
    WHERE id = (SELECT id FROM historico_buscas_ti ORDER BY created_at DESC LIMIT 1);

EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro
        INSERT INTO historico_buscas_ti (
            usuario_id, 
            filtros_aplicados, 
            termo_livre,
            origem_busca,
            resultados_encontrados
        ) VALUES (
            p_usuario_id,
            json_build_object('erro', SQLERRM),
            p_termo_livre,
            'api_function_error',
            -1
        );
        
        RAISE EXCEPTION 'Erro na busca: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;