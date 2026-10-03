const board = document.querySelector('#dartboard');
const boardButton = document.querySelector('#board-button');
const throwButton = document.querySelector('#throw-button');
const regionSelect = document.querySelector('#region');
const prefectureSelect = document.querySelector('#prefecture');
const poolSummary = document.querySelector('#pool-summary');
const outcome = document.querySelector('#outcome');
const outcomeKicker = document.querySelector('#outcome-kicker');
const outcomeSub = document.querySelector('#outcome-sub');
const outcomePlace = document.querySelector('#outcome-place');
const mapsLink = document.querySelector('#maps-link');

const svgNS = 'http://www.w3.org/2000/svg';
const scores = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const paper = '#f5e9ce';
const green = '#305c53';
const dark = '#20332f';
const red = '#cb4a3b';
let data;
let pool = [];
let busy = false;

function svgElement(tag, attrs = {}) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function point(radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return [160 + radius * Math.cos(radians), 160 + radius * Math.sin(radians)];
}

function ringSlice(inner, outer, a, b) {
  const [ox1, oy1] = point(outer, a);
  const [ox2, oy2] = point(outer, b);
  const [ix1, iy1] = point(inner, a);
  const [ix2, iy2] = point(inner, b);
  return `M ${ox1} ${oy1} A ${outer} ${outer} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${inner} ${inner} 0 0 0 ${ix1} ${iy1} Z`;
}

function drawBoard() {
  board.append(svgElement('circle', {cx:160, cy:160, r:158, fill:'#1b2b29'}));
  board.append(svgElement('circle', {cx:160, cy:160, r:146, fill:'#354a42', stroke:'#c2aa79', 'stroke-width':2}));
  for (let i = 0; i < 20; i++) {
    const angle = i * 18;
    for (const [inner, outer, color] of [
      [119, 139, i % 2 ? '#b0a689' : dark],
      [107, 119, i % 2 ? green : red],
      [65, 107, i % 2 ? dark : paper],
      [55, 65, i % 2 ? green : red],
      [17, 55, i % 2 ? dark : paper]
    ]) {
      board.append(svgElement('path', {d:ringSlice(inner,outer,angle-9,angle+9),fill:color,stroke:'#d0c5a7','stroke-width':.5}));
    }
    const [x, y] = point(149, angle);
    const score = svgElement('text', {x, y, fill:'#f7eedc', 'font-size':12, 'font-family':'Arial,sans-serif', 'font-weight':700, 'text-anchor':'middle', 'dominant-baseline':'central'});
    score.textContent = scores[i];
    board.append(score);
  }
  board.append(svgElement('circle', {cx:160, cy:160, r:17, fill:green, stroke:'#d0c5a7','stroke-width':1.5}));
  board.append(svgElement('circle', {cx:160, cy:160, r:9, fill:red, stroke:'#e7d4b4','stroke-width':1}));
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function updatePrefectures() {
  const selectedCode = prefectureSelect.value;
  prefectureSelect.replaceChildren();
  addOption(prefectureSelect, '', '指定なし');
  const region = regionSelect.value;
  for (const prefecture of data.prefectures.filter(p => region === '全国' || p.region === region)) {
    addOption(prefectureSelect, String(prefecture.code), prefecture.name);
  }
  if ([...prefectureSelect.options].some(option => option.value === selectedCode)) prefectureSelect.value = selectedCode;
  updatePool();
}

function updatePool() {
  const region = regionSelect.value;
  const code = prefectureSelect.value;
  pool = data.municipalities.filter(place => {
    const prefecture = data.prefectures[place.code - 1];
    return (region === '全国' || prefecture.region === region) && (!code || place.code === Number(code));
  });
  const area = code ? data.prefectures.find(p => p.code === Number(code)).name : region;
  poolSummary.innerHTML = `<strong>${area}</strong> の ${pool.length.toLocaleString('ja-JP')} 市区町村から、次の一投で決定`;
  throwButton.disabled = boardButton.disabled = pool.length === 0;
  if (outcome.classList.contains('is-result')) {
    outcome.classList.remove('is-result');
    outcomeKicker.textContent = 'YOUR DESTINATION';
    outcomeSub.textContent = '範囲を変更しました';
    outcomePlace.textContent = 'もう一度投げてみよう';
    mapsLink.hidden = true;
    boardButton.classList.remove('is-landed');
  }
}

function randomIndex(length) {
  const ceiling = Math.floor(0x100000000 / length) * length;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= ceiling);
  return value[0] % length;
}

function throwDart() {
  if (!data || !pool.length || busy) return;
  busy = true;
  const place = pool[randomIndex(pool.length)];
  const hitAngle = randomIndex(360) * Math.PI / 180;
  const hitRadius = 8 + randomIndex(25);
  boardButton.style.setProperty('--hit-x', `${Math.round(Math.cos(hitAngle) * hitRadius)}px`);
  boardButton.style.setProperty('--hit-y', `${Math.round(Math.sin(hitAngle) * hitRadius)}px`);
  const prefecture = data.prefectures.find(p => p.code === place.code);
  regionSelect.disabled = prefectureSelect.disabled = true;
  throwButton.disabled = boardButton.disabled = true;
  throwButton.classList.add('is-throwing');
  throwButton.querySelector('.throw-button-label').textContent = '投げています…';
  outcome.classList.remove('is-result');
  outcome.setAttribute('aria-busy', 'true');
  outcomeKicker.textContent = 'THE DART IS FLYING';
  outcomeSub.textContent = '矢の行方は…';
  outcomePlace.textContent = '旅先を探しています';
  mapsLink.hidden = true;
  boardButton.classList.remove('is-landed', 'is-flying');
  void boardButton.offsetWidth;
  boardButton.classList.add('is-flying');

  const reveal = () => {
    boardButton.classList.remove('is-flying');
    boardButton.classList.add('is-landed');
    outcome.classList.add('is-result');
    outcomeKicker.textContent = 'YOUR NEXT DESTINATION';
    outcomeSub.textContent = `${prefecture.name} に決まりました`;
    outcomePlace.textContent = place.city;
    mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prefecture.name} ${place.city}`)}`;
    mapsLink.hidden = false;
    outcome.removeAttribute('aria-busy');
    throwButton.classList.remove('is-throwing');
    throwButton.querySelector('.throw-button-label').textContent = 'もう一度投げる';
    boardButton.setAttribute('aria-label', `${prefecture.name} ${place.city} に当たりました。もう一度投げる`);
    regionSelect.disabled = prefectureSelect.disabled = false;
    throwButton.disabled = boardButton.disabled = false;
    busy = false;
  };
  setTimeout(reveal, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 1140);
}

drawBoard();
throwButton.addEventListener('click', throwDart);
boardButton.addEventListener('click', throwDart);
regionSelect.addEventListener('change', updatePrefectures);
prefectureSelect.addEventListener('change', updatePool);

fetch('../data/destinations.json')
  .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then(json => {
    if (!Array.isArray(json.municipalities) || !Array.isArray(json.prefectures)) throw new Error('旅先データの形式が不正です');
    data = json;
    regionSelect.replaceChildren();
    addOption(regionSelect, '全国', '全国からおまかせ');
    json.regions.forEach(region => addOption(regionSelect, region, region));
    regionSelect.disabled = false;
    prefectureSelect.disabled = false;
    updatePrefectures();
  })
  .catch(() => {
    poolSummary.textContent = '旅先データを読み込めませんでした。ページを再読み込みしてください。';
    outcomePlace.textContent = '現在、旅先を決められません';
  });
