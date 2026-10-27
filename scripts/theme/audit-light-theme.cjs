// Run against a local dev server. All API responses are synthetic.
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
process.chdir(path.resolve(__dirname, '../..'));
const baseUrl = process.env.THEME_AUDIT_URL || 'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined)});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{localStorage.setItem('crm-theme','light');localStorage.setItem('token','theme-fixture');localStorage.setItem('user',JSON.stringify({id:'fixture',name:'Revisão Visual',role:'MASTER',accessB2B:true,accessB2G:true}));});
 const partner={id:'brand1',nome:'Trend Micro',contato:'Maria Silva',email:'maria@exemplo.com.br',telefone:'(11) 99999-9999',status:'ATIVO',categorias:['Segurança','Backup'],distribuidorIds:['dist1'],produtosServicos:['Antivírus','EDR'],portalPartnerUrl:'https://partner.exemplo.com',portalPartnerLogin:'contato@exemplo.com'};
 const registry={fornecedores:[partner],distribuidores:[{...partner,id:'dist1',nome:'WDC Networks',marcas:['Acronis','Sophos']}],oportunidades:[{id:'ro1',titulo:'Modernização de rede',cliente:'Cliente Exemplo',numeroOportunidade:'RO123',status:'EM_ANALISE',prioridade:'MEDIUM',valorEstimado:1500000,distribuidorIds:['dist1'],fornecedorIds:['brand1'],observacoes:'Projeto para modernização da infraestrutura.',origem:'B2B',dataValidade:'2027-03-01'}]};
 await page.route('**/api/**', async route=>{
 const url=new URL(route.request().url());
 if(!url.pathname.startsWith('/api/'))return route.continue();
 let body=[];
 if(url.pathname.endsWith('/auth/me'))body={user:{id:'fixture',name:'Revisão Visual',role:'MASTER',accessB2B:true,accessB2G:true}};
 else if(url.pathname.includes('prevendas-cadastros'))body=registry;
 else if(url.pathname.includes('settings'))body={};
 await route.fulfill({json:body});
 });
 page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 const fs=require('fs');
 const routes=[...new Set([...fs.readFileSync('apps/web/src/App.jsx','utf8').matchAll(/path="([^"*:]+)"/g)].map(m=>'/'+m[1].replace(/^\//,'')))].filter(r=>!['/','/login','/checkout','/setup'].includes(r));
 const reports=[];
 for(const route of routes){
  const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  await page.goto(baseUrl+route,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2200);
  const contrast=await page.evaluate(()=>{
   const rgb=s=>{let m=s.match(/[\d.]+/g);return m ? m.map(Number):[0,0,0,0]};
   const blend=(a,b)=>{const op=a[3]??1;return a.slice(0,3).map((v,i)=>v*op+b[i]*(1-op))};
   const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
   const fails=[];
   for(const el of document.querySelectorAll('body *')){
    if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const rect=el.getBoundingClientRect();if(!rect.width||!rect.height||el.closest('[disabled]'))continue;
    const st=getComputedStyle(el);if(st.visibility==='hidden'||st.display==='none'||!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
    const cx=Math.max(0,Math.min(innerWidth-1,rect.x+rect.width/2)),cy=Math.max(0,Math.min(innerHeight-1,rect.y+rect.height/2)),hit=document.elementFromPoint(cx,cy);if(rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth&&hit&&!el.contains(hit)&&!hit.contains(el))continue;
    let backgrounds=[[255,255,255]],chain=[],node=el,skip=false;
    while(node){const cs=getComputedStyle(node);if(cs.backgroundImage.includes('url(')||Number(cs.opacity)<.98){skip=true;break}chain.push({color:cs.backgroundColor,gradient:cs.backgroundImage});node=node.parentElement;}
    if(skip||[...function*(n){while(n){yield n;n=n.parentElement}}(el.parentElement)].some(n=>getComputedStyle(n).overflow==='hidden'&&n.getBoundingClientRect().height===0))continue;
    for(const c of chain.reverse()){backgrounds=backgrounds.map(bg=>blend(rgb(c.color),bg));const stops=c.gradient.match(/rgba?\([^)]*\)/g)||[];if(stops.length)backgrounds=backgrounds.flatMap(bg=>stops.map(stop=>blend(rgb(stop),bg))).slice(0,64);}
    const samples=backgrounds.map(bg=>{const fg=blend(rgb(st.color),bg),l1=luminance(fg),l2=luminance(bg);return {bg,ratio:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}}).sort((a,b)=>a.ratio-b.ratio);const {bg,ratio}=samples[0];
    const large=parseFloat(st.fontSize)>=24||(parseFloat(st.fontSize)>=18.66&&Number(st.fontWeight)>=700);
    if(ratio<(large?3:4.5))fails.push({text:el.textContent.trim().slice(0,70),ratio:Math.round(ratio*100)/100,color:st.color,bg,classes:el.className});
   }
   return fails;
  });
  reports.push({route,url:page.url(),errors,contrast});
  console.log(route,'errors='+errors.length,'contrast='+contrast.length);
  page.off('pageerror',onError);
 }
 fs.writeFileSync(path.join(os.tmpdir(), 'light-theme-gradient-audit.json'),JSON.stringify(reports,null,2));
 await browser.close();
 const failures=reports.filter(r=>r.errors.length||r.contrast.length);
 console.log(`${reports.length} routes; ${failures.length} routes with failures.`);
 if(failures.length)process.exitCode=1;
})();
