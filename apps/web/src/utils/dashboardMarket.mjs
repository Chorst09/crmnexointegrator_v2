export function getDashboardMarket(pathname) {
  if(['/dashboard','/dashboard-b2b'].includes(pathname)) return 'B2B';
  if(pathname==='/b2g-dashboard') return 'B2G';
  return null;
}

export const MARKET_NAVIGATION = {
  B2B:[
    {title:'Comercial B2B',description:'Oportunidades e pipeline privado',route:'/dashboard',kind:'briefcase',tone:'blue'},
    {title:'Clientes',description:'Empresas e relacionamento B2B',route:'/empresas',kind:'building',tone:'cyan'},
    {title:'Propostas',description:'Negociações comerciais B2B',route:'/propostas',kind:'rocket',tone:'purple'},
    {title:'Agenda',description:'Atividades da operação B2B',route:'/atividades',kind:'layers',tone:'amber'}
  ],
  B2G:[
    {title:'Comercial B2G',description:'Pipeline de governo',route:'/b2g-dashboard',kind:'building',tone:'blue'},
    {title:'Órgãos',description:'Contas públicas B2G',route:'/b2g-orgaos',kind:'building',tone:'green'},
    {title:'Licitações',description:'Oportunidades e editais B2G',route:'/b2g-oportunidades',kind:'briefcase',tone:'purple'},
    {title:'Agenda',description:'Atividades da operação B2G',route:'/b2g-atividades',kind:'layers',tone:'amber'}
  ]
};

export function getMarketSearchGroups(market) {
  const groups=[['companiesB2B','Cliente B2B','/empresas'],['opportunitiesB2B','Oportunidade B2B','/oportunidades'],['companiesB2G','Órgão B2G','/b2g-leads'],['opportunitiesB2G','Oportunidade B2G','/b2g-oportunidades'],['b2g','Edital','/b2g-editais']];
  return !market ? groups : groups.filter(([key])=>market==='B2B' ? key.endsWith('B2B') : key.endsWith('B2G') || key==='b2g');
}
