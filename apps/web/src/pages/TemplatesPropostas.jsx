import React, { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { 
  FileText, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Copy, 
  Trash2,
  Star,
  StarOff,
  Settings,
  Palette,
  Layout,
  Image,
  Type,
  Download,
  Upload,
  Check
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
const safeArray = (v) => (Array.isArray(v) ? v : []);

const SIMULADORES_PROPOSAL_TEMPLATE = {
  type: 'COMMERCIAL',
  name: 'Modelo Simuladores B2B',
  description: 'Modelo padrão de proposta comercial usado no fluxo de Simuladores.',
  isDefault: false,
  coverEnabled: true,
  coverTitle: 'Proposta Comercial',
  coverSubtitle: 'Solução personalizada para seu negócio',
  coverLogo: '',
  coverBackground: 'linear-gradient(135deg, rgba(30, 64, 175, 0.95) 0%, rgba(29, 78, 216, 0.88) 48%, rgba(14, 165, 233, 0.82) 100%), url("https://st4.depositphotos.com/1025323/27146/i/450/depositphotos_271460380-stock-photo-perspectives-of-virtual-world.jpg") center/cover no-repeat',
  headerEnabled: true,
  headerLogo: '',
  headerText: 'PROPOSTA COMERCIAL',
  headerHeight: 80,
  footerEnabled: true,
  footerText: 'Documento confidencial - Uso restrito',
  footerLogo: '',
  footerHeight: 60,
  indexEnabled: true,
  indexTitle: 'Índice',
  sections: [
    {
      id: 'client_project',
      title: 'Cliente e Projeto',
      enabled: true,
      order: 1,
      body: 'Dados do cliente, contato, projeto e responsável comercial.',
      placeholders: ['Cliente', 'Projeto', 'Contato', 'Gerente de conta']
    },
    {
      id: 'solution',
      title: 'Solução Proposta',
      enabled: true,
      order: 2,
      body: 'Descrição da solução, escopo técnico-comercial e diferenciais apresentados ao cliente.',
      placeholders: ['Produto / Serviço', 'Escopo', 'Benefícios']
    },
    {
      id: 'items',
      title: 'Itens da Proposta',
      enabled: true,
      order: 3,
      body: 'Tabela com itens, quantidades, modalidade, custo unitário e total da proposta.',
      placeholders: ['Itens', 'Quantidade', 'Valor unitário', 'Valor total']
    },
    {
      id: 'investment',
      title: 'Investimento',
      enabled: true,
      order: 4,
      body: 'Resumo financeiro consolidando implantação, mensalidade, impostos, descontos e preço final.',
      highlights: ['Preço final', 'Mensalidade', 'Contrato']
    },
    {
      id: 'commercial_terms',
      title: 'Condições Comerciais',
      enabled: true,
      order: 5,
      bullets: [
        'Validade da proposta conforme negociação comercial.',
        'Condições de pagamento, prazos e impostos conforme composição do orçamento.',
        'Itens e premissas sujeitos à validação técnica e comercial.'
      ]
    },
    {
      id: 'approval',
      title: 'Aprovação',
      enabled: true,
      order: 6,
      body: 'Área destinada ao aceite, assinatura e formalização da proposta.'
    }
  ],
  primaryColor: '#1D4ED8',
  secondaryColor: '#0EA5E9',
  fontFamily: 'Inter',
  fontSize: 12,
  pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
  pageSize: 'A4',
  pageOrientation: 'portrait'
};

const TECHNICAL_TEMPLATE_DEFAULTS = {
  coverTitle: 'PROPOSTA TÉCNICA',
  coverSubtitle: 'Detalhamento técnico da solução proposta',
  headerText: 'PROPOSTA TÉCNICA',
  sections: [
    { id: 'company', title: 'Informações do Cliente', enabled: true, order: 1 },
    { id: 'technical_summary', title: 'Resumo Técnico', enabled: true, order: 2 },
    { id: 'scope', title: 'Escopo', enabled: true, order: 3 },
    { id: 'requirements', title: 'Requisitos', enabled: true, order: 4 },
    { id: 'solution', title: 'Solução Proposta', enabled: true, order: 5 },
    { id: 'timeline', title: 'Cronograma', enabled: true, order: 6 },
    { id: 'assumptions', title: 'Premissas', enabled: true, order: 7 },
    { id: 'exclusions', title: 'Exclusões', enabled: true, order: 8 },
    { id: 'support', title: 'Suporte e SLA', enabled: true, order: 9 }
  ],
  primaryColor: '#0F172A',
  secondaryColor: '#475569'
};

const cloneTemplateDefaults = (template = SIMULADORES_PROPOSAL_TEMPLATE) =>
  JSON.parse(JSON.stringify(template));

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    return [];
  }
};

