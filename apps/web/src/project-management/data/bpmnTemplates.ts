export type BpmnNodeType = 'start' | 'end' | 'task' | 'subprocess' | 'gateway';

export type BpmnAnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface BpmnLane {
  id: string;
  label: string;
  height?: number;
}

export interface BpmnNode {
  id: string;
  type: BpmnNodeType;
  label: string;
  laneId: string;
  col: number;
  /** Deslocamento vertical dentro da raia (-1 = topo, 0 = centro, 1 = base) */
  rowOffset?: number;
  owner?: string;
  sla?: string;
  status?: string;
  controls?: string[];
  /** Código de BPMN relacionado quando subprocesso (+) */
  linkedCode?: string;
}

export interface BpmnEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  fromSide?: BpmnAnchorSide;
  toSide?: BpmnAnchorSide;
  /** Caminho preferencial para retornos ou desvios */
  route?: 'auto' | 'top-loop' | 'bottom-loop' | 'step-v-h' | 'step-h-v';
  /** Deslocamento vertical extra (px) para rotas top-loop / bottom-loop */
  loopOffset?: number;
}

export interface BpmnDiagram {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  companyName?: string;
  responsibleName?: string;
  companyLogo?: string;
  pageLabel: string;
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  controlsTitle?: string;
  controlsText: string;
  sourceBase?: string;
  footerText?: string;
}

export const BPMN_GOVERNANCE = {
  title: 'Governança, automações e validação',
  subtitle: 'Controles obrigatórios, automações recomendadas, indicadores e decisões de modelagem',
  sections: [
    {
      title: 'Controles obrigatórios',
      items: [
        'Aceite formal antes de GANHO',
        'Proposta final e aprovações de alçada',
        'Escopo, valores, contatos, riscos e dependências',
        'Ata do kickoff interno, responsável operacional e plano de ação',
        'Kickoff externo liberado somente após validação interna'
      ]
    },
    {
      title: 'Automações recomendadas',
      items: [
        'Alerta GANHO e atividade automática de agendamento',
        'Alerta de GANHO sem kickoff registrado',
        'Checklist estruturado de handoff',
        'Atividade de kickoff externo após validação interna',
        'Dashboard de riscos e atrasos + histórico de escopo e aprovações'
      ]
    },
    {
      title: 'Indicadores (KPIs)',
      items: [
        'Conversão de leads e taxa de ganho',
        'Ciclo de vendas e oportunidades sem próxima ação',
        'Precisão do forecast e margem',
        'SLA GANHO → kickoff interno e kickoff interno → externo',
        'Retrabalho de escopo, cumprimento do cronograma e aceite na primeira entrega'
      ]
    },
    {
      title: 'Decisões de modelagem para aprovação',
      items: [
        'Retornos de revisão, replanejamento e reteste explicitados como fluxos de sequência',
        'Cliente e financeiro atuam como participantes consultados nas atividades, sem pool externo próprio',
        'O manual prevalece quanto ao prazo preferencial de agendamento e papéis na RACI',
        'Modelo descritivo para governança operacional e auditoria no CRM'
      ]
    }
  ],
  sources: 'Manual de Processos Comerciais CRM, versão 1.0, pp. 2–7; Diagramas BPMN 00–07.'
};

