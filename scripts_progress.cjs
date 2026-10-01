// usage: node scripts_progress.cjs "<current phase>" "<done line>" "<decision lines separated by |>" "<next step>"
const fs=require('fs');const [,, cur, done, dec, next]=process.argv;
let s=fs.readFileSync('docs/PROGRESS.md','utf8');
s=s.replace(/## Current phase\n[^\n]*\n/, `## Current phase\n${cur}\n`);
s=s.replace(/\n## Decisions and why/, `${done?'\n- '+done:''}\n\n## Decisions and why`);
if(dec){const lines=dec.split('|').map(x=>'- '+x.trim()).join('\n');s=s.replace(/\n## Next step/, `\n${lines}\n\n## Next step`);}
s=s.replace(/## Next step\n[^\n]*\n/, `## Next step\n${next}\n`);
fs.writeFileSync('docs/PROGRESS.md',s);
