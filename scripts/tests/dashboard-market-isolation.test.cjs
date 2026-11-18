const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {StaticRouter}=require('react-router-dom/server');

function matches(row,where) {
  if(!row)return false;
  return Object.entries(where).every(([key,condition])=>{
    if(key==='OR')return condition.some(item=>matches(row,item));
    if(key==='AND')return (Array.isArray(condition)?condition:[condition]).every(item=>matches(row,item));
    if(key==='NOT')return !matches(row,condition);
    const value=row[key];
    if(condition===null)return value==null;
    if(typeof condition!=='object')return value===condition;
    if('not' in condition)return value!==condition.not;
    if('startsWith' in condition)return typeof value==='string' && value.startsWith(condition.startsWith);
    if('some' in condition)return Array.isArray(value) && value.some(item=>matches(item,condition.some));
    return matches(value,condition);
  });
}
function fixture() {
  const privateCompany={id:'private',name:'Cliente privado',clientType:'B2B',tenantCompanyId:'tenant-1'};
  const publicCompany={id:'public',name:'Órgão público',clientType:'B2G',tenantCompanyId:'tenant-1'};
  const otherCompany={id:'other',name:'Outra empresa',clientType:'B2B',tenantCompanyId:'tenant-2'};
  const opportunities=[
    {id:'private',number:null,b2gStage:null,company:privateCompany,ownerId:'owner-1',tenantCompanyId:'tenant-1'},
    {id:'public',number:'B2G-1',b2gStage:'ANALISE',company:publicCompany,ownerId:'owner-1',tenantCompanyId:'tenant-1'},
    {id:'legacy-public',number:'B2G-2',b2gStage:null,company:privateCompany,ownerId:'owner-1',tenantCompanyId:'tenant-1'},
    {id:'other-owner',number:null,b2gStage:null,company:privateCompany,ownerId:'owner-2',tenantCompanyId:'tenant-1'},
    {id:'other-tenant',number:null,b2gStage:null,company:otherCompany,ownerId:'owner-1',tenantCompanyId:'tenant-2'}
  ];
  const companies=[privateCompany,publicCompany,otherCompany].map(company=>({...company,opportunities:opportunities.filter(item=>item.company.id===company.id)}));
  const activities=opportunities.map(item=>({id:item.id,opportunityId:item.id,opportunity:item,company:item.company,assignedToId:item.ownerId,tenantCompanyId:item.tenantCompanyId}));
  activities.push({id:'unclassified',opportunityId:null,company:null,assignedToId:'owner-1',tenantCompanyId:'tenant-1'});
  const contracts=opportunities.map(item=>({id:item.id,opportunityId:item.id,opportunity:item,company:companies.find(company=>company.id===item.company.id)}));
  const proposals=opportunities.map(item=>({id:item.id,opportunity:item}));
  const source={opportunity:opportunities,company:companies,activity:activities,contract:contracts,proposal:proposals};
  const queries=[];
  const prisma=Object.fromEntries(Object.entries(source).map(([name,rows])=>[name,{findMany:async query=>{queries.push({name,query});return rows.filter(row=>matches(row,query.where));}}]));
  return {prisma,queries};
}
for(const root of ['apps/api','backend']) {
  test(`${root}: private and public overview queries remain disjoint with tenant and owner scope`,async()=>{
    const {buildMarketDashboardOverview:build}=await import(`../../${root}/lib/marketDashboardOverview.mjs`);
    const privateDb=fixture(),publicDb=fixture();
    const privateResult=await build({prisma:privateDb.prisma,user:{id:'owner-1',role:'SELLER'},market:'B2B',tenantCompanyId:'tenant-1'});
    const publicResult=await build({prisma:publicDb.prisma,user:{id:'owner-1',role:'SELLER'},market:'B2G',tenantCompanyId:'tenant-1'});
    assert.deepEqual(privateResult.data.opportunitiesB2B.map(item=>item.id),['private']);
    assert.deepEqual(publicResult.data.opportunitiesB2G.map(item=>item.id),['public','legacy-public']);
    assert.equal(privateResult.data.opportunitiesB2G,undefined);
    assert.equal(publicResult.data.opportunitiesB2B,undefined);
    assert.deepEqual(privateResult.data.activities.map(item=>item.id),['private']);
    assert.deepEqual(publicResult.data.activities.map(item=>item.id),['public','legacy-public']);
    assert.ok(privateResult.data.activities.every(item=>item.clientType==='B2B'));
    assert.ok(publicResult.data.activities.every(item=>item.clientType==='B2G'));
    assert.deepEqual(privateResult.data.contracts.map(item=>item.id),['private']);
    assert.deepEqual(privateResult.data.proposals.map(item=>item.id),['private']);
    assert.ok(privateDb.queries.every(({query})=>JSON.stringify(query.where).includes('tenant-1')));
    assert.ok(privateDb.queries.every(({query})=>JSON.stringify(query.where).includes('owner-1')));
  });
  test(`${root}: invalid markets and unauthenticated or explicitly denied scopes fail closed`,async()=>{
    const {buildMarketDashboardOverview:build}=await import(`../../${root}/lib/marketDashboardOverview.mjs`);
    for(const options of [{market:'ALL',user:{role:'MASTER'}},{market:'B2B',user:{}},{market:'B2G',user:{id:'x',role:'USER_B2B'}},{market:'B2B',user:{id:'x',role:'USER',accessB2B:false}}]) {
      const db=fixture();
      await assert.rejects(build({...options,prisma:db.prisma,tenantCompanyId:'tenant-1'}),error=>[400,403].includes(error.status));
      assert.equal(db.queries.length,0);
    }
  });
}

