-- ============================================================================
-- SCRIPT DE BACKUP ANTES DE IMPLEMENTAR FILTROS TI
-- Execute ANTES de aplicar as mudanças no sistema de produção
-- Data: 2026-09-04
-- ============================================================================

-- Backup completo das estruturas relacionadas a licitações
CREATE SCHEMA IF NOT EXISTS backup_filtros_ti_20260904;

-- 1. BACKUP DA TABELA PRINCIPAL
CREATE TABLE backup_filtros_ti_20260904.licitacoes_pncp_backup AS 
SELECT * FROM licitacoes_pncp;

-- 2. BACKUP DAS SEQUÊNCIAS E ÍNDICES (para restauração completa)
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
INTO backup_filtros_ti_20260904.indices_backup
FROM pg_indexes 
WHERE tablename = 'licitacoes_pncp';

-- 3. BACKUP DAS FUNÇÕES EXISTENTES
SELECT 
    proname as function_name,
    prosrc as function_code,
    proargnames as arg_names
INTO backup_filtros_ti_20260904.functions_backup
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND prosrc LIKE '%licitac%';

-- 4. SCRIPT PARA VERIFICAÇÃO DE INTEGRIDADE
CREATE OR REPLACE FUNCTION backup_filtros_ti_20260904.verificar_integridade()
RETURNS TABLE(
    tabela TEXT,
    total_backup BIGINT,
    total_atual BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'licitacoes_pncp'::TEXT,
        (SELECT count(*) FROM backup_filtros_ti_20260904.licitacoes_pncp_backup),
        (SELECT count(*) FROM public.licitacoes_pncp),
        CASE 
            WHEN (SELECT count(*) FROM backup_filtros_ti_20260904.licitacoes_pncp_backup) = 
                 (SELECT count(*) FROM public.licitacoes_pncp) 
            THEN 'ÍNTEGRO'::TEXT
            ELSE 'DIVERGENTE'::TEXT
        END;
END;
$$ LANGUAGE plpgsql;

-- 5. SCRIPT DE ROLLBACK (SE NECESSÁRIO)
CREATE OR REPLACE FUNCTION backup_filtros_ti_20260904.rollback_sistema_filtros()
RETURNS TEXT AS $$
BEGIN
    -- CUIDADO: Este script remove as novas tabelas e restaura o estado anterior
    -- Execute apenas se houver problemas graves no sistema
    
    DROP MATERIALIZED VIEW IF EXISTS mv_palavras_chave_consolidadas;
    DROP TABLE IF EXISTS historico_buscas_ti;
    DROP TABLE IF EXISTS palavras_chave_customizadas;
    DROP TABLE IF EXISTS palavras_chave_ti;
    DROP TABLE IF EXISTS categorias_filtro_ti;
    
    DROP FUNCTION IF EXISTS buscar_editais_com_filtros_ti;
    DROP FUNCTION IF EXISTS refresh_palavras_chave_consolidadas;
    DROP FUNCTION IF EXISTS normalizar_texto_busca;
    DROP FUNCTION IF EXISTS buscar_com_stemming;
    DROP FUNCTION IF EXISTS update_filtros_ti_updated_at;
    
    RETURN 'Sistema de filtros TI removido. Estado anterior restaurado.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LOGS DE BACKUP
-- ============================================================================

INSERT INTO backup_filtros_ti_20260904.licitacoes_pncp_backup 
SELECT * FROM licitacoes_pncp LIMIT 0; -- Estrutura apenas para teste

-- Registrar backup
CREATE TABLE backup_filtros_ti_20260904.log_backup (
    id SERIAL PRIMARY KEY,
    evento TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    detalhes JSONB
);

INSERT INTO backup_filtros_ti_20260904.log_backup (evento, detalhes) VALUES 
(
    'BACKUP_CRIADO',
    json_build_object(
        'total_licitacoes', (SELECT count(*) FROM licitacoes_pncp),
        'data_backup', CURRENT_TIMESTAMP,
        'versao_sistema', '1.0.0'
    )
);

-- ============================================================================
-- INSTRUÇÕES DE USO
-- ============================================================================

/*
INSTRUÇÕES PARA USO SEGURO:

1. ANTES DE APLICAR AS MUDANÇAS:
   Execute este script: psql -d sua_base -f backup_before_filtros_ti.sql

2. VERIFICAR INTEGRIDADE APÓS BACKUP:
   SELECT * FROM backup_filtros_ti_20260904.verificar_integridade();

3. APLICAR AS NOVAS ESTRUTURAS:
   psql -d sua_base -f create_filtros_ti_system.sql
   psql -d sua_base -f seed_filtros_ti_data.sql

4. EM CASO DE PROBLEMAS (ÚLTIMO RECURSO):
   SELECT backup_filtros_ti_20260904.rollback_sistema_filtros();

5. LIMPAR BACKUPS APÓS CONFIRMAÇÃO (OPCIONAL):
   DROP SCHEMA backup_filtros_ti_20260904 CASCADE;

MONITORAMENTO:
- Verifique se as queries existentes continuam funcionando
- Monitore performance das buscas
- Observe logs de erro da aplicação
- Teste funcionalidades críticas do portal

CONTATO DE EMERGÊNCIA:
- Em caso de problemas críticos, execute imediatamente o rollback
- Documente qualquer comportamento anômalo
- Mantenha este backup por pelo menos 30 dias
*/

SELECT 'BACKUP CRIADO COM SUCESSO - Sistema pronto para receber as melhorias de filtros TI' as status;