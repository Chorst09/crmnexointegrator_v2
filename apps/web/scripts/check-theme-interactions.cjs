const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("fs");
fs.mkdirSync("/tmp/double-theme-audit",{recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.THEME_BROWSER_PATH || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined)});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const user={id:"theme-review",name:"Revisão de Tema",email:"theme-review@example.invalid",role:"MASTER",actualRole:"MASTER",accessB2B:true,accessB2G:true,accessPreSales:true,accessManagement:true,accessAutomation:true};
await context.addInitScript(({user})=>{localStorage.setItem("token","local-theme-fixture");localStorage.setItem("user",JSON.stringify(user));if(!localStorage.getItem("crm-theme"))localStorage.setItem("crm-theme","light");},{user});
await context.route("**/api/**",async route=>{
 const p=new URL(route.request().url()).pathname;
 if(!p.startsWith("/api/"))return route.continue();
 let body=[];
 if(p.endsWith("/auth/me"))body={user};
 else if(p.endsWith("/settings"))body={appName:"Double CRM"};
 else if(p.includes("/dashboard"))body={totalOpportunities:0,totalValue:0,wonValue:0,conversionRate:0,opportunitiesByStage:[],opportunitiesByMonth:[],revenueByMonth:[],recentActivities:[],topSellers:[],stats:{},pipeline:[],monthlyRevenue:[],opportunities:[],companies:[],activities:[]};
 else if(p.includes("/b2g-licitacoes/buscar"))body={data:[],sources:[],total:0};
 else if(p.includes("/health"))body={status:"ok"};
 await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
await context.route(/https:\/\/(?:fonts|www\.google|identitytoolkit)/,route=>route.abort());
const routes=process.env.THEME_INTERACTION_ROUTES ? process.env.THEME_INTERACTION_ROUTES.split(",") : ["/empresas","/oportunidades","/b2g-dashboard","/atividades","/administracao","/calculadoras"];
const results=[];
const page=await context.newPage();let errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("requestfailed",r=>{if(r.url().includes("127.0.0.1"))console.log("NETWORK",r.url(),r.failure()?.errorText)});
await page.goto((process.env.THEME_BASE_URL || "http://127.0.0.1:5174")+"/login",{waitUntil:"networkidle"});
await page.getByRole('button',{name:'Alternar tema',exact:true}).click();
await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
await page.reload({waitUntil:'networkidle'});
assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
await page.evaluate(()=>localStorage.setItem('crm-theme','system'));
await page.reload({waitUntil:'networkidle'});
await page.emulateMedia({colorScheme:'dark'});
await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
await page.emulateMedia({colorScheme:'light'});
await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
console.log('Theme toggle, persistence, and OS changes OK');
await page.goto((process.env.THEME_BASE_URL || "http://127.0.0.1:5174")+"/dashboard",{waitUntil:'networkidle'});
await page.getByRole('button',{name:'Recolher módulos',exact:true}).click();
await page.waitForTimeout(350);
assert((await page.locator('aside').boundingBox()).width<100);
await page.reload({waitUntil:'networkidle'});
assert((await page.locator('aside').boundingBox()).width<100);
await page.getByRole('button',{name:'Expandir módulos',exact:true}).click();
await page.getByRole('button',{name:'Alternar tema',exact:true}).click();
await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
await page.getByRole('button',{name:'Alternar tema',exact:true}).click();
await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
assert.equal(errors.length,0,errors.join('\n'));
console.log('Sidebar and theme changes with mounted charts OK');
for(const route of routes){
 errors=[];
 await page.goto((process.env.THEME_BASE_URL || "http://127.0.0.1:5174")+route,{waitUntil:"networkidle",timeout:60000});
 await page.waitForTimeout(200);
 for(const theme of ["light","dark"]){
  await page.evaluate(theme=>{localStorage.setItem("crm-theme",theme);},theme);
  await page.reload({waitUntil:"networkidle"});
  await page.waitForTimeout(350);
  if(route==='/administracao')await page.getByRole('button',{name:/Usuários e Acessos/}).click();
  const label={"/empresas":"Nova Empresa","/oportunidades":"Nova Oportunidade","/b2g-dashboard":"Nova Licitação","/atividades":"Nova Atividade","/administracao":"Novo Usuário","/calculadoras":"Venda (Sales)"}[route];
  const control=page.getByRole('button',{name:label,exact:route!=="/calculadoras"}).first();
  await control.click();
  await page.waitForTimeout(400);
  if(!["/b2g-dashboard","/calculadoras"].includes(route))assert.equal(await page.locator('[role="dialog"]').count(),1);
  console.log("OPEN",route,theme);
  const surfaces=await page.evaluate(theme=>{
   const result=[];
   for(const el of document.querySelectorAll("body *")){
    if(el.closest(".proposal-view")||el.tagName==="CANVAS"||el.tagName==="SVG")continue;
    const r=el.getBoundingClientRect();if(r.width*r.height<18000||r.width<130||r.height<65)continue;
    const s=getComputedStyle(el),n=s.backgroundColor.match(/[\d.]+/g)?.map(Number);
    if(!n||n.length<3||(n[3]??1)<.85)continue;
    const [red,g,b]=n,lum=(red*.2126+g*.7152+b*.0722)/255;
    if((theme==="light"&&lum<.34)||(theme==="dark"&&lum>.65))result.push({tag:el.tagName,cls:el.className.toString().slice(0,180),bg:s.backgroundColor,text:el.textContent.slice(0,55),area:Math.round(r.width*r.height)});
   }return result;
  },theme);
  results.push({route,theme,url:new URL(page.url()).pathname,errors:[...errors],surfaces});
  if(true)await page.screenshot({path:"/tmp/double-theme-audit/"+"modal-"+route.slice(1)+"-"+theme+".png"});
 }
 fs.writeFileSync("/tmp/double-theme-audit/modal-results.json",JSON.stringify(results,null,2));
 console.log(route,errors.length?errors.join(" | "):"OK",results.slice(-2).map(r=>r.theme+":"+r.surfaces.length).join(" "));
}
fs.writeFileSync("/tmp/double-theme-audit/modal-results.json",JSON.stringify(results,null,2));await browser.close();
assert.equal(results.filter(r=>r.errors.length||r.surfaces.length).length,0,JSON.stringify(results.filter(r=>r.errors.length||r.surfaces.length),null,2));
})();
