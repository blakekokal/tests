// Screenshot every .page in old and new app (signed out) and diff pixel-for-pixel.
const { chromium } = require('playwright');const fs=require('fs');
(async()=>{
  const [oldUrl,newUrl,outDir]=process.argv.slice(2);fs.mkdirSync(outDir,{recursive:true});
  const b=await chromium.launch();
  async function open(url){const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errs=[];
    p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200));});
    p.on('dialog',d=>d.dismiss());
    await p.goto(url,{waitUntil:'networkidle'});await p.waitForTimeout(1500);return {p,errs};}
  const A=await open(oldUrl),B=await open(newUrl);
  console.log('old errs',A.errs);console.log('new errs',B.errs);
  const ids=await A.p.evaluate(()=>[...document.querySelectorAll('.page')].map(e=>e.id));
  const idsB=await B.p.evaluate(()=>[...document.querySelectorAll('.page')].map(e=>e.id));
  console.log('pages',ids.length,idsB.length);
  let diff=0;
  for(const id of ids){
    const bufs=[];
    for(const X of [A,B]){
      await X.p.evaluate(id=>{document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');},id);
      await X.p.waitForTimeout(150);bufs.push(await X.p.screenshot());}
    if(!bufs[0].equals(bufs[1])){diff++;console.log('DIFF',id);fs.writeFileSync(outDir+'/'+id+'-old.png',bufs[0]);fs.writeFileSync(outDir+'/'+id+'-new.png',bufs[1]);}
  }
  console.log('static page diffs:',diff,'of',ids.length,'| new errs after',B.errs.length);
  await b.close();
})();