export const BPMN_TEMPLATES: BpmnDiagram[] = [
  {
    id: 'bpmn-00',
    code: 'BPMN-00',
    title: 'Macroprocesso comercial',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '01 / 08',
    lanes: [
      { id: 'comercial', label: 'Comercial', height: 156 },
      { id: 'gerente', label: 'Gerente da conta', height: 112 },
      { id: 'implantacao', label: 'Implantação / Projetos', height: 112 },
      { id: 'operacao', label: 'Operação / Suporte', height: 112 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Lead recebido', laneId: 'comercial', col: 0 },
      { id: 'n1', type: 'subprocess', label: '01 Cadastro e qualificação', laneId: 'comercial', col: 1, linkedCode: 'BPMN-01', owner: 'Comercial', sla: '1 dia', status: 'Ativo' },
      { id: 'g1', type: 'gateway', label: 'Qualificado?', laneId: 'comercial', col: 2 },
      { id: 'end_lead', type: 'end', label: 'Lead encerrado', laneId: 'comercial', col: 3, rowOffset: -0.65 },
      { id: 'n2', type: 'subprocess', label: '02 Solução e proposta', laneId: 'comercial', col: 3, rowOffset: 0.55, linkedCode: 'BPMN-02', owner: 'Comercial / Pré-vendas', sla: '3 dias', status: 'Ativo' },
      { id: 'n3', type: 'subprocess', label: '03 Negociação e fechamento', laneId: 'comercial', col: 4, linkedCode: 'BPMN-03', owner: 'Comercial', sla: '5 dias', status: 'Ativo' },
      { id: 'g2', type: 'gateway', label: 'GANHO?', laneId: 'comercial', col: 5 },
      { id: 'end_lost', type: 'end', label: 'Venda não concluída', laneId: 'comercial', col: 6 },
      { id: 'n4', type: 'subprocess', label: '04 Kickoff interno', laneId: 'gerente', col: 6, linkedCode: 'BPMN-04', owner: 'Gerente da conta', sla: '1 dia útil', status: 'Ativo' },
      { id: 'n5', type: 'subprocess', label: '05 Kickoff externo e implantação', laneId: 'implantacao', col: 7, linkedCode: 'BPMN-05', owner: 'Implantação / Projetos', sla: '15 dias', status: 'Ativo' },
      { id: 'n6', type: 'subprocess', label: '06 Aceite e transição', laneId: 'operacao', col: 8, linkedCode: 'BPMN-06', owner: 'Operação / Suporte', sla: '2 dias', status: 'Ativo' },
      { id: 'end_ok', type: 'end', label: 'Concluído', laneId: 'operacao', col: 9 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'g1' },
      { id: 'e3', from: 'g1', to: 'end_lead', label: 'Não', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e4', from: 'g1', to: 'n2', label: 'Sim', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e5', from: 'n2', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e6', from: 'n3', to: 'g2' },
      { id: 'e7', from: 'g2', to: 'end_lost', label: 'Não' },
      { id: 'e8', from: 'g2', to: 'n4', label: 'Sim', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e9', from: 'n4', to: 'n5', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e10', from: 'n5', to: 'n6', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e11', from: 'n6', to: 'end_ok' }
    ],
    controlsText: 'O CRM é a fonte oficial. Toda etapa ativa tem responsável, status e próxima ação com prazo.',
    sourceBase: 'Base: Manual §§ 1–2, 14; diagrama original pp. 2–3',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-01',
    code: 'BPMN-01',
    title: 'Cadastro e qualificação de leads',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '02 / 08',
    lanes: [
      { id: 'vendedor', label: 'Vendedor', height: 175 },
      { id: 'gerente', label: 'Gerente da conta', height: 120 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Lead recebido', laneId: 'vendedor', col: 0 },
      { id: 'n1', type: 'task', label: 'Consultar duplicidade', laneId: 'vendedor', col: 1 },
      { id: 'g1', type: 'gateway', label: 'Já existe?', laneId: 'vendedor', col: 2 },
      { id: 'n2a', type: 'task', label: 'Atualizar cadastro', laneId: 'vendedor', col: 3, rowOffset: -0.58 },
      { id: 'n2b', type: 'task', label: 'Cadastrar novo lead', laneId: 'vendedor', col: 3, rowOffset: 0.58 },
      { id: 'n3', type: 'task', label: 'Definir responsável e próxima ação', laneId: 'vendedor', col: 4 },
      { id: 'n4', type: 'task', label: 'Qualificar necessidade e potencial', laneId: 'vendedor', col: 5 },
      { id: 'g2', type: 'gateway', label: 'Qualificado?', laneId: 'vendedor', col: 6 },
      { id: 'n5', type: 'task', label: 'Converter em oportunidade', laneId: 'vendedor', col: 7 },
      { id: 'end1', type: 'end', label: 'Oportunidade aberta', laneId: 'vendedor', col: 8 },
      { id: 'n6', type: 'task', label: 'Registrar sem interesse / descarte', laneId: 'gerente', col: 7 },
      { id: 'end2', type: 'end', label: 'Lead encerrado', laneId: 'gerente', col: 8 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'g1' },
      { id: 'e3', from: 'g1', to: 'n2a', label: 'Sim', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e4', from: 'g1', to: 'n2b', label: 'Não', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e5', from: 'n2a', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e6', from: 'n2b', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e7', from: 'n3', to: 'n4' },
      { id: 'e8', from: 'n4', to: 'g2' },
      { id: 'e9', from: 'g2', to: 'n5', label: 'Sim' },
      { id: 'e10', from: 'n5', to: 'end1' },
      { id: 'e11', from: 'g2', to: 'n6', label: 'Não', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e12', from: 'n6', to: 'end2' }
    ],
    controlsText: 'Registrar empresa, contato, origem, necessidade, locais, potencial, decisores, prazo e próximos passos. BANT é opcional. Cadastro novo é executado pelo vendedor; a raia inferior representa validação sob responsabilidade do gerente.',
    sourceBase: 'Base: Manual §§ 3–5; diagrama p. 2',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-02',
    code: 'BPMN-02',
    title: 'Diagnóstico e solicitação ao Pré-vendas',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '03 / 08',
    lanes: [
      { id: 'comercial', label: 'Comercial', height: 155 },
      { id: 'prevendas', label: 'Pré-vendas', height: 135 },
      { id: 'gerente', label: 'Gerente da conta', height: 120 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Lead qualificado', laneId: 'comercial', col: 0 },
      { id: 'n1', type: 'task', label: 'Diagnosticar Oportunidades', laneId: 'comercial', col: 1 },
      { id: 'n2', type: 'task', label: 'Registrar / completar oportunidade no CRM', laneId: 'comercial', col: 2 },
      { id: 'n3', type: 'task', label: 'Solicitar cotação e proposta', laneId: 'comercial', col: 3 },
      { id: 'n4', type: 'subprocess', label: '07 Pré-vendas: solução e precificação', laneId: 'prevendas', col: 4, linkedCode: 'BPMN-07' },
      { id: 'g1', type: 'gateway', label: 'Solução disponível?', laneId: 'comercial', col: 5 },
      { id: 'n5', type: 'task', label: 'Revisar necessidade ou escopo', laneId: 'comercial', col: 6 },
      { id: 'n6', type: 'task', label: 'Conferir proposta e checklist', laneId: 'comercial', col: 7 },
      { id: 'end_close', type: 'end', label: 'Sem solução / encerrar', laneId: 'prevendas', col: 7 },
      { id: 'n7', type: 'task', label: 'Validar condições e alçadas', laneId: 'gerente', col: 8 },
      { id: 'g2', type: 'gateway', label: 'Aprovada?', laneId: 'gerente', col: 9 },
      { id: 'n8', type: 'task', label: 'Enviar proposta versionada ao cliente', laneId: 'comercial', col: 10 },
      { id: 'end_sent', type: 'end', label: 'Proposta enviada', laneId: 'comercial', col: 11 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'n2' },
      { id: 'e3', from: 'n2', to: 'n3' },
      { id: 'e4', from: 'n3', to: 'n4', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e5', from: 'n4', to: 'g1', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e6', from: 'g1', to: 'n5', label: 'Não' },
      { id: 'e7', from: 'g1', to: 'n6', label: 'Sim', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 24 },
      { id: 'e8', from: 'n5', to: 'n3', label: 'Reformular', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 42 },
      { id: 'e9', from: 'n5', to: 'end_close', label: 'Encerrar', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e10', from: 'n6', to: 'n7', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e11', from: 'n7', to: 'g2' },
      { id: 'e12', from: 'g2', to: 'n3', label: 'Não: revisar', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 58 },
      { id: 'e13', from: 'g2', to: 'n8', label: 'Sim', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e14', from: 'n8', to: 'end_sent' }
    ],
    controlsText: 'Solicitação deve conter: necessidade, locais, requisitos, prazo, orçamento e contatos. Simulador de links apenas quando aplicável.',
    sourceBase: 'Base: Fluxos de sequência e responsabilidades • Pré-vendas',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-03',
    code: 'BPMN-03',
    title: 'Negociação e fechamento GANHO',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '04 / 08',
    lanes: [
      { id: 'comercial', label: 'Comercial', height: 155 },
      { id: 'prevendas', label: 'Pré-vendas', height: 120 },
      { id: 'gerente', label: 'Gerente da conta', height: 120 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Proposta enviada', laneId: 'comercial', col: 0 },
      { id: 'n1', type: 'task', label: 'Negociar e registrar follow-up', laneId: 'comercial', col: 1 },
      { id: 'g1', type: 'gateway', label: 'Resultado?', laneId: 'comercial', col: 2 },
      { id: 'n2', type: 'task', label: 'Registrar motivo da perda', laneId: 'comercial', col: 3 },
      { id: 'end_lost', type: 'end', label: 'Perdido', laneId: 'comercial', col: 4 },
      { id: 'g2', type: 'gateway', label: 'Revisão técnica?', laneId: 'comercial', col: 5 },
      { id: 'n3', type: 'subprocess', label: '07 Revisar solução e cotação', laneId: 'prevendas', col: 6, linkedCode: 'BPMN-07' },
      { id: 'n4', type: 'task', label: 'Revalidar condições e alçadas', laneId: 'gerente', col: 7 },
      { id: 'g3', type: 'gateway', label: 'Aprovada?', laneId: 'gerente', col: 8 },
      { id: 'n5', type: 'task', label: 'Reenviar proposta atualizada', laneId: 'comercial', col: 9 },
      { id: 'n6', type: 'task', label: 'Anexar aceite formal e dados finais', laneId: 'comercial', col: 10 },
      { id: 'n7', type: 'task', label: 'Validar fechamento', laneId: 'gerente', col: 11 },
      { id: 'n8', type: 'task', label: 'Marcar GANHO', laneId: 'comercial', col: 12 },
      { id: 'end_won', type: 'end', label: 'GANHO', laneId: 'comercial', col: 13 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'g1' },
      { id: 'e3', from: 'g1', to: 'n1', label: 'Pendente', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 26 },
      { id: 'e4', from: 'g1', to: 'n2', label: 'Perda' },
      { id: 'e5', from: 'n2', to: 'end_lost' },
      { id: 'e6', from: 'g1', to: 'g2', label: 'Revisão', fromSide: 'bottom', toSide: 'left', route: 'top-loop', loopOffset: 44 },
      { id: 'e7', from: 'g2', to: 'n3', label: 'Sim', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e8', from: 'g2', to: 'n6', label: 'Aceite formal', fromSide: 'right', toSide: 'left' },
      { id: 'e9', from: 'n3', to: 'n4', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e10', from: 'n4', to: 'g3' },
      { id: 'e11', from: 'g3', to: 'g2', label: 'Não', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 38 },
      { id: 'e12', from: 'g3', to: 'n5', label: 'Sim', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e13', from: 'n5', to: 'n1', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 56 },
      { id: 'e14', from: 'n6', to: 'n7', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e15', from: 'n7', to: 'n8', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e16', from: 'n8', to: 'end_won' }
    ],
    controlsText: 'Sem aceite formal, não marcar GANHO. Revisões técnicas retornam ao Pré-vendas; condições fora da alçada exigem aprovação prévia.',
    sourceBase: 'Base: Fluxos de sequência e responsabilidades • Negociação',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-04',
    code: 'BPMN-04',
    title: 'Kickoff interno e validação de escopo',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '05 / 08',
    lanes: [
      { id: 'gerente', label: 'Gerente da conta', height: 135 },
      { id: 'implantacao', label: 'Implantação / Projetos', height: 120 },
      { id: 'engenharia', label: 'Engenharia e áreas envolvidas', height: 130 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'GANHO', laneId: 'gerente', col: 0 },
      { id: 'n1', type: 'task', label: 'Agendar kickoff interno', laneId: 'gerente', col: 1 },
      { id: 'n2', type: 'task', label: 'Realizar kickoff e registrar ata', laneId: 'gerente', col: 2 },
      { id: 'n3', type: 'task', label: 'Definir líder, plano e cronograma', laneId: 'implantacao', col: 3 },
      { id: 'n4', type: 'task', label: 'Validar escopo e capacidade', laneId: 'engenharia', col: 4 },
      { id: 'g1', type: 'gateway', label: 'Escopo OK?', laneId: 'gerente', col: 5 },
      { id: 'n5', type: 'task', label: 'Resolver e registrar divergências', laneId: 'engenharia', col: 6 },
      { id: 'n6', type: 'task', label: 'Confirmar prontidão externa', laneId: 'gerente', col: 7 },
      { id: 'end_ok', type: 'end', label: 'Liberado para kickoff externo', laneId: 'gerente', col: 8 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'n2' },
      { id: 'e3', from: 'n2', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e4', from: 'n3', to: 'n4', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e5', from: 'n4', to: 'g1', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e6', from: 'g1', to: 'n5', label: 'Não: bloqueado', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e7', from: 'n5', to: 'n4', label: 'Revalidar', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 26 },
      { id: 'e8', from: 'g1', to: 'n6', label: 'Sim' },
      { id: 'e9', from: 'n6', to: 'end_ok' }
    ],
    controlsText: 'Agendamento imediato, preferencialmente em até 1 dia útil após GANHO. Ata, plano de ação, líder operacional, riscos e dependências são obrigatórios.',
    sourceBase: 'Base: Manual § 9, 14–16; diagrama pp. 3–4',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-05',
    code: 'BPMN-05',
    title: 'Kickoff externo e implantação',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '06 / 08',
    lanes: [
      { id: 'gerente', label: 'Gerente da conta', height: 135 },
      { id: 'implantacao', label: 'Implantação / Projetos', height: 155 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Validação interna concluída', laneId: 'gerente', col: 0 },
      { id: 'n1', type: 'task', label: 'Agendar kickoff com cliente', laneId: 'gerente', col: 1 },
      { id: 'n2', type: 'task', label: 'Realizar kickoff e compartilhar plano', laneId: 'gerente', col: 2 },
      { id: 'n3', type: 'task', label: 'Executar marcos e atualizar status', laneId: 'implantacao', col: 3 },
      { id: 'g1', type: 'gateway', label: 'Mudança de escopo?', laneId: 'implantacao', col: 4 },
      { id: 'n4', type: 'task', label: 'Submeter mudança à aprovação', laneId: 'implantacao', col: 5 },
      { id: 'g2', type: 'gateway', label: 'Aprovada?', laneId: 'implantacao', col: 6 },
      { id: 'n5', type: 'task', label: 'Executar escopo autorizado', laneId: 'implantacao', col: 7 },
      { id: 'n6', type: 'task', label: 'Realizar testes previstos', laneId: 'implantacao', col: 8 },
      { id: 'end_ok', type: 'end', label: 'Entrega para aceite', laneId: 'implantacao', col: 9 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'n2' },
      { id: 'e3', from: 'n2', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e4', from: 'n3', to: 'g1' },
      { id: 'e5', from: 'g1', to: 'n4', label: 'Sim' },
      { id: 'e6', from: 'g1', to: 'n5', label: 'Não', fromSide: 'bottom', toSide: 'bottom', route: 'bottom-loop', loopOffset: 28 },
      { id: 'e7', from: 'n4', to: 'g2' },
      { id: 'e8', from: 'g2', to: 'n3', label: 'Não: replanejar', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 30 },
      { id: 'e9', from: 'g2', to: 'n5', label: 'Sim' },
      { id: 'e10', from: 'n5', to: 'n6' },
      { id: 'e11', from: 'n6', to: 'end_ok' }
    ],
    controlsText: 'Cliente participa do kickoff; gerente acompanha relacionamento e satisfação durante a execução. Implantação conduz marcos, riscos e desvios. Mudanças exigem aprovação formal.',
    sourceBase: 'Base: Manual §§ 10–11; diagrama p. 3',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-06',
    code: 'BPMN-06',
    title: 'Aceite e transição para operação',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '07 / 08',
    lanes: [
      { id: 'implantacao', label: 'Implantação / Projetos', height: 155 },
      { id: 'operacao', label: 'Operação / Suporte', height: 120 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Entrega testada', laneId: 'implantacao', col: 0 },
      { id: 'n1', type: 'task', label: 'Solicitar aceite do cliente', laneId: 'implantacao', col: 1 },
      { id: 'g1', type: 'gateway', label: 'Aceite obtido?', laneId: 'implantacao', col: 2 },
      { id: 'n2', type: 'task', label: 'Tratar pendências e retestar', laneId: 'implantacao', col: 3 },
      { id: 'n3', type: 'task', label: 'Registrar aceite e evidências', laneId: 'implantacao', col: 4 },
      { id: 'n4', type: 'task', label: 'Transferir documentação e configurações', laneId: 'implantacao', col: 5 },
      { id: 'n5', type: 'task', label: 'Receber informações para sustentação', laneId: 'operacao', col: 6 },
      { id: 'end_ok', type: 'end', label: 'Processo concluído', laneId: 'operacao', col: 7 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'g1' },
      { id: 'e3', from: 'g1', to: 'n2', label: 'Não' },
      { id: 'e4', from: 'n2', to: 'n1', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 28 },
      { id: 'e5', from: 'g1', to: 'n3', label: 'Sim', fromSide: 'bottom', toSide: 'bottom', route: 'bottom-loop', loopOffset: 28 },
      { id: 'e6', from: 'n3', to: 'n4' },
      { id: 'e7', from: 'n4', to: 'n5', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e8', from: 'n5', to: 'end_ok' }
    ],
    controlsText: 'Conclusão somente após entrega validada e transição para operação/suporte. O ciclo de correção e reteste explicita o tratamento de pendências antes do aceite.',
    sourceBase: 'Base: Manual §§ 1, 11–12; diagrama p. 3',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  },
  {
    id: 'bpmn-07',
    code: 'BPMN-07',
    title: 'Pré-vendas: análise, cotação e proposta',
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: '08 / 08',
    lanes: [
      { id: 'prevendas', label: 'Pré-vendas', height: 145 },
      { id: 'comercial', label: 'Comercial', height: 115 },
      { id: 'engenharia', label: 'Engenharia / apoio técnico', height: 115 },
      { id: 'financeiro', label: 'Financeiro / alçadas', height: 115 }
    ],
    nodes: [
      { id: 'n0', type: 'start', label: 'Solicitação recebida', laneId: 'prevendas', col: 0 },
      { id: 'n1', type: 'task', label: 'Avaliar escopo e requisitos', laneId: 'prevendas', col: 1 },
      { id: 'g1', type: 'gateway', label: 'Escopo completo?', laneId: 'prevendas', col: 2 },
      { id: 'n2', type: 'task', label: 'Complementar informações', laneId: 'comercial', col: 3 },
      { id: 'n3', type: 'task', label: 'Definir produto e arquitetura', laneId: 'prevendas', col: 4 },
      { id: 'n4', type: 'task', label: 'Validar viabilidade e prazo', laneId: 'engenharia', col: 5 },
      { id: 'g2', type: 'gateway', label: 'Viável?', laneId: 'engenharia', col: 6 },
      { id: 'n5', type: 'task', label: 'Avaliar alternativa técnica', laneId: 'prevendas', col: 7 },
      { id: 'g3', type: 'gateway', label: 'Há alternativa?', laneId: 'prevendas', col: 8 },
      { id: 'end_inv', type: 'end', label: 'Devolver inviabilidade ao Comercial', laneId: 'comercial', col: 9 },
      { id: 'n6', type: 'task', label: 'Solicitar e receber cotações de fornecedores', laneId: 'prevendas', col: 10 },
      { id: 'n7', type: 'task', label: 'Comparar custos, SLA e condições', laneId: 'prevendas', col: 11 },
      { id: 'n8', type: 'task', label: 'Precificar solução e calcular margem', laneId: 'prevendas', col: 12 },
      { id: 'n9', type: 'task', label: 'Validar custos e condições quando exigido', laneId: 'financeiro', col: 13 },
      { id: 'g4', type: 'gateway', label: 'Condições válidas?', laneId: 'financeiro', col: 14 },
      { id: 'n10', type: 'task', label: 'Montar proposta técnica e comercial', laneId: 'prevendas', col: 15 },
      { id: 'n11', type: 'task', label: 'Devolver proposta, custos e premissas ao Comercial', laneId: 'prevendas', col: 16 },
      { id: 'end_ok', type: 'end', label: 'Proposta devolvida', laneId: 'prevendas', col: 17 }
    ],
    edges: [
      { id: 'e1', from: 'n0', to: 'n1' },
      { id: 'e2', from: 'n1', to: 'g1' },
      { id: 'e3', from: 'g1', to: 'n2', label: 'Não', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e4', from: 'n2', to: 'n3', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e5', from: 'g1', to: 'n3', label: 'Sim' },
      { id: 'e6', from: 'n3', to: 'n4', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e7', from: 'n4', to: 'g2' },
      { id: 'e8', from: 'g2', to: 'n5', label: 'Não', fromSide: 'top', toSide: 'left', route: 'step-h-v' },
      { id: 'e9', from: 'g2', to: 'n6', label: 'Sim', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e10', from: 'n5', to: 'g3' },
      { id: 'e11', from: 'g3', to: 'n3', label: 'Sim', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 28 },
      { id: 'e12', from: 'g3', to: 'end_inv', label: 'Não', fromSide: 'bottom', toSide: 'left', route: 'step-v-h' },
      { id: 'e13', from: 'n6', to: 'n7' },
      { id: 'e14', from: 'n7', to: 'n8' },
      { id: 'e15', from: 'n8', to: 'n9', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e16', from: 'n9', to: 'g4' },
      { id: 'e17', from: 'g4', to: 'n8', label: 'Não', fromSide: 'top', toSide: 'top', route: 'top-loop', loopOffset: 38 },
      { id: 'e18', from: 'g4', to: 'n10', label: 'Sim', fromSide: 'right', toSide: 'left', route: 'step-h-v' },
      { id: 'e19', from: 'n10', to: 'n11' },
      { id: 'e20', from: 'n11', to: 'end_ok' }
    ],
    controlsText: 'Registrar fornecedor, validade, custos recorrentes e não recorrentes, impostos, margem, SLA, prazo, exclusões e versão. Cotação externa é tratada como atividade de Pré-vendas.',
    sourceBase: 'Base: Fluxos de sequência e responsabilidades • Pré-vendas',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  }
];

export function cloneBpmnDiagram(diagram: BpmnDiagram): BpmnDiagram {
  return JSON.parse(JSON.stringify(diagram));
}

export function createBpmnFromSteps(
  name: string,
  steps: Array<{ title: string; owner: string; time: string; status: string; items: string[] }>,
  swimlanes: Array<{ area: string; entries: string[] }>,
  actions: string[] = []
): BpmnDiagram {
  const lanes: BpmnLane[] = swimlanes.length > 0
    ? swimlanes.map((lane, idx) => ({
        id: `lane-${idx}`,
        label: lane.area || `Raia ${idx + 1}`,
        height: 130
      }))
    : [{ id: 'lane-0', label: 'Equipe Responsável', height: 140 }];

  const findLaneId = (owner: string) => {
    const normalized = String(owner || '').toLowerCase();
    const match = lanes.find(l => l.label.toLowerCase().includes(normalized) || normalized.includes(l.label.toLowerCase()));
    return match ? match.id : lanes[0].id;
  };

  const nodes: BpmnNode[] = [
    { id: 'start', type: 'start', label: 'Início', laneId: lanes[0].id, col: 0 }
  ];

  steps.forEach((step, idx) => {
    const isDecision = /decis|aprov|valid|ok\?|ganho/i.test(step.title) && step.items.length <= 2;
    nodes.push({
      id: `step-${idx}`,
      type: isDecision ? 'gateway' : 'task',
      label: step.title,
      laneId: findLaneId(step.owner),
      col: idx + 1,
      owner: step.owner,
      sla: step.time,
      status: step.status,
      controls: step.items
    });
  });

  const lastLaneId = nodes[nodes.length - 1]?.laneId || lanes[lanes.length - 1].id;
  nodes.push({ id: 'end', type: 'end', label: 'Concluído', laneId: lastLaneId, col: steps.length + 1 });

  const edges: BpmnEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      from: nodes[i].id,
      to: nodes[i + 1].id,
      route: nodes[i].laneId === nodes[i + 1].laneId ? 'auto' : 'step-h-v'
    });
  }

  return {
    id: `custom-${Date.now()}`,
    code: 'BPMN-CUSTOM',
    title: name,
    subtitle: 'ARQUITETURA DE PROCESSOS',
    pageLabel: 'CUSTOM',
    lanes,
    nodes,
    edges,
    controlsText: actions.length > 0 ? actions.join(' • ') : 'O CRM é a fonte oficial. Toda etapa ativa tem responsável, status e próxima ação com prazo.',
    sourceBase: 'Base: Mapeamento customizado no PMO Inteligente',
    footerText: 'Uso interno • Modelo padronizado BPMN'
  };
}
