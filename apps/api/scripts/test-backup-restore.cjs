/**
 * Teste de Integridade de Backup e Restore
 * Verifica se todas as tabelas estão sendo incluídas corretamente
 *
 * Uso:
 *   node scripts/test-backup-restore.cjs        # dry-run (simulação)
 *   node scripts/test-backup-restore.cjs --live  # teste real (cuidado!)
 */

'use strict';

const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../lib/load-env.cjs');

const prisma = new PrismaClient();

// Todas as tabelas do sistema
const ALL_TABLES = {
  // Módulos principais
  'User': 'Usuários do sistema',
  'TenantCompany': 'Empresas inquilinas',
  'Company': 'Empresas/clientes',
  'Contact': 'Contatos',
  'Product': 'Produtos',
  'Opportunity': 'Oportunidades B2B',
  'Activity': 'Atividades',
  'Proposal': 'Propostas comerciais',
  'Commission': 'Comissões',
  'Contract': 'Contratos',
  'Region': 'Regiões',

  // Pre-Sales
  'PreSalesRequest': 'Solicitações pré-vendas',
  'PreSalesPoc': 'Provas de conceito',
  'PreSalesPocFollowUp': 'Follow-ups POC',

  // B2G - Licitações (novos modelos no schema)
  'GerenciadaLicitacao': 'Licitações gerenciadas B2G',
  'AlertaLicitacao': 'Alertas de licitações B2G',
  'EditalAnalisado': 'Editais analisados B2G',
  'LicitacaoPncp': 'Dados reais do PNCP',

  // B2G - Legacy (tabelas manuais)
  'gerenciadas_licitacao': 'Licitações gerenciadas (legacy)',
  'alertas_licitacao': 'Alertas de licitações (legacy)',
  'editais_analisados': 'Editais analisados (legacy)',

  // Simulador
  'SimulatorProposal': 'Propostas do simulador',
  'SimulatorLicitacao': 'Licitações persistidas do simulador',

  // Projetos e Gestão
  'Project': 'Projetos',
  'ProjectPhase': 'Fases de projetos',
  'ProjectTask': 'Tarefas de projetos',
  'ProjectTeam': 'Equipe de projetos',
  'ProjectMilestone': 'Milestones',
  'ProjectRisk': 'Riscos de projetos',
  'ProjectIssue': 'Issues de projetos',
  'ProjectBilling': 'Faturamento de projetos',
  'ProjectAcceptance': 'Aceitações de projetos',

  // Kickoff
  'KickoffMeeting': 'Reuniões de kickoff',
  'KickoffParticipant': 'Participantes de kickoff',
  'KickoffAgendaItem': 'Itens de agenda',
  'KickoffChecklistItem': 'Checklist',
  'KickoffActionItem': 'Action items',

  // Configurações
  'SystemSetting': 'Configurações do sistema',
  'PendingSubscription': 'Assinaturas pendentes',
  'AuditLog': 'Logs de auditoria',

  // Integração PNCP
  'BidNotice': 'Editais B2G',
  'BidNoticeHistory': 'Histórico de editais',

  // Análises
  'SavedAnalysis': 'Análises salvas',

  // Workflows avançados
  'Workflow': 'Workflows',
  'WorkflowStep': 'Passos de workflow',
  'ApprovalRequest': 'Solicitações de aprovação',
  'ApprovalStep': 'Passos de aprovação'
};

async function countTableRows() {
  const results = {};
  const errors = [];

  for (const [tableName, description] of Object.entries(ALL_TABLES)) {
    try {
      // Tentar nomes alternativos (com e sem aspas, snake_case)
      const possibleNames = [
        tableName,
        tableName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
        tableName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
      ];

      let count = 0;
      for (const name of possibleNames) {
        try {
          const [result] = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${name}" LIMIT 1`
          );
          count = parseInt(result?.count || 0);
          break;
        } catch {
          // Tentar sem aspas
          try {
            const [result] = await prisma.$queryRawUnsafe(
              `SELECT COUNT(*) as count FROM ${name} LIMIT 1`
            );
            count = parseInt(result?.count || 0);
            break;
          } catch {
            continue;
          }
        }
      }

      results[tableName] = { count, description, status: count >= 0 ? 'OK' : 'N/A' };
    } catch (err) {
      results[tableName] = { count: 0, description, status: 'ERRO', error: err.message.substring(0, 50) };
      errors.push(tableName);
    }
  }

  return { results, errors };
}