function loadComponent(file) {
  const source=esbuild.buildSync({entryPoints:[path.resolve(__dirname,'../../apps/web/src/components',file)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},external:['react','react-router-dom']}).outputFiles[0].text;
  const loaded={exports:{}};
  new Function('require','module','exports',source)(require,loaded,loaded.exports);
  return loaded.exports.default;
}
test('cards and navigation never render the opposite commercial domain',async()=>{
  const Cards=loadComponent('ExecutiveMarketCards.jsx');
  const Navigation=loadComponent('ExecutiveModuleNavigation.jsx');
  const {buildGeneralDashboardMetrics}=await import('../../apps/web/src/components/generalDashboardMetrics.mjs');
  for(const market of ['B2B','B2G']) {
    const other=market==='B2B'?'B2G':'B2B';
    const data={[`opportunities${market}`]:[],[`companies${market}`]:[],contracts:[],proposals:[],activities:[]};
    const html=renderToStaticMarkup(React.createElement(StaticRouter,{location:market==='B2B'?'/dashboard':'/b2g-dashboard'},React.createElement(React.Fragment,null,
      React.createElement(Cards,{market,data,computed:buildGeneralDashboardMetrics(data,'365000')}),
      React.createElement(Navigation,{market,access:{accessB2B:true,accessB2G:true},adminLike:true,onIntelligence:()=>{}})
    )));
    assert.ok(html.includes(market));
    assert.ok(!html.includes(other),`${market} rendered ${other}`);
    assert.equal((html.match(/class="nex-panel nex-overview-card /g)||[]).length,5);
    assert.ok(!/NaN|Infinity/.test(html));
  }
});
test('search groups and navigation destinations are isolated by dashboard route',async()=>{
  const {getDashboardMarket,getMarketSearchGroups,MARKET_NAVIGATION}=await import('../../apps/web/src/utils/dashboardMarket.mjs');
  assert.equal(getDashboardMarket('/dashboard-geral'),null);
  assert.equal(getDashboardMarket('/dashboard-b2b'),'B2B');
  assert.equal(getDashboardMarket('/b2g-dashboard'),'B2G');
  assert.ok(getMarketSearchGroups('B2B').every(([key])=>key.endsWith('B2B')));
  assert.ok(getMarketSearchGroups('B2G').every(([key])=>key.endsWith('B2G') || key==='b2g'));
  assert.ok(MARKET_NAVIGATION.B2B.every(item=>!item.route.startsWith('/b2g')));
  assert.ok(MARKET_NAVIGATION.B2G.every(item=>item.route.startsWith('/b2g')));
  assert.equal(fs.readFileSync('apps/api/lib/marketDashboardOverview.mjs','utf8'),fs.readFileSync('backend/lib/marketDashboardOverview.mjs','utf8'));
});
