// Plays rounds in the OLD app against the mock and saves what it stored, as fixtures for later comparisons.
const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();
await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(__dirname+'/mock-supabase.js','utf8')}));
await ctx.route(/emailjs|youtube|google\.com\//,r=>r.abort());
const p=await ctx.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('ERR',e.message));
await p.addInitScript('window.__MOCK={role:"student",signedIn:true};');
await p.goto('http://localhost:8801/index.html',{waitUntil:'load'});await p.waitForTimeout(1500);
const rounds=await p.evaluate(async()=>{
  let seed=7;const R=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let rd=0;rd<6;rd++){
    goToNewRound();document.getElementById('playerName').value='Test Player';document.getElementById('courseName').value='Fixture GC '+(rd%3);
    document.getElementById('roundDate').value='2026-0'+(rd+1)+'-1'+rd;document.getElementById('roundType').value=rd%2?'Tournament':'Casual';
    document.getElementById('customHoles').value='';selectPresetHoles(rd%2?18:9);setEntryMode('shot');enterScoring();
    const n=rd%2?18:9;
    for(let h=0;h<n;h++){
      const par=[4,3,5,4,4,3,4,5,4][h%9];setPar(par);document.getElementById('holeYards').value=par===3?150+h*3:par===4?380+h*4:510+h*2;startHole();
      const pick=(arr)=>arr[Math.floor(R()*arr.length)];
      let lie;
      if(par>3){lie=pick(['FAIRWAY','FAIRWAY','LEFT ROUGH','RIGHT ROUGH','FW BUNKER']);selectLie(lie);document.getElementById('shotDistance').value=par===4?120+Math.floor(R()*70):240+Math.floor(R()*40);confirmDistance();
        if(par===5){selectLie(pick(['FAIRWAY','LEFT ROUGH']));document.getElementById('shotDistance').value=60+Math.floor(R()*60);confirmDistance();}}
      const onGreen=R()<0.6;
      if(!onGreen){ if(R()<0.3){selectLie('GS BUNKER');}else{selectLie('MISSED GREEN');handleMissedGreen(pick(['LEFT','RIGHT','SHORT','LONG']));}
        document.getElementById('shotDistance').value=5+Math.floor(R()*25);confirmDistance(); }
      selectLie('GREEN');document.getElementById('puttDistance').value=onGreen?8+Math.floor(R()*40):2+Math.floor(R()*14);
      if(R()<0.75){nextPutt();document.getElementById('puttDistance').value=1+Math.floor(R()*5);if(R()<0.12){nextPutt();document.getElementById('puttDistance').value=2;}}
      holeOut();await wait(5);
    }
    await wait(300);
  }
  await wait(500);return window.__DB.rounds;});
console.log('rounds',rounds.length,rounds.map(r=>r.score+'/'+r.par+' h'+r.holes+' '+r.round_data.entryMode).join(' , '));
fs.writeFileSync(__dirname+'/fixture-rounds.json',JSON.stringify(rounds.map(({id,user_id,...r})=>r)));
await b.close();})();
