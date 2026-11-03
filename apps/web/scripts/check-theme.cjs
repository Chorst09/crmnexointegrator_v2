// Run against the local frontend with deterministic, read-only API fixtures.
// THEME_BASE_URL and THEME_BROWSER_PATH can select a preview and installed browser.
const {chromium}=require('playwright');
const path=require('path');
const assert=require('node:assert/strict');
const output=process.env.THEME_AUDIT_OUTPUT || '/tmp/double-theme-audit';


const fs=require("fs");
fs.mkdirSync(output,{recursive:true});
const baseURL=process.env.THEME_BASE_URL || "http://127.0.0.1:5174";
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
const appSource=fs.readFileSync(path.resolve(__dirname,'../src/App.jsx'),'utf8');
const discoveredRoutes=[...new Set([...appSource.matchAll(/path=["']([^"']+)["']/g)].map(m=>m[1]).filter(p=>!p.includes('*')&&!p.includes(':')).map(p=>'/'+p.replace(/^\//,'')))];
const routes=process.env.THEME_AUDIT_ROUTES ? process.env.THEME_AUDIT_ROUTES.split(',') : discoveredRoutes;
const results=[];
const page=await context.newPage();let errors=[];page.on("pageerror",e=>errors.push(e.message));
for(const route of routes){
 errors=[];
 await page.goto(baseURL+route,{waitUntil:"networkidle",timeout:60000});
 await page.waitForTimeout(350);
 for(const theme of ["light","dark"]){
  await page.evaluate(theme=>{localStorage.setItem("crm-theme",theme);},theme);
  await page.reload({waitUntil:"networkidle"});
  await page.waitForTimeout(350);
  const surfaces=await page.evaluate(theme=>{
   const result=[];
   for(const el of document.querySelectorAll("body *")){
    if(el.closest(".proposal-view, .proposal-document-page")||el.tagName==="CANVAS"||el.tagName==="SVG")continue;
    const r=el.getBoundingClientRect();if(r.width*r.height<18000||r.width<130||r.height<65)continue;
    const s=getComputedStyle(el);
    const colors=[s.backgroundColor,...(s.backgroundImage.match(/rgba?\([^)]*\)/g)||[])];
    const incompatible=colors.find(color=>{
      const n=color.match(/[\d.]+/g)?.map(Number);
      if(!n||n.length<3||(n[3]??1)<.65)return false;
      // Empty saturated overlays are chart/brand decoration, not UI surfaces.
      if(!el.textContent.trim()&&Math.max(...n.slice(0,3))-Math.min(...n.slice(0,3))>60)return false;
      if(Number(s.opacity)*(n[3]??1)<.65)return false;
      const [red,g,b]=n,lum=(red*.2126+g*.7152+b*.0722)/255;
      return (theme==="light"&&lum<.34)||(theme==="dark"&&lum>.65);
    });
    if(incompatible)result.push({tag:el.tagName,cls:el.className.toString().slice(0,180),bg:incompatible,text:el.textContent.slice(0,55),area:Math.round(r.width*r.height)});
   }return result;
  },theme);
  results.push({route,theme,url:new URL(page.url()).pathname,errors:[...errors],surfaces});
  if(["/b2g-dashboard","/b2g-buscar-editais","/dashboard","/calculadoras","/projetos"].includes(route))await page.screenshot({path:output+"/"+route.slice(1)+"-"+theme+".png"});
 }
 fs.writeFileSync(output+"/browser-results.json",JSON.stringify(results,null,2));
 console.log(route,errors.length?errors.join(" | "):"OK",results.slice(-2).map(r=>r.theme+":"+r.surfaces.length).join(" "));
}
fs.writeFileSync(output+"/browser-results.json",JSON.stringify(results,null,2));await browser.close();
const failures=results.filter(r=>r.errors.length||r.surfaces.length||r.url==='/login'&&r.route!=='/login');
assert.equal(failures.length,0,JSON.stringify(failures,null,2));
console.log(`Verified ${routes.length} routes in both themes.`);
})();
