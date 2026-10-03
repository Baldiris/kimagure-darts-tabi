(() => {
  'use strict';

  const regionAssets = {
    '北海道・東北': 'hokkaido-tohoku',
    '関東': 'kanto',
    '中部': 'chubu',
    '近畿': 'kinki',
    '中国': 'chugoku',
    '四国': 'shikoku',
    '九州・沖縄': 'kyushu-okinawa'
  };

  const $ = (selector) => document.querySelector(selector);
  const els = {
    regionList: $('#region-list'),
    prefectureSelect: $('#prefecture-select'),
    mapStage: $('#map-stage'),
    mapKeyText: $('#map-key-text'),
    mapLocation: $('#map-location'),
    mapNote: $('#map-note'),
    selectedScope: $('#selected-scope'),
    candidateCount: $('#candidate-count'),
    totalCount: $('#total-count'),
    throwButton: $('#throw-button'),
    result: $('#result'),
    resultPrefecture: $('#result-prefecture'),
    resultCity: $('#result-city'),
    resultCaption: $('#result-caption'),
    resultIndex: $('#result-index'),
    resultLink: $('#result-map-link'),
    retryButton: $('#retry-button')
  };

  let data = null;
  let coordinates = null;
  let region = '全国';
  let prefectureCode = null;
  let mapRequest = 0;
  let thrown = 0;
  let busy = false;
  let activeTarget = null;

  function prefecture() {
    return data.prefectures.find((item) => item.code === prefectureCode) || null;
  }

  function scopeName() {
    return prefecture()?.name || region;
  }

  function eligible() {
    if (prefectureCode !== null) return data.municipalities.filter((item) => item.code === prefectureCode);
    if (region === '全国') return data.municipalities;
    const codes = new Set(data.prefectures.filter((item) => item.region === region).map((item) => item.code));
    return data.municipalities.filter((item) => codes.has(item.code));
  }

  function uniformIndex(length) {
    const ceiling = 0x100000000;
    const limit = Math.floor(ceiling / length) * length;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % length;
  }

  // The map of dots uses a geographic projection of every eligible municipality.
  // A single scale for both axes keeps directions and relative distances intact.
  function projectedPoints(pool, width, height) {
    const points = pool.map((city) => {
      const [lat, lng] = coordinates[city.id];
      return {city, lat, lng};
    });
    const midLatitude = (Math.min(...points.map((point) => point.lat)) + Math.max(...points.map((point) => point.lat))) / 2;
    const longitudeScale = Math.cos(midLatitude * Math.PI / 180);
    const xs = points.map((point) => point.lng * longitudeScale);
    const ys = points.map((point) => -point.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const availableWidth = Math.max(1, width - Math.max(80, width * .19));
    const availableHeight = Math.max(1, height - Math.max(100, height * .29));
    const scale = Math.min(availableWidth / (maxX - minX || 1), availableHeight / (maxY - minY || 1));
    return points.map((point, index) => ({
      city: point.city,
      x: width / 2 + (xs[index] - (minX + maxX) / 2) * scale,
      y: height / 2 + (ys[index] - (minY + maxY) / 2) * scale
    }));
  }

  function drawTargetMap() {
    if (!activeTarget) return;
    const {pool, city, place, canvas, impact, dart, label} = activeTarget;
    const {width, height} = els.mapStage.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    const points = projectedPoints(pool, width, height);
    context.fillStyle = '#4b856d';
    context.globalAlpha = pool.length > 500 ? .68 : .83;
    context.beginPath();
    const radius = pool.length > 500 ? 2 : pool.length > 60 ? 2.7 : 3.8;
    for (const point of points) {
      context.moveTo(point.x + radius, point.y);
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.globalAlpha = 1;
    const winner = points.find((point) => point.city.id === city.id);
    context.beginPath();
    context.arc(winner.x, winner.y, radius + 3, 0, Math.PI * 2);
    context.fillStyle = '#fffdf7';
    context.fill();
    context.beginPath();
    context.arc(winner.x, winner.y, radius + 1, 0, Math.PI * 2);
    context.fillStyle = '#de6746';
    context.fill();
    const x = `${winner.x / width * 100}%`;
    const y = `${winner.y / height * 100}%`;
    for (const element of [impact, dart, label]) {
      element.style.setProperty('--hit-x', x);
      element.style.setProperty('--hit-y', y);
    }
    label.classList.toggle('is-right', winner.x > width * (width < 620 ? .51 : .65));
    label.classList.toggle('is-low', winner.y < height * .25);
    label.querySelector('strong').textContent = city.city;
    label.querySelector('small').textContent = place.name;
    els.mapStage.setAttribute('aria-label', `${scopeName()}の市区町村の位置。${place.name}${city.city}に着弾`);
  }

  function prepareTargetMap(pool, city, place) {
    // Invalidate any still-loading decorative SVG before replacing the stage.
    mapRequest += 1;
    const canvas = document.createElement('canvas');
    canvas.className = 'point-map';
    canvas.setAttribute('aria-hidden', 'true');
    const dart = document.createElement('div');
    dart.className = 'throw-dart';
    dart.setAttribute('aria-hidden', 'true');
    dart.innerHTML = '<span class="flight"></span><span class="shaft"></span><span class="point"></span>';
    const impact = document.createElement('div');
    impact.className = 'impact';
    impact.setAttribute('aria-hidden', 'true');
    const label = document.createElement('div');
    label.className = 'impact-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<small></small><strong></strong><span>↗</span>';
    els.mapStage.replaceChildren(canvas, dart, impact, label);
    activeTarget = {pool, city, place, canvas, dart, impact, label};
    drawTargetMap();
    els.mapKeyText.textContent = '1点＝1市区町村の位置';
    els.mapNote.textContent = '候補の町を位置データから描いています。ダーツは選ばれた町に着弾します。';
    return activeTarget;
  }

  function setRegionButtons() {
    els.regionList.replaceChildren();
    ['全国', ...data.regions].forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'region-button';
      button.textContent = name;
      button.setAttribute('aria-pressed', name === region ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (busy) return;
        region = name;
        prefectureCode = null;
        updateSelection();
      });
      els.regionList.append(button);
    });
  }

  function setPrefectureOptions() {
    els.prefectureSelect.replaceChildren();
    const allOption = new Option(region === '全国' ? 'すべての都道府県' : `${region}のすべて`, '');
    els.prefectureSelect.add(allOption);
    data.prefectures.filter((item) => region === '全国' || item.region === region).forEach((item) => {
      els.prefectureSelect.add(new Option(item.name, String(item.code)));
    });
    els.prefectureSelect.value = prefectureCode === null ? '' : String(prefectureCode);
  }

  function mapAsset() {
    if (prefectureCode !== null) return `../../assets/prefectures/${String(prefectureCode).padStart(2, '0')}.svg`;
    if (region === '全国') return '../../assets/japan.svg';
    return `../../assets/regions/${regionAssets[region]}.svg`;
  }

  async function renderMap() {
    const current = ++mapRequest;
    els.mapStage.innerHTML = '<p class="map-loading">地図を読み込んでいます…</p>';
    els.mapStage.setAttribute('aria-label', `${scopeName()}の地図`);
    try {
      const response = await fetch(mapAsset());
      if (!response.ok) throw new Error('map failed');
      const markup = await response.text();
      if (current !== mapRequest) return;
      const documentSVG = new DOMParser().parseFromString(markup, 'image/svg+xml');
      const svg = documentSVG.querySelector('svg');
      if (!svg) throw new Error('SVG failed');
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-label', `${scopeName()}の都道府県地図`);
      svg.querySelectorAll('.prefecture').forEach((shape) => {
        const code = Number(shape.getAttribute('data-code'));
        const place = data.prefectures.find((item) => item.code === code);
        if (!place) return;
        if (prefectureCode === code) shape.classList.add('selected');
        if (region !== '全国' && place.region !== region) shape.classList.add('muted');
        shape.setAttribute('tabindex', '0');
        shape.setAttribute('role', 'button');
        shape.setAttribute('aria-label', `${place.name}を選ぶ`);
        const choose = () => {
          if (busy) return;
          prefectureCode = code;
          region = place.region;
          updateSelection();
        };
        shape.addEventListener('click', choose);
        shape.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
      });
      els.mapStage.replaceChildren(svg);
      const dart = document.createElement('div');
      dart.className = 'throw-dart';
      dart.innerHTML = '<span class="flight"></span><span class="shaft"></span><span class="point"></span>';
      const impact = document.createElement('div');
      impact.className = 'impact';
      els.mapStage.append(dart, impact);
    } catch {
      if (current === mapRequest) els.mapStage.innerHTML = '<p class="map-loading">地図を表示できませんでした。範囲の選択と抽選は利用できます。</p>';
    }
  }

  function updateSelection() {
    activeTarget = null;
    els.mapStage.classList.remove('throwing');
    setRegionButtons();
    setPrefectureOptions();
    const name = scopeName();
    const count = eligible().length;
    els.mapLocation.textContent = name === '全国' ? '日本全国' : name;
    els.mapKeyText.textContent = prefectureCode === null ? '地図をタップして県を選択' : '選択範囲の地図';
    els.mapNote.innerHTML = '地図上の県をタップしても選べます。<br>一部の離島は地図表示を省略しています。';
    els.selectedScope.textContent = name;
    els.candidateCount.innerHTML = `${count.toLocaleString('ja-JP')} <small>市区町村</small>`;
    els.result.hidden = true;
    renderMap();
  }

  function throwDart() {
    if (!data || !coordinates || busy) return;
    const pool = eligible();
    if (!pool.length) return;
    const city = pool[uniformIndex(pool.length)];
    const place = data.prefectures.find((item) => item.code === city.code);
    busy = true;
    els.throwButton.disabled = true;
    els.prefectureSelect.disabled = true;
    els.throwButton.querySelector('.throw-copy strong').textContent = '投擲中…';
    els.result.hidden = true;
    const {dart, impact, label} = prepareTargetMap(pool, city, place);
    els.mapStage.classList.add('throwing');
    void dart.offsetWidth;
    dart.classList.add('flying');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 850;
    setTimeout(() => {
      impact.classList.add('hit');
      label.classList.add('shown');
    }, delay);
    setTimeout(() => {
      thrown += 1;
      els.resultPrefecture.textContent = place.name;
      els.resultCity.textContent = city.city;
      els.resultCaption.textContent = `${scopeName()}の${pool.length.toLocaleString('ja-JP')}市区町村から、あなたの一投が選びました。`;
      els.resultIndex.textContent = `${String(thrown).padStart(2, '0')} / UNEXPECTED JOURNEY`;
      els.resultLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + city.city)}`;
      els.result.hidden = false;
      $('#result-title').focus({preventScroll:true});
      busy = false;
      els.throwButton.disabled = false;
      els.prefectureSelect.disabled = false;
      els.throwButton.querySelector('.throw-copy strong').textContent = 'この地図に投げる';
      els.mapStage.classList.remove('throwing');
      els.result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    }, delay + 1250);
  }

  window.addEventListener('resize', () => {
    if (activeTarget) drawTargetMap();
  });

  els.prefectureSelect.addEventListener('change', () => {
    if (busy) return;
    prefectureCode = els.prefectureSelect.value ? Number(els.prefectureSelect.value) : null;
    updateSelection();
  });
  els.throwButton.addEventListener('click', throwDart);
  els.retryButton.addEventListener('click', () => {
    document.getElementById('explore').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
    setTimeout(throwDart, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
  });

  Promise.all(['../data/destinations.json', './coordinates.json'].map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('data failed');
    return response.json();
  })).then(([payload, coordinatesPayload]) => {
    const points = coordinatesPayload.points;
    if (!payload.municipalities.every((item) => {
      const position = points[item.id];
      return position && position.length === 2 && position.every(Number.isFinite);
    })) throw new Error('incomplete coordinates');
    data = payload;
    coordinates = points;
    els.totalCount.textContent = data.municipalities.length.toLocaleString('ja-JP');
    updateSelection();
    els.throwButton.disabled = false;
  }).catch(() => {
    els.mapStage.innerHTML = '<p class="map-loading">候補データを読み込めませんでした。ページを再読み込みしてください。</p>';
  });
})();