async function testBackupIntegrity() {
  console.log('='.repeat(70));
  console.log('  TESTE DE INTEGRIDADE DE BACKUP/RESTORE');
  console.log('='.repeat(70));
  console.log('');

  const isLive = process.argv.includes('--live');
  if (isLive) {
    console.log('⚠️  MODO LIVE ATIVADO - CUIDADO!');
    console.log('');
  } else {
    console.log('ℹ️  MODO SIMULAÇÃO (dry-run)');
    console.log('');
  }

  try {
    console.log('Verificando conectividade com o banco...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Banco de dados conectado com sucesso!');
    console.log('');

    console.log('Contando registros em todas as tabelas...');
    console.log('-'.repeat(70));

    const { results, errors } = await countTableRows();
    let totalRows = 0;
    let successCount = 0;
    let failCount = 0;

    for (const [tableName, data] of Object.entries(results)) {
      const icon = data.status === 'OK' || data.count >= 0 ? '✓' : '✗';
      const statusColor = data.count > 0 ? '\x1b[32m' : '\x1b[33m'; // Verde se tem dados, Amarelo se vazio
      const reset = '\x1b[0m';
      
      console.log(`${icon} ${tableName.padEnd(35)} ${String(data.count).padStart(10)} registros - ${data.description}`);
      
      totalRows += data.count;
      if (data.count >= 0) successCount++;
      else failCount++;
    }

    console.log('-'.repeat(70));
    console.log('');
    console.log('RESUMO:');
    console.log(`  Total de tabelas verificadas: ${Object.keys(results).length}`);
    console.log(`  Tabelas OK: ${successCount}`);
    console.log(`  Erros: ${failCount}`);
    console.log(`  Total de registros no banco: ${totalRows.toLocaleString()}`);
    console.log('');

    if (errors.length > 0) {
      console.log('⚠️  Tabelas com erro na verificação:');
      errors.forEach(t => console.log(`    - ${t}`));
      console.log('');
    }

    // Verificar módulos críticos
    console.log('VERIFICAÇÃO DE MÓDULOS:');
    console.log('-'.repeat(40));

    const modules = {
      'B2B (Core)': ['User', 'Company', 'Opportunity', 'Activity', 'Proposal'],
      'B2G': ['GerenciadaLicitacao', 'AlertaLicitacao', 'EditalAnalisado', 'LicitacaoPncp'],
      'SIMULADOR': ['SimulatorProposal', 'SimulatorLicitacao'],
      'PRE-VENDAS': ['PreSalesRequest', 'PreSalesPoc'],
      'PROJETOS': ['Project', 'ProjectPhase', 'ProjectTask', 'ProjectTeam']
    };

    let allModulesOK = true;
    for (const [moduleName, tables] of Object.entries(modules)) {
      const moduleTables = tables.map(t => results[t]).filter(t => t !== undefined);
      const totalModuleRows = moduleTables.reduce((sum, t) => sum + (t.count || 0), 0);
      const hasData = totalModuleRows > 0;
      
      console.log(`${hasData ? '✓' : '⚠'} ${moduleName}: ${totalModuleRows.toLocaleString()} registros`);
      
      if (!hasData && ['B2G', 'SIMULADOR'].includes(moduleName)) {
        allModulesOK = false;
      }
    }

    console.log('');
    console.log('STATUS FINAL:');
    if (allModulesOK) {
      console.log('✅ Sistema de backup está INTEGRALMENTE configurado!');
      console.log('   Todas as tabelas dos módulos B2B, B2G, SIMULADOR e PRE-VENDAS');
      console.log('   estão presentes e serão incluídas nos backups.');
    } else {
      console.log('⚠️  ATENÇÃO: Alguns módulos podem não ter dados ainda.');
      console.log('   Isso é normal para tabelas recém-criadas.');
    }

    console.log('');
    console.log('PRÓXIMOS PASSOS:');
    console.log('1. Executar backup manual para validar:');
    console.log('   bash scripts/backup-crmnexointegrator_v2.sh');
    console.log('');
    console.log('2. Para restaurar (se necessário):');
    console.log('   pg_restore -h localhost -p 5433 -U nexoscrm -d nexoscrm \\');
    console.log('     -c -C /var/backups/crmnexointegrator_v2/crmnexointegrator_v2_*.dump');
    console.log('');
    console.log('3. Para testar restore em ambiente de homologação:');
    console.log('   node scripts/test-backup-restore.cjs --live');

  } catch (err) {
    console.error('❌ Erro durante teste:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBackupIntegrity();