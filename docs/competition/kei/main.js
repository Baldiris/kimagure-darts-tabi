const regionSelect = document.getElementById('region');
const prefectureSelect = document.getElementById('prefecture');
const form = document.getElementById('dart-form');
const button = document.getElementById('throw-button');
const label = document.getElementById('throw-label');
const scopeText = document.getElementById('scope-text');
const visual = document.getElementById('hero-visual');
const card = document.getElementById('result-card');
const cityNode = document.getElementById('result-city');
const prefectureNode = document.getElementById('result-prefecture');
const mapsLink = document.getElementById('maps-link');

let regions = [];
let prefectures = [];
let municipalities = [];
let eligible = [];
let inFlight = false;
let throwId = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const numberFormatter = new Intl.NumberFormat('ja-JP');

function makeOption(value, text) {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = text;
  return option;
}

function refreshPrefectures() {
  const selected = prefectureSelect.value;
  const region = regionSelect.value;
  const matching = region ? prefectures.filter(item => item.region === region) : prefectures;
  prefectureSelect.replaceChildren(makeOption('', 'すべて'), ...matching.map(item => makeOption(item.code, item.name)));
  if (matching.some(item => String(item.code) === selected)) prefectureSelect.value = selected;
  refreshEligibility();
}

function refreshEligibility() {
  const region = regionSelect.value;
  const code = prefectureSelect.value;
  const allowedCodes = new Set(prefectures.filter(item => !region || item.region === region).map(item => item.code));
  eligible = municipalities.filter(item => allowedCodes.has(item.code) && (!code || String(item.code) === code));
  const scope = code ? prefectures.find(item => String(item.code) === code)?.name : region || '全国';
  scopeText.innerHTML = '';
  scopeText.append(document.createTextNode(`${scope}の `));
  const strong = document.createElement('strong');
  strong.textContent = numberFormatter.format(eligible.length);
  scopeText.append(strong, document.createTextNode(' 市区町村が候補'));
  button.disabled = inFlight || !eligible.length;
  if (!inFlight) label.textContent = eligible.length ? 'ダーツを投げる' : '候補がありません';
}

function randomIndex(length) {
  const sample = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / length) * length;
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % length;
}

function reveal(item) {
  const prefecture = prefectures.find(entry => entry.code === item.code);
  const name = prefecture?.name || '';
  prefectureNode.textContent = name;
  cityNode.textContent = item.city;
  mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${item.city}`)}`;
  card.hidden = false;
  visual.classList.remove('is-throwing');
  visual.classList.add('has-result');
  inFlight = false;
  regionSelect.disabled = false;
  prefectureSelect.disabled = false;
  refreshEligibility();
  label.textContent = 'もう一度、投げる';
  card.focus({ preventScroll: true });
  // The button can be near the viewport bottom on desktop too. Keep the entire
  // result card visible after landing, regardless of the current scroll offset.
  card.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (inFlight || !eligible.length) return;
  const winner = eligible[randomIndex(eligible.length)];
  inFlight = true;
  const currentThrow = ++throwId;
  button.disabled = true;
  regionSelect.disabled = true;
  prefectureSelect.disabled = true;
  label.textContent = 'ダーツを投げています…';
  card.hidden = true;
  visual.classList.remove('has-result', 'is-throwing');
  // Reset the flight animation so a second throw follows the same route.
  void visual.offsetWidth;
  visual.classList.add('is-throwing');
  window.setTimeout(() => { if (currentThrow === throwId) reveal(winner); }, reducedMotion.matches ? 300 : 1850);
});

function resetResult() {
  card.hidden = true;
  visual.classList.remove('has-result');
}

regionSelect.addEventListener('change', () => { resetResult(); refreshPrefectures(); });
prefectureSelect.addEventListener('change', () => { resetResult(); refreshEligibility(); });

fetch('../data/destinations.json')
  .then(response => { if (!response.ok) throw new Error('destinations unavailable'); return response.json(); })
  .then(data => {
    regions = data.regions;
    prefectures = data.prefectures;
    municipalities = data.municipalities;
    regionSelect.append(...regions.map(item => makeOption(item, item)));
    refreshPrefectures();
  })
  .catch(() => {
    label.textContent = '旅先データを読み込めませんでした';
    scopeText.textContent = 'ページを再読み込みしてください。';
  });
