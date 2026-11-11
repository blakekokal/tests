const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();
const gen=`(async(fns)=>{const out=[];const hcps=['pro','0','5','10','15','20','25','30','bogus'];const lies=['TEE','FAIRWAY','GREEN','ROUGH','LEFT ROUGH','RIGHT ROUGH','MISS LEFT','MISS LONG','SAND','GS BUNKER','FW BUNKER','RECOVERY','WATER','xyz'];
 for(const h of hcps){for(const l of lies)for(let d=0;d<=650;d+=(d<60?1:7))out.push(fns.getExpectedStrokes(d,l,h));for(let f=-1;f<=120;f+=0.5)out.push(fns.getExpectedPutts(f,h));}
 const tables=JSON.stringify([fns.sgPuttingData,fns.sgTeeData,fns.sgFairwayData,fns.sgRoughData,fns.sgSandData,fns.sgRecoveryData]);return {n:out.length,vals:JSON.stringify(out),tables};})`;
const A=await b.newPage();await A.goto('http://localhost:8801/index.html',{waitUntil:'load'});await A.waitForTimeout(800);
const a=await A.evaluate(gen+'({getExpectedStrokes,getExpectedPutts,sgPuttingData,sgTeeData,sgFairwayData,sgRoughData,sgSandData,sgRecoveryData})');
const B=await b.newPage();await B.goto('http://localhost:8803/index.html',{waitUntil:'load'});await B.waitForTimeout(800);
const r=await B.evaluate(`(async()=>{const c=await import('/js/sg/calc.js');const t=await import('/js/sg/tables.js');return await ${gen}({...c,...t});})()`);
console.log('cases',a.n,r.n,'values identical:',a.vals===r.vals,'tables identical:',a.tables===r.tables,'table bytes',a.tables.length);
await b.close();})();
