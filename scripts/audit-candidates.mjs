import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(new URL(path, `file://${root}`), 'utf8'));
const data = await read('public/competition/data/destinations.json');
const sourceList = await read('src/lib/municipalities.json');
const coordinateData = await read('public/competition/ren/coordinates.json');
const {points} = coordinateData;
assert.equal(coordinateData.source, 'code4fukui/localgovjp@cd94f841f22235759ed29e7f38ecc2fbc6671e6b');

// GSI's prefecture totals (2025-10-01, appendix 5). Hokkaido includes six
// Northern Territories villages outside this travel catalog; Tokyo's 23
// special wards are separately listed and included here. Source:
// https://www.gsi.go.jp/KOKUJYOHO/MENCHO/backnumber/GSI-menseki20251001.pdf
const officialTotals = [185,40,33,35,25,35,59,44,25,35,63,54,39,33,30,15,19,17,27,77,42,35,54,29,19,26,43,41,39,30,19,19,27,23,19,24,17,20,34,60,20,21,45,18,26,43,41];
const expected = officialTotals.map((count, index) => count - (index === 0 ? 6 : 0) + (index === 12 ? 23 : 0));

assert.equal(data.prefectures.length, 47);
assert.equal(data.municipalities.length, 1741);
assert.equal(sourceList.length, 1741);
assert.equal(Object.keys(points).length, 1741);
assert.equal(new Set(data.prefectures.map(pref => pref.code)).size, 47);
assert.equal(data.regions.length, 7);
const names = new Map(data.prefectures.map(pref => [pref.code, pref.name]));
const ids = new Set();
const namedPlaces = new Set();
const positions = new Set();
const counts = new Map();
const types = {'市': 0, '町': 0, '村': 0, '区': 0};
for (const place of data.municipalities) {
  assert.match(place.id, /^\d{5}$/);
  assert.ok(!ids.has(place.id), `Duplicate ID: ${place.id}`);
  ids.add(place.id);
  assert.ok(names.has(place.code), `Unknown prefecture: ${place.id}`);
  assert.equal(Number(place.id.slice(0, 2)), place.code);
  assert.match(place.city, /[市町村区]$/);
  const type = place.city.at(-1);
  if (type === '区') assert.equal(place.code, 13, `Unexpected ward: ${place.city}`);
  types[type] += 1;
  const key = `${place.code}:${place.city}`;
  assert.ok(!namedPlaces.has(key), `Duplicate name: ${key}`);
  namedPlaces.add(key);
  const point = points[place.id];
  assert.ok(Array.isArray(point) && point.length === 2, `Missing point: ${key}`);
  const [lat, lng] = point;
  assert.ok(Number.isFinite(lat) && Number.isFinite(lng) && lat > 20 && lat < 46 && lng > 120 && lng < 155, `Invalid point: ${key}`);
  assert.ok(!positions.has(point.join(',')), `Duplicate point: ${key}`);
  positions.add(point.join(','));
  counts.set(place.code, (counts.get(place.code) || 0) + 1);
}
assert.deepEqual([...data.municipalities].sort((a,b) => a.id.localeCompare(b.id)), [...sourceList].sort((a,b) => a.id.localeCompare(b.id)));
for (const pref of data.prefectures) assert.equal(counts.get(pref.code), expected[pref.code - 1], `${pref.name} differs from GSI adjusted count`);

if (process.argv[2]) {
  const upstream = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const choices = upstream.filter(row => !/\S+市\s+\S+区$/.test(row.city));
  assert.equal(choices.length, 1741, 'Upstream candidate count');
  for (const row of choices) {
    const id = String(row.cid).padStart(5, '0');
    const place = data.municipalities.find(item => item.id === id);
    assert.ok(place, `Upstream place missing: ${id}`);
    assert.equal(place.code, Number(row.pid));
    assert.equal(place.city, row.city.replace(/\s+/g, ''));
    assert.deepEqual(points[id], [Number(row.lat), Number(row.lng)]);
  }
}

console.log(`候補 ${ids.size}件 / 47都道府県: 市${types['市']}・町${types['町']}・村${types['村']}・東京23区${types['区']}`);
console.log('重複・欠損なし。47都道府県の件数は国土地理院集計との調整後に一致。');
