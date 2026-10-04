import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await read('public/competition/data/destinations.json');
const selection = await read('public/competition/data/selection.json');
const areas = await read('data/feature-sources/area-2024.json');
const agriculture = await read('data/feature-sources/agriculture-2024.json');
const parks = await read('data/selection-sources/national-parks-2026.json');
const parkUrls = new Map(parks.map(park => [`${park.name}国立公園`, park.url]));
const sourceUrls = {
  area: 'https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001484933&page=1',
  agriculture: 'https://www.maff.go.jp/j/tokei/kouhyou/sityoson_sansyutu/',
  nature: 'https://www.env.go.jp/nature/isan/worldheritage.html',
  district: selection.sources.district,
  park: selection.sources.park,
  heritage: selection.sources.heritage
};
const priority = {nature: 0, district: 1, park: 2, heritage: 3};

function sight(evidence) {
  const item = evidence.filter(row => row.type in priority).sort((a, b) => priority[a.type] - priority[b.type])[0];
  if (!item) return null;
  if (item.type === 'nature') return {kind: 'nature', name: item.name, url: 'https://www.env.go.jp/nature/isan/worldheritage.html'};
  if (item.type === 'district') return {kind: 'district', name: item.name, url: sourceUrls.district};
  if (item.type === 'park') {
    assert.ok(parkUrls.has(item.name), `No national park page: ${item.name}`);
    return {kind: 'park', name: item.name, url: parkUrls.get(item.name)};
  }
  return {kind: 'heritage', name: '', url: sourceUrls.heritage};
}

const facts = Object.fromEntries(catalog.municipalities
  .filter(city => selection.places[city.id]?.eligible)
  .map(city => {
    const area = areas[city.id];
    assert.ok(Array.isArray(area) && area.length === 2 && area[0] > 0 && area[1] >= 0 && area[1] <= area[0], `Missing area: ${city.id}`);
    const crop = agriculture[city.id];
    if (crop) assert.ok(typeof crop[0] === 'string' && crop[1] >= 5 && Number.isInteger(crop[2]), `Invalid agriculture: ${city.id}`);
    const listedSight = sight(selection.places[city.id].evidence);
    return [city.id, {area, ...(crop ? {crop} : {}), ...(listedSight ? {sight: listedSight} : {})}];
  }));
assert.equal(Object.keys(facts).length, selection.eligible);
const output = {
  updated: '2026-10-04',
  sourceUrls,
  areaYear: 2024,
  agricultureYear: 2024,
  units: {area: 'km²', crop: '千万円（農業産出額・推計）'},
  places: facts
};
const file = new URL('public/competition/data/place-facts.json', root);
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes('--check')) assert.equal(await readFile(file, 'utf8'), serialized, 'Place facts are stale; run node scripts/build-place-facts.mjs');
else await writeFile(file, serialized);
console.log(`町の特徴 ${Object.keys(facts).length}件 / 観光資料 ${Object.values(facts).filter(x => x.sight).length}件 / 農業 ${Object.values(facts).filter(x => x.crop).length}件`);
