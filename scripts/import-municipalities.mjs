import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

if (!process.argv[2]) throw new Error('Usage: node scripts/import-municipalities.mjs /path/to/localgovjp.json');
const source = JSON.parse(await readFile(process.argv[2],'utf8'));
// Designated-city wards overlap their parent city. Tokyo special wards remain.
const choices = source.filter(row=>! /\S+市\s+\S+区$/.test(row.city)).map(row=>({
 id:String(row.cid).padStart(5,'0'),code:Number(row.pid),city:row.city.replace(/\s+/g,''),
}));
assert.equal(new Set(choices.map(city=>city.code)).size,47);
assert.equal(new Set(choices.map(city=>city.id)).size,choices.length);
for (const city of choices) {
 assert.match(city.id,/^\d{5}$/);
 assert.equal(Number(city.id.slice(0,2)),city.code);
 assert.ok(city.city.length>0);
}
const path = fileURLToPath(new URL('../src/lib/municipalities.json',import.meta.url));
await writeFile(path,JSON.stringify(choices,null,1)+'\n');
console.log(`Imported ${choices.length} municipalities in 47 prefectures.`);
