// Lockstep monkey test: drives old and new app with identical seeded random actions and compares DOM + canvases each step.
const { chromium } = require('playwright');
const [oldUrl,newUrl,seedArg,stepsArg,mockArg,startExpr]=process.argv.slice(2);const fs=require('fs');const MOCK=mockArg&&mockArg!=='none'?mockArg:null;
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const initScript=`(()=>{let s=12345;Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  const RD=Date;const T0=new RD('2026-06-15T15:00:00Z').getTime();class FD extends RD{constructor(...a){if(a.length)super(...a);else super(T0);}static now(){return T0;}};window.Date=FD;
  window.__alerts=[];window.alert=m=>{window.__alerts.push('A:'+m)};window.confirm=m=>{window.__alerts.push('C:'+m);return true};window.prompt=(m,d)=>{window.__alerts.push('P:'+m);return d||'7'};
  window.open=()=>null;})();`;
const snap=()=>{
  const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const els=[...document.querySelectorAll('[onclick],button,select,input,textarea,canvas[id]')].filter(e=>vis(e)&&!e.disabled&&e.type!=='file'&&!e.closest('#modeBtn_photo,#photoEntryPage,#simplePhotoNotice,#hbhPhotoNotice,[onclick="startPhotoRound()"]'));
  const sig=els.map(e=>e.tagName+'#'+e.id+'|'+(e.getAttribute('onclick')||'')+'|'+(e.type||'')).join('\n');
  let raw=document.body.innerHTML;document.querySelectorAll('#modeBtn_photo,#photoEntryPage,#simplePhotoNotice,#hbhPhotoNotice,[onclick="startPhotoRound()"]').forEach(n=>{raw=raw.replace(n.outerHTML,'');});let html=raw.replace(/<(style|script)[\s\S]*?<\/\1>/g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ').replace(/> </g,'><').trim().replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g,'IMG').replace(/assets\/[\w\/.-]+\.(png|jpg)/g,'IMG').replace(/S\.currentStudentId/g,'_currentStudentId').replace(/S\.coachCombShots/g,'window._coachCombShots');
  const vals=[...document.querySelectorAll('input,select,textarea')].filter(e=>!e.closest('#modeBtn_photo,#photoEntryPage,#simplePhotoNotice,#hbhPhotoNotice,[onclick="startPhotoRound()"]')).map(e=>e.id+'='+e.value+(e.checked?'*':'')).join('|');
  const cv=[...document.querySelectorAll('canvas')].map(c=>{try{let h=0;const d=c.toDataURL();for(let i=0;i<d.length;i+=7)h=(h*31+d.charCodeAt(i))|0;return c.id+':'+c.width+'x'+c.height+':'+h;}catch(e){return c.id+':ERR'}}).join('|');
  const al=window.__alerts.join('||')+'##'+JSON.stringify(window.__DBLOG||[]);window.__alerts=[];if(window.__DBLOG)window.__DBLOG.length=0;
  return {n:els.length,sig,html,vals,cv,al,page:(document.querySelector('.page.active')||{}).id};
};
const act=([i,kind,val])=>{
  const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const els=[...document.querySelectorAll('[onclick],button,select,input,textarea,canvas[id]')].filter(e=>vis(e)&&!e.disabled&&e.type!=='file'&&!e.closest('#modeBtn_photo,#photoEntryPage,#simplePhotoNotice,#hbhPhotoNotice,[onclick="startPhotoRound()"]'));
  const e=els[i];if(!e)return 'none';
  const d=e.tagName+'#'+e.id+' '+(e.getAttribute('onclick')||e.textContent||'').trim().slice(0,50);
  if(e.tagName==='SELECT'){if(e.options.length){e.selectedIndex=Math.floor(val*e.options.length);e.dispatchEvent(new Event('change',{bubbles:true}));}}
  else if(e.tagName==='CANVAS'){const r=e.getBoundingClientRect();const o={bubbles:true,clientX:r.left+r.width*val,clientY:r.top+r.height*((val*7)%1)};e.dispatchEvent(new MouseEvent('mousedown',o));e.dispatchEvent(new MouseEvent('mouseup',o));e.dispatchEvent(new MouseEvent('click',o));}
  else if((e.tagName==='INPUT'&&!['button','submit','checkbox','radio','range'].includes(e.type))||e.tagName==='TEXTAREA'){
    const v=e.type==='date'?'2026-05-1'+Math.floor(val*9):e.type==='number'||e.inputMode==='numeric'||e.inputMode==='decimal'?String(Math.floor(val*val*300)):(val<0.5?String(Math.floor(val*400)):'Test '+Math.floor(val*100));
    e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));e.blur();}
  else if(e.type==='range'){e.value=String(+e.min+(e.max-e.min)*val);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
  else e.click();
  return d;
};
(async()=>{
  const b=await chromium.launch();const R=rng(+seedArg||1);const steps=+stepsArg||200;
  async function open(url){const ctx=await b.newContext({viewport:{width:390,height:844}});
    await ctx.route(/supabase\.co|emailjs|youtube|ytimg|google\.com\/|doubleclick/,r=>r.abort());
    if(MOCK){await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(__dirname+'/mock-supabase.js','utf8')}));}
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>{if(!/border is not defined/.test(e.message))errs.push(e.message);}); // old-app export typo, fixed in v6
    await p.addInitScript(initScript);if(MOCK){const fx=fs.existsSync(__dirname+'/fixture-rounds.json')?fs.readFileSync(__dirname+'/fixture-rounds.json','utf8'):'[]';const fc=fs.existsSync(__dirname+'/fixture-combines.json')?fs.readFileSync(__dirname+'/fixture-combines.json','utf8'):'[]';await p.addInitScript('window.__MOCK='+JSON.stringify({role:MOCK,signedIn:true})+';window.__FIXTURE_ROUNDS='+fx+';window.__FIXTURE_COMBINES='+fc+';');}await p.goto(url,{waitUntil:'load'});await p.waitForTimeout(1200);
    await p.evaluate(()=>{if(window.Chart){Chart.defaults.animation=false;}});
    if(startExpr)await p.evaluate(startExpr);await p.waitForTimeout(300);return {p,errs};}
  const A=await open(oldUrl),B=await open(newUrl);const trail=[];let fails=0;const pages=new Set();
  for(let k=0;k<steps;k++){
    const [sa,sb]=await Promise.all([A.p.evaluate(snap),B.p.evaluate(snap)]);
    pages.add(sa.page);
    const bad=['n','sig','html','vals','cv','al','page'].filter(f=>sa[f]!==sb[f]);
    if(bad.length||A.errs.length!==B.errs.length){fails++;console.log('MISMATCH step',k,'page',sa.page,'/',sb.page,'fields',bad.join(','),'errs',A.errs.slice(-2),B.errs.slice(-2));console.log(' trail:',trail.slice(-6).join(' > '));
      for(const f of bad){const x=sa[f],y=sb[f];let i=0;while(i<x.length&&x[i]===y[i])i++;console.log('  '+f+' old: …'+String(x).slice(Math.max(0,i-80),i+160).replace(/\n/g,'⏎'));console.log('  '+f+' new: …'+String(y).slice(Math.max(0,i-80),i+160).replace(/\n/g,'⏎'));}
      break;}
    if(sa.n===0){console.log('dead end at',k);break;}
    const a=[Math.floor(R()*sa.n),0,R()];
    const [da]=await Promise.all([A.p.evaluate(act,a),B.p.evaluate(act,a)]);trail.push(da);
    await Promise.all([A.p.waitForTimeout(120),B.p.waitForTimeout(120)]);
  }
  console.log('seed',seedArg,'steps',trail.length,'fails',fails,'pages',[...pages].join(','),'olderrs',A.errs.length,'newerrs',B.errs.length, B.errs.slice(0,3));
  await b.close();process.exit(fails?1:0);
})();
