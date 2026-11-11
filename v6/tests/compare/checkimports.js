// Verifies every named import resolves to a real export.
const espree=require('espree'),fs=require('fs'),path=require('path');const root=path.resolve(process.argv[2]);
const exportsOf={};const files=[];(function w(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())w(p);else if(f.endsWith('.js'))files.push(p);}})(root);
const asts={};for(const f of files){const a=espree.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:2022,sourceType:'module'});asts[f]=a;const s=new Set();
  for(const n of a.body)if(n.type==='ExportNamedDeclaration'){if(n.declaration){if(n.declaration.id)s.add(n.declaration.id.name);else n.declaration.declarations.forEach(d=>s.add(d.id.name));}n.specifiers.forEach(x=>s.add(x.exported.name));}exportsOf[f]=s;}
let bad=0;for(const f of files)for(const n of asts[f].body)if(n.type==='ImportDeclaration'){const t=path.resolve(path.dirname(f),n.source.value);if(!exportsOf[t]){bad++;console.log('MISSING FILE',path.relative(root,f),n.source.value);continue;}
  for(const sp of n.specifiers)if(sp.type==='ImportSpecifier'&&!exportsOf[t].has(sp.imported.name)){bad++;console.log('MISSING EXPORT',path.relative(root,f),sp.imported.name,'from',n.source.value);}}
console.log('import check: files',files.length,'problems',bad);
