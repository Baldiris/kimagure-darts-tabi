import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await read('public/competition/data/destinations.json');
const population = await read('data/selection-sources/population-2026.json');
const heritage = await read('data/selection-sources/japan-heritage-2026.json');
const districts = await read('data/selection-sources/traditional-districts-2026.json');
const nationalParks = await read('data/selection-sources/national-parks-2026.json');
const byName = new Map(catalog.municipalities.map(place => [`${place.code}:${place.city}`, place]));
const byId = new Map(catalog.municipalities.map(place => [place.id, place]));
const evidence = new Map(catalog.municipalities.map(place => [place.id, []]));
const add = (id, type, name) => {
  assert.ok(byId.has(id), `Unknown municipality ${id}`);
  if (!evidence.get(id).some(item => item.type === type && item.name === name)) evidence.get(id).push({type, name});
};

for (const row of heritage) {
  const place = byName.get(`${row.pref}:${row.city}`);
  assert.ok(place, `Japan Heritage unmatched: ${row.pref}:${row.city}`);
  add(place.id, 'heritage', '日本遺産の構成文化財掲載地域');
}

for (const row of districts) {
  const prefecture = catalog.prefectures.find(pref => pref.name.startsWith(row.pref));
  assert.ok(prefecture, `Traditional district prefecture unmatched: ${row.pref}`);
  const places = catalog.municipalities.filter(place => place.code === prefecture.code && row.name.startsWith(place.city));
  assert.equal(places.length, 1, `Traditional district unmatched: ${row.name}`);
  add(places[0].id, 'district', row.name);
}

assert.equal(nationalParks.length, 35, 'National park source must cover all parks');
for (const park of nationalParks) {
  assert.ok(park.rows?.length, `National park municipalities missing: ${park.name}`);
  for (const [prefName, list] of park.rows) {
    if (prefName === '合計') continue;
    const prefecture = catalog.prefectures.find(pref => pref.name.startsWith(prefName));
    assert.ok(prefecture, `National park prefecture unmatched: ${park.name} / ${prefName}`);
    // The Setonaikai page explicitly marks this Osaka line as sea-only reference,
    // without naming a municipality. All named rows are matched below.
    if (list.includes('地先が海域普通地域')) continue;
    for (const token of list.replaceAll('及び', '、').split(/[、，,\s]+/).filter(Boolean)) {
      const matches = catalog.municipalities
        .filter(place => place.code === prefecture.code && token.endsWith(place.city))
        .sort((a, b) => b.city.length - a.city.length);
      assert.ok(matches.length, `National park municipality unmatched: ${park.name} / ${prefName} / ${token}`);
      add(matches[0].id, 'park', `${park.name}国立公園`);
    }
  }
}

// The five natural World Heritage areas and their constituent municipalities.
// See the regional Environment Ministry pages linked in the output metadata.
const naturalHeritage = [
  ['知床', ['01545', '01694']],
  ['白神山地', ['02321', '02323', '02343', '05346']],
  ['小笠原諸島', ['13421']],
  ['屋久島', ['46505']],
  ['奄美大島・徳之島・沖縄島北部・西表島', ['46222', '46523', '46524', '46525', '46527', '46530', '46531', '46532', '47301', '47302', '47303', '47381']]
];
for (const [name, ids] of naturalHeritage) for (const id of ids) add(id, 'nature', name);

// 2025 ranking, top ten only. The source names the hot springs, so the
// municipality mapping is reviewed separately (not inferred by string match).
const hotSprings = [
  ['草津温泉', '10426'], ['下呂温泉', '21220'], ['道後温泉', '38201'],
  ['別府八湯温泉', '44202'], ['登別温泉', '01230'], ['有馬温泉', '28100'],
  ['あわら温泉', '18208'], ['指宿温泉', '46210'], ['城崎温泉', '28209'],
  ['黒川温泉', '43423']
];
for (const [name, id] of hotSprings) add(id, 'onsen', name);

const places = Object.fromEntries(catalog.municipalities.map(place => {
  const residents = population[place.id];
  assert.ok(Number.isSafeInteger(residents) && residents >= 0, `Population missing: ${place.id}`);
  const reasons = evidence.get(place.id);
  return [place.id, {population: residents, eligible: residents >= 10000 || reasons.length > 0, evidence: reasons}];
}));
const selected = Object.values(places).filter(place => place.eligible);
const byPrefecture = catalog.prefectures.map(pref => ({code: pref.code, count: catalog.municipalities.filter(place => place.code === pref.code && places[place.id].eligible).length}));
assert.equal(Object.keys(places).length, 1741);
assert.ok(byPrefecture.every(pref => pref.count > 0));
const output = {
  updated: '2026-10-04',
  threshold: 10000,
  rule: '住民基本台帳人口1万人以上、または確認済みの観光資源（日本遺産構成文化財、重要伝統的建造物群保存地区、国立公園の関係市町村、世界自然遺産、2025年度温泉100選上位10位）のいずれか。対象内は等確率。',
  sources: {
    population: 'https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&tclass1=000001039601&toukei=00200241&tstat=000001039591&year=20260',
    heritage: 'https://japan-heritage.bunka.go.jp/ja/culturalproperties/region/',
    district: 'https://www.bunka.go.jp/seisaku/bunkazai/shokai/hozonchiku/judenken_ichiran.html',
    park: 'https://www.env.go.jp/park/parks/',
    nature: [
      'https://www.env.go.jp/nature/isan/shiretoko/gaiyo.pdf',
      'https://tohoku.env.go.jp/nature/shirakami-sanchi/introduction/location.html',
      'https://www.env.go.jp/nature/isan/worldheritage/ogasawara/link/index.html',
      'https://www.env.go.jp/nature/isan/worldheritage/yakushima/measure/index.html',
      'https://kyushu.env.go.jp/okinawa/amami-okinawa/world-natural-heritage/plan/index.html'
    ],
    onsen: 'https://www.kankokeizai.com/index_100sen/'
  },
  total: catalog.municipalities.length,
  eligible: selected.length,
  byPrefecture,
  places
};
const path = new URL('public/competition/data/selection.json', root);
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), serialized, 'Selection output is stale; run node scripts/build-selection.mjs');
else await writeFile(path, serialized);
console.log(`選定 ${selected.length}/${catalog.municipalities.length}件 / 47都道府県、観光根拠で救済 ${selected.filter(place => place.population < 10000).length}件`);
