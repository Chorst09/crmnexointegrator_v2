const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {StaticRouter}=require('react-router-dom/server');
const activityMarket=require('../../backend/lib/activityMarket.cjs');
const now=new Date(), today=now.toISOString(), past=new Date(now.getTime()-400*86400000).toISOString();
function loadHandler(root,prisma){
 const source=fs.readFileSync(`${root}/api/dashboard.js`,'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','return async function handler');
 return new Function('prisma','getTenantCompanyId','activityMarket',source)(prisma,user=>user.tenantCompanyId,activityMarket);
}
function project(row,select){return !select?row:Object.fromEntries(Object.entries(select).map(([key,value])=>[key,value?.select && row[key] ? project(row[key],value.select):row[key]]));}
for(const root of ['apps/api','backend']){
 test(`${root}: general dashboard supplies persisted display and financial fields and enforces owner scope`,async()=>{
  const queries=[];
  const company={id:'co',name:'Cliente real',clientType:'B2B',state:'RS',status:'ACTIVE'};
  const source={company:[company],opportunity:[{id:'op',title:'Contrato real',companyId:'co',company,ownerId:'user',owner:{id:'user',name:'Maria'},stage:'WON',value:5000,createdAt:past,updatedAt:today,actualCloseDate:today}],activity:[{id:'act',subject:'Reunião real',status:'PENDING',company,createdAt:past,dueDate:today}],contract:[{id:'ct',title:'Contrato ativo',companyId:'co',status:'ACTIVE',value:5000,createdAt:past}],proposal:[{id:'pr',title:'Proposta real',status:'SENT',totalValue:2500,createdAt:today}]};
  const prisma=new Proxy({}, {get:(_,model)=>({findMany:async query=>{queries.push({model,query});return (source[model] || []).map(row=>project(row,query.select));},count:async()=>0,findUnique:async()=>null})});
  const response=await loadHandler(root,prisma)({method:'GET',query:{type:'general'},user:{id:'user',role:'SELLER',tenantCompanyId:'tenant',accessB2G:false}});
  assert.equal(response.status,200);const payload=await response.json();
  assert.equal(payload.data.companiesB2B[0].name,'Cliente real');
  assert.equal(payload.data.opportunitiesB2B[0].company.state,'RS');
  assert.equal(payload.data.activities[0].subject,'Reunião real');
  assert.equal(payload.data.activities[0].clientType,'B2B');
  assert.equal(payload.data.contracts[0].value,5000);assert.equal(payload.data.contracts[0].status,'ACTIVE');
  assert.equal(payload.data.proposals[0].totalValue,2500);
  assert.deepEqual(payload.data.opportunitiesB2G,[]);
  assert.equal(queries.find(x=>x.model==='opportunity').query.where.ownerId,'user');
  assert.equal(queries.find(x=>x.model==='activity').query.where.assignedToId,'user');
  assert.equal(queries.find(x=>x.model==='contract').query.where.OR,undefined);
  assert.ok(!queries.find(x=>x.model==='opportunity').query.where.createdAt);
 });
 test(`${root}: module failures are reported instead of appearing as healthy zeros`,async()=>{
  const empty={findMany:async()=>[],count:async()=>0,findUnique:async()=>null};
  const prisma=new Proxy({}, {get:(_,model)=>model==='company'?{...empty,findMany:async()=>{throw Error('offline')}}:empty});
  const response=await loadHandler(root,prisma)({method:'GET',query:{type:'general'},user:{role:'MASTER'}});
  const payload=await response.json();
  assert.equal(payload.moduleHealth.find(x=>x.key==='companiesB2B').status,'error');
  assert.equal(payload.moduleHealth.find(x=>x.key==='activities').status,'ok');
 });
}
test('B2G stages, recent closures, old overdue tasks and distinct owners reconcile with the actual records',async()=>{
 const {buildGeneralDashboardMetrics:build}=await import('../../apps/web/src/components/generalDashboardMetrics.mjs');
 const c=build({opportunitiesB2B:[{id:'a',ownerId:'u1',owner:{name:'Mesmo nome'},stage:'LEAD',value:100,createdAt:today}],opportunitiesB2G:[{id:'b',ownerId:'u2',owner:{name:'Mesmo nome'},b2gStage:'HABILITACAO',stage:'LEAD',value:200,createdAt:today},{id:'c',b2gStage:'GANHO',stage:'LEAD',value:300,createdAt:past,actualCloseDate:today},{id:'d',b2gStage:'NO_GO',stage:'LEAD',value:900,createdAt:today},{id:'e',b2gStage:'HOMOLOGADO',stage:'LEAD',value:400,createdAt:today}],activities:[{id:'act',status:'PENDING',createdAt:past,dueDate:past}]},'30');
 assert.equal(c.totalPipeline,700);assert.equal(c.totalWonValue,300);assert.equal(c.monthlyWon.reduce((a,b)=>a+b,0),300);
 assert.equal(c.b2gStageBreakdown.find(x=>x.key==='HOMOLOGADO').count,1);
 assert.equal(c.overdueActivities.length,1);
 assert.equal(c.teamPerformance.filter(x=>x.name==='Mesmo nome').length,2);
 const empty=build({sellers:[{name:'Maria',_count:{opportunities:100}}]},'30');assert.equal(empty.teamPerformance.length,0);
});
test('real activity and opportunity actions lead to the correct market and ignore final activities',async()=>{
 const {activityRoute,upcomingActivities,opportunityAlerts}=await import('../../apps/web/src/utils/dashboardFlow.mjs');
 const future=new Date(Date.now()+86400000).toISOString();
 assert.equal(activityRoute({id:'x y',clientType:'B2G'}),'/b2g-atividades?activityId=x%20y');
 assert.equal(activityRoute({id:'p',clientType:'B2B'}),'/atividades?activityId=p');
 assert.deepEqual(upcomingActivities([{id:'done',status:'DONE',dueDate:future},{id:'live',status:'PENDING',dueDate:future}]).map(x=>x.id),['live']);
 const alerts=opportunityAlerts([{id:'op',title:'Real',stage:'LEAD',value:100,updatedAt:past},{id:'closed',b2gStage:'GANHO',updatedAt:past}], 'B2G');
 assert.equal(alerts.length,1);assert.equal(alerts[0].value,100);assert.ok(alerts[0].route.startsWith('/b2g-oportunidades?opportunityId=op'));
});
test('activity classification uses relations and explicit workflow metadata without crossing markets',()=>{
 const resolve=activityMarket.resolveActivityMarket;
 assert.equal(resolve({description:'[CRM_ACTIVITY_FLOW]'+JSON.stringify({sourceArea:'B2G',targetArea:'PRE_VENDAS'})}),'B2G');
 assert.equal(resolve({description:'[CRM_ACTIVITY_FLOW]'+JSON.stringify({sourceArea:'B2B'})}),'B2B');
 assert.equal(resolve({company:{clientType:'B2B'},opportunity:{number:'B2G-99'}}),'B2G');
 assert.equal(resolve({description:'unclassified'}),null);
 assert.equal(fs.readFileSync('apps/api/lib/activityMarket.cjs','utf8'),fs.readFileSync('backend/lib/activityMarket.cjs','utf8'));
});
test('general dashboard renders both real funnels and a single operational row without the old navigation cards',async()=>{
 const {buildGeneralDashboardMetrics:build}=await import('../../apps/web/src/components/generalDashboardMetrics.mjs');
 const bundle=esbuild.buildSync({entryPoints:[path.resolve('apps/web/src/components/GeneralDashboardExecutive.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},external:['react','react-router-dom']}).outputFiles[0].text;
 const mod={exports:{}};new Function('require','module','exports',bundle)(require,mod,mod.exports);
 const html=renderToStaticMarkup(React.createElement(StaticRouter,{location:'/dashboard-geral'},React.createElement(mod.exports.default,{computed:build({},'30'),data:{},user:{name:'Carlos'},access:{accessB2B:true,accessB2G:true},adminLike:true,moduleHealth:[],timeRange:'30',setTimeRange:()=>{},onRefresh:()=>{}})));
 assert.ok(html.includes('Funil Comercial B2B'));assert.ok(html.includes('Funil Comercial B2G'));
 assert.ok(!html.includes('Nossos Módulos'));assert.ok(!html.includes('Diferenciais NEXOS'));
 assert.equal((html.match(/data-section="lists"/g)||[]).length,1);assert.ok(!/NaN|Infinity/.test(html));
});
test('pre-sales dashboard reads every authorized page and refuses silent truncation',async()=>{
 const {loadPreSalesDashboardRows:load}=await import('../../apps/web/src/utils/preSalesDashboardData.mjs');
 const calls=[];const rows=await load(async page=>{calls.push(page);return {solicitacoes:[{id:String(page)}],pagination:{pages:3,total:3}}},1);
 assert.deepEqual(calls,[1,2,3]);assert.equal(rows.length,3);
 await assert.rejects(load(async()=>({solicitacoes:[],pagination:{pages:2}})));
});

for(const root of ['apps/api','backend']) {
 test(`${root}: selectors used by the dashboard exist in the actual generated Prisma model`,async()=>{
  const {createRequire}=require('node:module');
  const apiRequire=createRequire(path.resolve('apps/api/package.json'));
  const models=apiRequire('@prisma/client').Prisma.dmmf.datamodel.models;
  const byName=new Map(models.map(model=>[model.name,model]));const captured=[];
  const prisma=new Proxy({}, {get:(_,name)=>({findMany:async query=>{captured.push({name,select:query.select});return [];},count:async()=>0,findUnique:async()=>null})});
  await loadHandler(root,prisma)({method:'GET',query:{type:'general'},user:{role:'MASTER'}});
  function check(name,select){if(!select)return;const model=byName.get(name[0].toUpperCase()+name.slice(1));assert.ok(model,name);for(const [field,selection] of Object.entries(select)){if(field==='_count')continue;const info=model.fields.find(x=>x.name===field);assert.ok(info,`${model.name}.${field}`);if(selection?.select)check(info.type,selection.select);}}
  for(const item of captured)check(item.name,item.select);
 });
 test(`${root}: activity endpoint applies the requested market to real rows`,async()=>{
  let get;const router={get:(path,handler)=>{get=handler;},post:()=>{},put:()=>{},delete:()=>{}};
  const rows=[{id:'private',company:{clientType:'B2B'},description:''},{id:'public',company:{clientType:'B2G'},description:''},{id:'flow-public',description:'[CRM_ACTIVITY_FLOW]'+JSON.stringify({sourceArea:'B2G'})}];
  const prisma={activity:{findMany:async()=>rows},preSalesRequest:{findFirst:async()=>null,findUnique:async()=>null}};
  const stub=name=>name==='express'?{Router:()=>router}:name.includes('activityMarket')?activityMarket:name.includes('prisma')?{prisma}:name.includes('pre-sales-closure')?{createPreSalesClosureHandler:()=>()=>{},parseClosureFlow:()=>({})}:name.includes('permissions')?{canAccessModule:()=>false,normalizeRole:r=>r}:name.includes('access-control')?{getTenantId:()=>null}:name.includes('tenantScope')?{getTenantCompanyId:()=>null,isTenantRecordVisible:()=>true,tenantScopedWhere:()=>({})}:require(name);
  const module={exports:{}};new Function('require','module','exports',fs.readFileSync(`${root}/api/activities-simple.cjs`,'utf8'))(stub,module,module.exports);
  let payload;const response={json:value=>{payload=value;return response;},status:()=>response};
  await get({user:{role:'MASTER'},query:{clientType:'B2G'}},response);
  assert.ok(Array.isArray(payload),JSON.stringify(payload));assert.deepEqual(payload.map(row=>row.id),['public','flow-public']);
 });
}

test('financial dashboard combines seller and tenant restrictions without replacing user filters',async()=>{
 const {financialDashboardScope:scope}=require('../../backend/lib/financial-dashboard-scope.cjs');
 const seller=await scope({}, {id:'seller',role:'USER',tenantCompanyId:'tenant',email:'seller@example.test'});
 assert.deepEqual(seller.opportunity,{tenantCompanyId:'tenant',ownerId:'seller'});
 assert.deepEqual(seller.commission,{opportunity:{tenantCompanyId:'tenant'},sellerId:'seller'});
 assert.equal(seller.simulator.OR[0].createdBy,'seller');
 const admin=await scope({user:{findMany:async query=>{assert.equal(query.where.tenantCompanyId,'tenant');return [{id:'u',email:'u@example.test'}]}}},{role:'ADMIN',tenantCompanyId:'tenant'});
 assert.deepEqual(admin.opportunity,{tenantCompanyId:'tenant'});assert.equal(admin.simulator.OR[0].createdBy,'u');
 await assert.rejects(scope({},{}),error=>error.status===403);
 assert.equal(fs.readFileSync('apps/api/lib/financial-dashboard-scope.cjs','utf8'),fs.readFileSync('backend/lib/financial-dashboard-scope.cjs','utf8'));
});