const normalizeTemplateSections = (sections, type = 'COMMERCIAL') => {
  const parsed = parseMaybeJson(sections);
  const fallback = type === 'TECHNICAL'
    ? TECHNICAL_TEMPLATE_DEFAULTS.sections
    : SIMULADORES_PROPOSAL_TEMPLATE.sections;

  let source = [];
  if (Array.isArray(parsed)) {
    source = parsed;
  } else if (parsed && typeof parsed === 'object') {
    source = Array.isArray(parsed.sections)
      ? parsed.sections
      : Object.entries(parsed).map(([id, value], index) => (
          value && typeof value === 'object'
            ? { id, ...value, order: value.order ?? index + 1 }
            : { id, title: String(value || id), enabled: true, order: index + 1 }
        ));
  }

  const normalized = source.length > 0 ? source : fallback;
  return normalized.map((section, index) => ({
    id: section?.id || `section_${index + 1}`,
    title: section?.title || `Seção ${index + 1}`,
    enabled: section?.enabled !== false,
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index + 1,
    body: section?.body || '',
    bullets: safeArray(section?.bullets),
    highlights: safeArray(section?.highlights),
    placeholders: safeArray(section?.placeholders),
    notes: section?.notes || '',
    layout: section?.layout,
    pageBackground: section?.pageBackground
  }));
};

const normalizeTemplate = (template = {}) => {
  const base = template.type === 'TECHNICAL'
    ? { ...cloneTemplateDefaults(), ...TECHNICAL_TEMPLATE_DEFAULTS, type: 'TECHNICAL' }
    : cloneTemplateDefaults();

  return {
    ...base,
    ...template,
    isDefault: Boolean(template.isDefault),
    coverEnabled: template.coverEnabled !== false,
    headerEnabled: template.headerEnabled !== false,
    footerEnabled: template.footerEnabled !== false,
    indexEnabled: template.indexEnabled !== false,
    headerHeight: Number(template.headerHeight || base.headerHeight || 80),
    footerHeight: Number(template.footerHeight || base.footerHeight || 60),
    fontSize: Number(template.fontSize || base.fontSize || 12),
    pageMargins: template.pageMargins && typeof template.pageMargins === 'object'
      ? template.pageMargins
      : base.pageMargins,
    sections: normalizeTemplateSections(template.sections, template.type || base.type)
  };
};

const isDoubleVisualTemplate = (template) => {
  const haystack = [
    template?.coverBackground,
    ...safeArray(template?.sections).map((s) => s?.pageBackground)
  ]
    .filter(Boolean)
    .join(' ');
  return haystack.includes('/proposal-templates/double/');
};

