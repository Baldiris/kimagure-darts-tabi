import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root = fileURLToPath(new URL('../',import.meta.url));
const read = path => fs.readFileSync(join(root,path),'utf8');
const compile = text => ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri = text => 'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const municipalities = JSON.parse(read('src/lib/municipalities.json'));
const selection = JSON.parse(read('public/competition/data/selection.json'));
const destinationsUri = uri(compile(read('src/lib/destinations.ts')
 .replace("import municipalities from './municipalities.json';",'const municipalities = '+JSON.stringify(municipalities)+';')
 .replace("import selection from '../../public/competition/data/selection.json';",'const selection = '+JSON.stringify(selection)+';')));
const {destinations,prefectures,regions,destinationPool,pickDestination,findDestination,findLegacyDestination} = await import(destinationsUri);
const {parseTravelState,resolveRoute,loadTravelState,travelStorageKey} = await import(uri(compile(read('src/lib/travel-state.ts')).replaceAll("'./destinations'",JSON.stringify(destinationsUri))));

assert.equal(destinations.length,1432);
assert.equal(prefectures.length,47);
assert.equal(new Set(destinations.map(city=>city.id)).size,1432);
assert.equal(destinationPool('全国',13).length,61);
assert.equal(destinationPool('全国',14).length,29);
for (const city of ['草津町','白川村','竹富町','小笠原村','ニセコ町','美瑛町']) assert.ok(destinations.some(destination=>destination.city===city), `${city} is eligible`);
assert.ok(destinationPool('全国',13).some(city=>city.city==='大田区'));
assert.ok(destinationPool('全国',14).some(city=>city.city==='横浜市'));
assert.ok(!destinations.some(city=>/市.*区$/.test(city.city)));

for (const prefecture of prefectures) {
 const pool = destinationPool(prefecture.region,prefecture.code);
 assert.ok(pool.length>1,prefecture.prefecture);
 for (const [index,city] of pool.entries()) {
  assert.equal(Number(city.id.slice(0,2)),prefecture.code);
  assert.equal(pickDestination(prefecture.region,()=>(index+.5)/pool.length,prefecture.code).id,city.id,'Every municipality must be reachable');
 }
 for (const random of [0,.1,.5,.9,1]) assert.notEqual(pickDestination(prefecture.region,()=>random,prefecture.code,pool[0].id).id,pool[0].id,'Immediate repeat');
 const legacy = {id:'legacy-'+prefecture.code,code:prefecture.code,area:prefecture.region,prefectureCode:prefecture.code,drawnAt:1};
 const state = parseTravelState(JSON.stringify({area:prefecture.region,prefectureCode:prefecture.code,history:[legacy],savedCodes:[prefecture.code],lastResult:legacy}));
 assert.equal(state.history.length,1,'Legacy history must survive');
 assert.equal(state.history[0].destinationId,findLegacyDestination(prefecture.code).id);
 assert.equal(state.savedDestinationIds[0],state.history[0].destinationId);
 assert.equal(resolveRoute('#trip='+legacy.id,state).record.destinationId,state.history[0].destinationId);
}
for (const area of ['全国',...regions]) {
 const pool = destinationPool(area);
 assert.equal(pickDestination(area,()=>0).id,pool[0].id);
 assert.equal(pickDestination(area,()=>1).id,pool.at(-1).id);
}
assert.throws(()=>pickDestination('関東',Math.random,47));

const old = {area:'関東',history:[{id:'old',code:13,area:'関東',drawnAt:1}],savedCodes:[13,14]};
const migrated = parseTravelState(JSON.stringify(old));
assert.equal(findDestination(migrated.history[0].destinationId).city,'青梅市');
assert.deepEqual(migrated.savedDestinationIds,['13205','14204']);
assert.equal(resolveRoute('#trip=saved-13',migrated).record.destinationId,'13205');
const record = {id:'new',code:13,destinationId:'13101',area:'関東',prefectureCode:13,drawnAt:2};
const samePrefecture = parseTravelState(JSON.stringify({area:'関東',prefectureCode:13,history:[record],lastResult:record,savedDestinationIds:['13101','13103','13101']}));
assert.deepEqual(samePrefecture.savedDestinationIds,['13101','13103'],'Save cities independently in one prefecture');
assert.equal(resolveRoute('#trip=saved-13103',samePrefecture).record.destinationId,'13103');
assert.equal(resolveRoute('#trip=new',samePrefecture).record.destinationId,'13101');
assert.equal(parseTravelState(JSON.stringify({history:[{...record,code:14}]})).history.length,0);
assert.equal(parseTravelState(JSON.stringify({history:[{...record,destinationId:'99999'}]})).history.length,0);
assert.equal(parseTravelState(JSON.stringify({area:'関東',prefectureCode:47})).prefectureCode,null);
assert.equal(parseTravelState('{broken').history.length,0);
let storage = new Map([['kimagure-darts-travel-v2',JSON.stringify(old)]]);
globalThis.localStorage = {getItem:key=>storage.get(key)??null};
assert.equal(loadTravelState().history[0].destinationId,'13205');
storage.set(travelStorageKey,JSON.stringify(samePrefecture));
assert.equal(loadTravelState().lastResult.destinationId,'13101','New state takes precedence over legacy state');
console.log('1432 reachable municipalities, all 47 scopes, repeat avoidance, independent saves and legacy migration passed.');
