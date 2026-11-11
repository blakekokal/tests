const espree=require('espree'),escope=require('eslint-scope'),fs=require('fs'),path=require('path');
const root=process.argv[2];const browser=new Set('document window setTimeout clearTimeout setInterval clearInterval alert confirm prompt Object JSON Date parseInt parseFloat Number console XLSX Blob File navigator URL encodeURIComponent decodeURIComponent undefined Math isNaN Array String localStorage fetch Promise FileReader Uint8Array Error Image isFinite RegExp Chart supabase requestAnimationFrame Set Map Symbol Infinity NaN location history Intl Boolean HTMLElement Event getComputedStyle atob btoa crypto performance createImageBitmap Tesseract FormData AbortController TextDecoder'.split(' '));
let bad=0,files=0,lines=0;const unresolved={};
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(f.endsWith('.js')){files++;const src=fs.readFileSync(p,'utf8');lines+=src.split('\n').length;let ast;
  try{ast=espree.parse(src,{ecmaVersion:2022,sourceType:'module',range:true,loc:true});}catch(e){bad++;console.log('PARSE',p,e.message);continue;}
  const sm=escope.analyze(ast,{ecmaVersion:2022,sourceType:'module'});
  for(const r of sm.globalScope.through){const n=r.identifier.name;if(!browser.has(n)){(unresolved[n]=unresolved[n]||new Set()).add(path.relative(root,p)+(r.isWrite()?'(W)':''));}}
  // writes to imports
  for(const sc of sm.scopes)if(sc.type==='module')for(const v of sc.variables)if(v.defs.some(d=>d.type==='ImportBinding'))for(const r of v.references)if(r.isWrite()){bad++;console.log('WRITE TO IMPORT',p,v.name,r.identifier.loc.start.line);}
}}})(root);
console.log('files',files,'lines',lines,'bad',bad);
console.log('unresolved:',Object.keys(unresolved).map(n=>n+'['+[...unresolved[n]].join(',')+']').join(' '));