const renderTextParagraphs = (text) => {
  const parts = String(text || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  return parts.map((p, idx) => (
    <p key={idx} className="leading-relaxed">
      {p}
    </p>
  ));
};

const isSimulatorCommercialTemplate = (template) => {
  const sections = normalizeTemplateSections(template?.sections, template?.type);
  const sectionIds = new Set(sections.map((section) => section.id));
  return (
    template?.name === SIMULADORES_PROPOSAL_TEMPLATE.name ||
    String(template?.description || '').includes('Simuladores') ||
    String(template?.coverBackground || '').includes('depositphotos_271460380') ||
    (sectionIds.has('client_project') && sectionIds.has('investment') && sectionIds.has('commercial_terms'))
  );
};

const SimulatorCommercialTemplatePreview = ({ template }) => {
  const pageStyle = {
    width: '210mm',
    height: '297mm',
    margin: '0 auto',
    pageBreakAfter: 'always',
    pageBreakInside: 'avoid'
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--crm-muted)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            A4 • Retrato
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-200 border border-blue-500/20">
            Modelo Simuladores
          </span>
        </div>
        <div className="text-xs">
          Preview visual igual ao modelo comercial dos Simuladores
        </div>
      </div>

      <div
        className="proposal-page bg-white border rounded-lg shadow-lg print:shadow-none print:border-none overflow-hidden"
        style={pageStyle}
      >
        <div
          className="relative h-full w-full"
          style={{
            backgroundImage: "url('https://st4.depositphotos.com/1025323/27146/i/450/depositphotos_271460380-stock-photo-perspectives-of-virtual-world.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 to-blue-800/80" />
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
            />
          </div>

          <div className="absolute top-8 right-8">
            <div className="bg-blue-900 border-2 border-white rounded-lg p-4 w-40 h-40 flex flex-col items-center justify-center overflow-hidden">
              {!isBlank(template.coverLogo) ? (
                <img
                  src={template.coverLogo}
                  alt="Logo da Empresa"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <>
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-4 h-4 border-2 border-white rounded-full mr-1" />
                    <div className="w-4 h-4 border-2 border-white rounded-full" />
                  </div>
                  <div className="text-white font-bold text-lg">double</div>
                  <div className="text-white text-xs">ti + telecom</div>
                </>
              )}
            </div>
          </div>

          <div className="p-12 text-white">
            <div className="mb-8">
              <h1 className="text-6xl font-bold text-blue-200 leading-tight">
                Proposta<br />Comercial
              </h1>
            </div>

            <div className="mb-8">
              <div className="text-xl mb-2">Nome do Cliente</div>
              <div className="text-lg opacity-90">{new Date().toLocaleDateString('pt-BR')}</div>
              <div className="text-md opacity-80 mt-1">Projeto: Nome do Projeto</div>
            </div>

            <div className="border-t border-white opacity-30 mb-8" />

            <div className="space-y-4">
              <div className="text-xl font-semibold mb-4">Produto:</div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-blue-900" />
                </div>
                <span className="text-lg font-semibold">Internet</span>
              </div>
            </div>

            <div className="border-t border-white opacity-30 mt-8" />
          </div>

          <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2">
            <div className="w-[500px] h-[375px] bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg border-2 border-white overflow-hidden">
              <div className="h-full bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-800">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <React.Fragment key={index}>
                      <div className="absolute top-2 w-1 h-44 bg-blue-300 opacity-80" style={{ left: `${8 + index * 8}px` }} />
                      <div className="absolute top-2 w-1 h-44 bg-blue-300 opacity-80" style={{ right: `${8 + index * 8}px` }} />
                    </React.Fragment>
                  ))}
                </div>
                <div className="text-center text-white relative z-10">
                  <div className="text-2xl font-bold mb-2">Internet</div>
                  <div className="text-sm opacity-80">Infraestrutura de Alta Tecnologia</div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <div className="w-12 h-12 bg-gray-800 rounded grid grid-cols-8 grid-rows-8 gap-0.5 p-1">
                  {Array.from({ length: 64 }).map((_, index) => (
                    <div
                      key={index}
                      className={(index + Math.floor(index / 8)) % 3 === 0 ? 'bg-white' : 'bg-gray-800'}
                    />
                  ))}
                </div>
              </div>
              <div className="text-white">
                <div className="font-semibold text-lg">Visite Nosso Site</div>
                <div className="text-sm opacity-90">www.doubletelecom.com.br</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="proposal-page bg-white border rounded-lg shadow-lg print:shadow-none print:border-none overflow-hidden"
        style={pageStyle}
      >
        <div className="p-12 h-full relative text-gray-900">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Proposta Comercial</h1>
              <p className="text-gray-600">Internet</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Data: {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados do Cliente</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Nome:</strong> Nome do Cliente</p>
              <p><strong>Projeto:</strong> Nome do Projeto</p>
              <p><strong>Email:</strong> email@cliente.com.br</p>
              <p><strong>Telefone:</strong> (00) 00000-0000</p>
              <p><strong>Contato:</strong> Nome do contato</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Gerente de Contas</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Nome:</strong> Gerente de Conta</p>
              <p><strong>Email:</strong> comercial@empresa.com.br</p>
              <p><strong>Telefone:</strong> (00) 00000-0000</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Produtos e Serviços</h3>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Descrição</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Setup</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Mensal</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Descontos</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Produto / Serviço</td>
                  <td className="border border-gray-300 px-4 py-2">R$ 0,00</td>
                  <td className="border border-gray-300 px-4 py-2">R$ 0,00</td>
                  <td className="border border-gray-300 px-4 py-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro Detalhado</h3>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-lg p-5">
              <table className="w-full">
                <tbody>
                  <tr className="border-b-2 border-gray-300">
                    <td className="py-3 text-sm font-bold text-gray-800">Total Setup (Instalação):</td>
                    <td className="py-3 text-sm text-right font-bold text-gray-900">R$ 0,00</td>
                  </tr>
                  <tr className="bg-blue-50 border-b-2 border-blue-300">
                    <td className="py-3 text-base font-bold text-blue-900">Valor Mensal Final:</td>
                    <td className="py-3 text-base text-right font-bold text-blue-900">R$ 0,00</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm font-medium text-gray-700">Prazo Contratual:</td>
                    <td className="py-2 text-sm text-right font-semibold text-gray-900">12 meses</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="absolute bottom-12 left-12 right-12">
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Double TI + Telecom</p>
                  <p className="text-sm text-gray-600">www.doubletelecom.com.br</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Página 2 de 2</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProposalTemplatePreview = ({ template }) => {
  if (!template) return null;

  if (isSimulatorCommercialTemplate(template)) {
    return <SimulatorCommercialTemplatePreview template={normalizeTemplate(template)} />;
  }

  const sections = safeArray(template.sections);
  const enabledSections = sections
    .filter((s) => s?.enabled)
    .filter((s) => s?.id !== 'cover' && s?.id !== 'index')
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));

  const isDouble = isDoubleVisualTemplate(template);
  const defaultPageBackground = isDouble
    ? 'url("/proposal-templates/double/page.webp") center/cover no-repeat'
    : '#ffffff';

  const pages = [];
  let nextPageNumber = 1;

  if (template.coverEnabled) {
    pages.push({
      kind: 'cover',
      label: 'Capa',
      number: nextPageNumber++,
      background: template.coverBackground || defaultPageBackground
    });
  }

  const indexPageNumber = template.indexEnabled ? nextPageNumber : null;
  if (template.indexEnabled) {
    pages.push({
      kind: 'index',
      label: template.indexTitle || 'Índice',
      number: nextPageNumber++,
      background: defaultPageBackground
    });
  }

  for (const section of enabledSections) {
    pages.push({
      kind: 'section',
      label: section.title || 'Seção',
      number: nextPageNumber++,
      background: section.pageBackground || defaultPageBackground,
      section
    });
  }

  const coverHasOverlay =
    !isBlank(template.coverTitle) ||
    !isBlank(template.coverSubtitle) ||
    !isBlank(template.coverLogo);

  const coverText = {
    title: (template.coverTitle || '').trim(),
    subtitle: (template.coverSubtitle || '').trim()
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--crm-muted)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            {template.pageSize || 'A4'} {template.pageOrientation === 'landscape' ? '• Paisagem' : '• Retrato'}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            {enabledSections.length} seção(ões)
          </span>
          {isDouble && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-200 border border-blue-500/20">
              Layout Double
            </span>
          )}
        </div>
        <div className="text-xs">
          Preview visual (não é o PDF final)
        </div>
      </div>

      <div className="space-y-10">
        {pages.map((page, idx) => {
          const delayMs = Math.min(idx * 60, 420);
          const baseStyle = {
            aspectRatio: '210 / 297',
            background: page.background || '#ffffff',
            fontFamily: template.fontFamily || 'Inter',
            color: '#0f172a'
          };

          const footerLabel = page.kind === 'section' ? (page.section?.id || '') : page.kind;

          const padClass =
            page.kind === 'cover'
              ? 'p-0'
              : page.section?.layout === 'double-who'
                ? 'px-14 pt-16 pb-24 text-white'
                : 'px-14 pt-16 pb-24';

          return (
            <div key={`${page.kind}-${page.number}`} className="mx-auto w-full max-w-[860px]">
              <div
                className={[
                  'relative overflow-hidden rounded-[26px] shadow-soft-2xl border border-black/10 dark:border-white/10 bg-white',
                  'motion-safe:animate-fade-up will-change-transform',
                  'transition-transform duration-300 hover:-translate-y-1'
                ].join(' ')}
                style={{ ...baseStyle, animationDelay: `${delayMs}ms` }}
              >
                {/* Cover */}
                {page.kind === 'cover' && (
                  <>
                    {coverHasOverlay && (
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/60" />
                    )}
                    <div className="absolute inset-0">
                      <div className="h-full w-full" />
                    </div>

                    {coverHasOverlay && (
                      <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
                        <div className="max-w-[78%]">
                          {!isBlank(template.coverLogo) && (
                            <img
                              src={template.coverLogo}
                              alt="Logo"
                              className="h-14 mb-8 drop-shadow-sm"
                            />
                          )}
                          {!isBlank(coverText.title) && (
                            <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
                              {coverText.title}
                            </h1>
                          )}
                          {!isBlank(coverText.subtitle) && (
                            <p className="text-lg opacity-90 mt-4 leading-relaxed">
                              {coverText.subtitle}
                            </p>
                          )}
                        </div>

                        <div className="flex items-end justify-between text-xs opacity-90">
                          <div>
                            <div className="uppercase tracking-widest">
                              {template.name}
                            </div>
                            {!isBlank(template.description) && (
                              <div className="opacity-80 mt-1 max-w-[520px]">
                                {template.description}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            Página {page.number}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Index */}
                {page.kind === 'index' && (
                  <div className="absolute inset-0">
                    <div className="h-full w-full">
                      <div className="absolute inset-0 px-14 pt-16 pb-28">
                        <div
                          className="text-3xl font-extrabold tracking-tight"
                          style={{ color: template.primaryColor || '#1E40AF' }}
                        >
                          {template.indexTitle || 'Índice'}
                        </div>

                        <div className="mt-10 space-y-3">
                          {enabledSections.length === 0 ? (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              Nenhuma seção habilitada.
                            </div>
                          ) : (
                            enabledSections.map((s, i) => {
                              // Page numbers: cover + index + previous sections.
                              const pageNumber =
                                (template.coverEnabled ? 1 : 0) +
                                (indexPageNumber ? 1 : 0) +
                                i +
                                1;

                              return (
                                <div key={s.id || i} className="flex items-center gap-3 text-sm">
                                  <div className="font-medium text-slate-900">
                                    {s.title}
                                  </div>
                                  <div className="flex-1 border-b border-dotted border-slate-300/80 translate-y-1" />
                                  <div className="tabular-nums text-slate-700">
                                    {pageNumber}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section */}
                {page.kind === 'section' && (
                  <div className={['absolute inset-0', padClass].join(' ')}>
                    <div className={page.section?.layout === 'double-who' ? 'max-w-[78%]' : ''}>
                      <div
                        className={page.section?.layout === 'double-who' ? 'text-4xl font-extrabold tracking-tight drop-shadow-sm' : 'text-3xl font-extrabold tracking-tight'}
                        style={{ color: page.section?.layout === 'double-who' ? '#E2E8F0' : (template.primaryColor || '#1E40AF') }}
                      >
                        {page.section?.title}
                      </div>

                      {!isBlank(page.section?.body) && (
                        <div
                          className={page.section?.layout === 'double-who' ? 'mt-6 text-slate-100/90 space-y-4' : 'mt-6 text-slate-700 space-y-4'}
                          style={{ fontSize: `${template.fontSize || 12}px` }}
                        >
                          {renderTextParagraphs(page.section?.body)}
                        </div>
                      )}
                    </div>

                    {safeArray(page.section?.highlights).length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {safeArray(page.section?.highlights).map((h, i) => (
                          <span
                            key={i}
                            className={[
                              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                              page.section?.layout === 'double-who'
                                ? 'bg-white/10 text-white border border-white/15'
                                : 'bg-blue-500/10 text-blue-800 border border-blue-500/20'
                            ].join(' ')}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    )}

                    {safeArray(page.section?.bullets).length > 0 && (
                      <ul
                        className={page.section?.layout === 'double-who' ? 'mt-8 space-y-2 text-slate-100/90' : 'mt-8 space-y-2 text-slate-700'}
                        style={{ fontSize: `${template.fontSize || 12}px` }}
                      >
                        {safeArray(page.section?.bullets).map((b, i) => (
                          <li key={i} className="flex gap-3">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  page.section?.layout === 'double-who'
                                    ? '#E2E8F0'
                                    : template.primaryColor || '#1E40AF'
                              }}
                            />
                            <span className="flex-1 leading-relaxed">{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {safeArray(page.section?.placeholders).length > 0 && (
                      <div className={page.section?.layout === 'double-who' ? 'mt-8 text-slate-100/80' : 'mt-8 text-slate-500'}>
                        <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
                          Campos a preencher
                        </div>
                        <ul className="mt-3 space-y-2 text-sm">
                          {safeArray(page.section?.placeholders).map((p, i) => (
                            <li key={i} className="italic">
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!isBlank(page.section?.notes) && (
                      <div
                        className={page.section?.layout === 'double-who' ? 'mt-10 p-4 rounded-2xl bg-white/10 border border-white/15 text-slate-100/90' : 'mt-10 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700'}
                        style={{ fontSize: `${template.fontSize || 12}px` }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-2">
                          Observações
                        </div>
                        <div className="leading-relaxed">
                          {page.section?.notes}
                        </div>
                      </div>
                    )}

                    {/* Page number */}
                    <div className="absolute bottom-6 right-7 text-xs tabular-nums opacity-70 text-slate-500">
                      {page.number}
                    </div>
                  </div>
                )}

                {/* Fallback content for blank templates */}
                {page.kind === 'section' &&
                  isBlank(page.section?.body) &&
                  safeArray(page.section?.bullets).length === 0 &&
                  safeArray(page.section?.placeholders).length === 0 &&
                  safeArray(page.section?.highlights).length === 0 &&
                  isBlank(page.section?.notes) && (
                    <div className="absolute inset-0 px-14 pt-28 pb-24 text-slate-500">
                      <div className="max-w-[78%] text-sm">
                        Conteúdo da seção "{page.section?.title}"...
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--crm-muted)]">
                <div className="truncate">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{page.label}</span>
                  {footerLabel ? (
                    <span className="ml-2 opacity-70">
                      {footerLabel}
                    </span>
                  ) : null}
                </div>
                <div className="tabular-nums">
                  Página {page.number}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TemplatesPropostas = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formData, setFormData] = useState(() => cloneTemplateDefaults());

  // Carregar templates ao montar o componente
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.proposalTemplates, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data.map(normalizeTemplate) : []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Nome do template é obrigatório');
      return;
    }

    try {
      const url = editingTemplate 
        ? `${API_ENDPOINTS.proposalTemplates}/${editingTemplate.id}` 
        : API_ENDPOINTS.proposalTemplates;
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(normalizeTemplate(formData))
      });

      if (response.ok) {
        fetchTemplates();
        resetForm();
        alert(editingTemplate ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar template');
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar template');
    }
  };

  const resetForm = () => {
    setFormData(cloneTemplateDefaults());
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleDuplicate = async (template) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.proposalTemplates}/${template.id}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: `${template.name} (Cópia)` })
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template duplicado com sucesso!');
      } else {
        alert('Erro ao duplicar template');
      }
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      alert('Erro ao duplicar template');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.proposalTemplates}/${template.id}/set-default`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template definido como padrão!');
      } else {
        alert('Erro ao definir template como padrão');
      }
    } catch (error) {
      console.error('Erro ao definir template como padrão:', error);
      alert('Erro ao definir template como padrão');
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Tem certeza que deseja deletar o template "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_ENDPOINTS.proposalTemplates}/${template.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template deletado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao deletar template');
      }
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      alert('Erro ao deletar template');
    }
  };

  const handlePreview = (template) => {
    setPreviewTemplate(normalizeTemplate(template));
    setShowPreview(true);
  };

  const updateSection = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      sections: normalizeTemplateSections(prev.sections, prev.type).map((section, i) =>
        i === index ? { ...section, [field]: value } : section
      )
    }));
  };

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: 'Nova Seção',
      enabled: true,
      order: normalizeTemplateSections(formData.sections, formData.type).length + 1
    };
    setFormData(prev => ({
      ...prev,
      sections: [...normalizeTemplateSections(prev.sections, prev.type), newSection]
    }));
  };

  const removeSection = (index) => {
    setFormData(prev => ({
      ...prev,
      sections: normalizeTemplateSections(prev.sections, prev.type).filter((_, i) => i !== index)
    }));
  };

  // Calcular estatísticas
  const stats = {
    total: Array.isArray(templates) ? templates.length : 0,
    default: Array.isArray(templates) ? templates.filter(t => t.isDefault).length : 0,
    active: Array.isArray(templates) ? templates.filter(t => t.isActive).length : 0,
    withCover: Array.isArray(templates) ? templates.filter(t => t.coverEnabled).length : 0
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Templates de Proposta"
        subtitle="Crie e gerencie templates profissionais para suas propostas comerciais"
        icon={FileText}
        gradient="purple"
        breadcrumbs={['Vendas & CRM', 'Templates']}
        actions={[
          {
            label: 'Novo Template',
            icon: Plus,
            onClick: () => setShowForm(true),
            variant: 'primary'
          }
        ]}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Templates"
          value={stats.total}
          subtitle="Templates disponíveis"
          icon={FileText}
          color="purple"
          trend={{ direction: 'up', value: '+2 este mês' }}
        />
        
        <AnimatedStats
          title="Template Padrão"
          value={stats.default}
          subtitle="Definido como padrão"
          icon={Star}
          color="yellow"
        />
        
        <AnimatedStats
          title="Templates Ativos"
          value={stats.active}
          subtitle="Disponíveis para uso"
          icon={Settings}
          color="green"
        />
        
        <AnimatedStats
          title="Com Capa"
          value={stats.withCover}
          subtitle="Templates com capa"
          icon={Image}
          color="blue"
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--crm-muted)] w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar templates por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="crm-input pl-10"
              />
            </div>
          </div>
        </div>
      </GradientCard>

      {/* Modal de Formulário */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingTemplate ? 'Editar Template' : 'Novo Template'}
      >
        <form onSubmit={handleSubmit} className="space-y-8">
              {/* Informações Básicas */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-purple-500" />
                  Informações Básicas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="crm-input"
                      placeholder="Ex: Template Corporativo"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="crm-input"
                      placeholder="Descrição do template"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Proposta
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setFormData((prev) => {
                          const updated = { ...prev, type: nextType };

                          // Ao criar um novo template, aplicar defaults coerentes por tipo.
                          if (editingTemplate) return updated;

                          if (nextType === 'TECHNICAL') {
                            return normalizeTemplate({
                              ...cloneTemplateDefaults(),
                              ...updated,
                              ...TECHNICAL_TEMPLATE_DEFAULTS
                            });
                          }

                          return normalizeTemplate({
                            ...cloneTemplateDefaults(),
                            ...updated
                          });
                        });
                      }}
                      className="crm-input"
                    >
                      <option value="COMMERCIAL">Proposta comercial</option>
                      <option value="TECHNICAL">Proposta técnica</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Definir como template padrão
                  </label>
                </div>
              </div>

              {/* Configurações de Capa */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Image className="w-5 h-5 mr-2 text-blue-500" />
                  Configurações de Capa
                </h3>
                
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="coverEnabled"
                    checked={formData.coverEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverEnabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="coverEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Incluir capa na proposta
                  </label>
                </div>

                {formData.coverEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Título da Capa
                      </label>
                      <input
                        type="text"
                        value={formData.coverTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverTitle: e.target.value }))}
                        className="crm-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subtítulo da Capa
                      </label>
                      <input
                        type="text"
                        value={formData.coverSubtitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverSubtitle: e.target.value }))}
                        className="crm-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo da Capa (URL)
                      </label>
                      <input
                        type="url"
                        value={formData.coverLogo}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverLogo: e.target.value }))}
                        className="crm-input"
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fundo da Capa (CSS)
                      </label>
                      <input
                        type="text"
                        value={formData.coverBackground}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverBackground: e.target.value }))}
                        className="crm-input"
                        placeholder="linear-gradient(...) ou #FFFFFF"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Configurações de Cabeçalho e Rodapé */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cabeçalho */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Layout className="w-5 h-5 mr-2 text-green-500" />
                    Cabeçalho
                  </h3>
                  
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="headerEnabled"
                      checked={formData.headerEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, headerEnabled: e.target.checked }))}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="headerEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Incluir cabeçalho
                    </label>
                  </div>

                  {formData.headerEnabled && (
                    <div className="space-y-4 pl-6 border-l-2 border-green-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Texto do Cabeçalho
                        </label>
                        <input
                          type="text"
                          value={formData.headerText}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value }))}
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo do Cabeçalho (URL)
                        </label>
                        <input
                          type="url"
                          value={formData.headerLogo}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerLogo: e.target.value }))}
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Altura (px)
                        </label>
                        <input
                          type="number"
                          min="40"
                          max="200"
                          value={formData.headerHeight}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerHeight: parseInt(e.target.value) }))}
                          className="crm-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Layout className="w-5 h-5 mr-2 text-orange-500" />
                    Rodapé
                  </h3>
                  
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="footerEnabled"
                      checked={formData.footerEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, footerEnabled: e.target.checked }))}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="footerEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Incluir rodapé
                    </label>
                  </div>

                  {formData.footerEnabled && (
                    <div className="space-y-4 pl-6 border-l-2 border-orange-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Texto do Rodapé
                        </label>
                        <input
                          type="text"
                          value={formData.footerText}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo do Rodapé (URL)
                        </label>
                        <input
                          type="url"
                          value={formData.footerLogo}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerLogo: e.target.value }))}
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Altura (px)
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="150"
                          value={formData.footerHeight}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerHeight: parseInt(e.target.value) }))}
                          className="crm-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Configurações de Índice */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Type className="w-5 h-5 mr-2 text-indigo-500" />
                  Índice
                </h3>
                
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="indexEnabled"
                    checked={formData.indexEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, indexEnabled: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="indexEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Incluir índice na proposta
                  </label>
                </div>

                {formData.indexEnabled && (
                  <div className="pl-6 border-l-2 border-indigo-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título do Índice
                    </label>
                    <input
                      type="text"
                      value={formData.indexTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, indexTitle: e.target.value }))}
                      className="crm-input"
                    />
                  </div>
                )}
              </div>

              {/* Seções */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-purple-500" />
                    Seções da Proposta
                  </h3>
                  <button
                    type="button"
                    onClick={addSection}
                    className="crm-btn crm-btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Seção
                  </button>
                </div>

                <div className="space-y-4">
                  {normalizeTemplateSections(formData.sections, formData.type).map((section, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 crm-panel-muted">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => updateSection(index, 'enabled', e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex-1">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(index, 'title', e.target.value)}
                          className="crm-input"
                          placeholder="Título da seção"
                        />
                      </div>
                      
                      <div className="w-20">
                        <input
                          type="number"
                          min="0"
                          value={section.order}
                          onChange={(e) => updateSection(index, 'order', parseInt(e.target.value))}
                          className="crm-input"
                          placeholder="Ordem"
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="crm-btn crm-btn-ghost p-2 text-red-700 dark:text-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configurações de Estilo */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Palette className="w-5 h-5 mr-2 text-pink-500" />
                  Configurações de Estilo
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor Primária
                    </label>
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-full h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor Secundária
                    </label>
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-full h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fonte
                    </label>
                    <select
                      value={formData.fontFamily}
                      onChange={(e) => setFormData(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="crm-input"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Georgia">Georgia</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tamanho da Fonte
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="16"
                      value={formData.fontSize}
                      onChange={(e) => setFormData(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                      className="crm-input"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-blue-500/20">
                <button
                  type="button"
                  onClick={resetForm}
                  className="crm-btn crm-btn-secondary"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                >
                  <FileText className="w-4 h-4" />
                  {editingTemplate ? 'Atualizar' : 'Criar'} Template
                </button>
              </div>
            </form>
      </Modal>

      {/* Modal de Preview */}
      <Modal
        isOpen={!!showPreview && !!previewTemplate}
        onClose={() => setShowPreview(false)}
        title={previewTemplate ? `Preview: ${previewTemplate.name}` : 'Preview'}
      >
        {previewTemplate && (
          <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl">
            <ProposalTemplatePreview template={previewTemplate} />
          </div>
        )}
      </Modal>

      {/* Tabela de Templates */}
      <ModernTable
        title="Lista de Templates"
        data={Array.isArray(templates) ? templates.filter(template => 
          !searchTerm || 
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
        ) : []}
        columns={[
          {
            key: 'name',
            label: 'Template',
            render: (template) => (
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-purple-500 mr-2" />
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {template.description || 'Sem descrição'}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'features',
            label: 'Recursos',
            render: (template) => (
              <div className="flex flex-wrap gap-1">
                {template.coverEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    <Image className="w-3 h-3 mr-1" />
                    Capa
                  </span>
                )}
                {template.headerEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    <Layout className="w-3 h-3 mr-1" />
                    Cabeçalho
                  </span>
                )}
                {template.footerEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                    <Layout className="w-3 h-3 mr-1" />
                    Rodapé
                  </span>
                )}
                {template.indexEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                    <Type className="w-3 h-3 mr-1" />
                    Índice
                  </span>
                )}
              </div>
            )
          },
          {
            key: 'sections',
            label: 'Seções',
            render: (template) => (
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {normalizeTemplateSections(template.sections, template.type).filter(s => s.enabled).length} seções ativas
              </div>
            )
          },
          {
            key: 'style',
            label: 'Estilo',
            render: (template) => (
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300 dark:border-blue-500/30"
                  style={{ backgroundColor: template.primaryColor }}
                ></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">{template.fontFamily}</span>
              </div>
            )
          },
          {
            key: 'status',
            label: 'Status',
            render: (template) => (
              <div className="flex items-center gap-2">
                {template.isActive ? (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    Inativo
                  </span>
                )}
                {template.isDefault && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Padrão
                  </span>
                )}
              </div>
            )
          }
        ]}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onView={handlePreview}
        onEdit={(template) => {
          const normalizedTemplate = normalizeTemplate(template);
          setEditingTemplate(normalizedTemplate);
          setFormData(normalizedTemplate);
          setShowForm(true);
        }}
        customActions={[
          {
            label: 'Preview',
            icon: Eye,
            onClick: handlePreview
          },
          {
            label: 'Duplicar',
            icon: Copy,
            onClick: handleDuplicate
          },
          {
            label: 'Definir Padrão',
            icon: Star,
            onClick: handleSetDefault,
            condition: (template) => !template.isDefault
          },
          {
            label: 'Remover Padrão',
            icon: StarOff,
            onClick: handleSetDefault,
            condition: (template) => template.isDefault
          },
          {
            label: 'Deletar',
            icon: Trash2,
            onClick: handleDelete,
            condition: (template) => !template.isDefault,
            className: 'text-red-600 hover:text-red-800'
          }
        ]}
        emptyState={
          <div>
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum template encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Comece criando seu primeiro template de proposta</p>
          </div>
        }
      />
    </div>
  );
};

export default TemplatesPropostas;
