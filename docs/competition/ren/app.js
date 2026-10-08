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
  function findRegionSelect() {
    const select=$('#region-select');
    if (select) return select;
    // Older cached HTML contains the region button group.
    const previous=$('#region-list');
    const label=document.createElement('label');
    label.className='pref-select-label region-select-label';
    label.htmlFor='region-select';
    label.append(document.createTextNode('地域'));
    const wrap=document.createElement('span');
    wrap.className='select-wrap';
    const native=document.createElement('select');
    native.id='region-select';
    native.disabled=true;
    wrap.append(native);label.append(wrap);previous.replaceWith(label);
    return native;
  }
  const els = {
    regionList: findRegionSelect(),
    prefectureSelect: $('#prefecture-select'),
    mapStage: $('#map-stage'),
    mapKeyText: $('#map-key-text'),
    mapLocation: $('#map-location'),
    mapNote: $('#map-note'),
    coordinateBottom: $('#coordinate-bottom'),
    sourceNote: $('#gsi-source-note'),
    selectedScope: $('#selected-scope'),
    candidateCount: $('#candidate-count'),
    totalCount: $('#total-count'),
    throwButton: $('#throw-button'),
    result: $('#result'),
    resultPrefecture: $('#result-prefecture'),
    resultCity: $('#result-city'),
    resultCaption: $('#result-caption'),
    resultReason: $('#result-reason'),
    resultFacts: $('#result-facts'),
    localNotesTitle: $('#local-notes-title'),
    resultIndex: $('#result-index'),
    resultLink: $('#result-map-link'),
    focusMapButton: $('#focus-map-button'),
    retryButton: $('#retry-button')
  };

  let data = null;
  let coordinates = null;
  let selection = null;
  let placeFacts = null;
  let region = '全国';
  let prefectureCode = null;
  let mapRequest = 0;
  let thrown = 0;
  let busy = false;
  let activeTarget = null;
  let lastDestinationId = null;

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

  function renderFacts(id) {
    const fact = placeFacts.places[id];
    const cards = [];
    if (fact.sight) {
      const {kind, name, url} = fact.sight;
      const copy = {
        nature: ['世界自然遺産', `環境省の世界自然遺産「${name}」の構成地域です。`, '環境省'],
        district: ['歴史の町並み', `文化庁が「${name}」を重要伝統的建造物群保存地区に選定しています。`, '文化庁'],
        park: ['国立公園', `環境省が示す「${name}」の関係市町村に含まれます。`, '環境省'],
        heritage: ['日本遺産', '文化庁の日本遺産ポータルに、この町の構成文化財が掲載されています。', '文化庁']
      }[kind];
      cards.push({title: copy[0], body: copy[1], source: copy[2], url});
    }
    if (fact.crop) {
      const [product, amount, rank] = fact.crop;
      const value = (amount / 10).toLocaleString('ja-JP', {maximumFractionDigits: 1});
      cards.push({title: '農業の一面', body: `2024年の農業産出額（推計）では、${product}が${value}億円${rank <= 100 ? `・全国${rank}位` : ''}。`, source: '農林水産省', url: placeFacts.sourceUrls.agriculture});
    }
    const [area, habitable] = fact.area;
    cards.push({title: '町のスケール', body: `2024年の総面積は${area.toLocaleString('ja-JP')}km²、可住地面積は${habitable.toLocaleString('ja-JP')}km²。`, source: '総務省統計局', url: placeFacts.sourceUrls.area});

    els.resultFacts.replaceChildren(...cards.map(({title, body, source, url}) => {
      const card = document.createElement('article');
      card.className = 'local-note';
      const heading = document.createElement('h4');
      heading.textContent = title;
      const description = document.createElement('p');
      description.textContent = body;
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${source}の資料 ↗`;
      card.append(heading, description, link);
      return card;
    }));
  }

  function uniformIndex(length) {
    const ceiling = 0x100000000;
    const limit = Math.floor(ceiling / length) * length;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % length;
  }

  // XYZ tiles and municipal coordinates use the same Web Mercator projection.
  // Work at zoom 0, then scale both tiles and points by 2^zoom.
  function mercator(lat, lng) {
    const radians = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
    return {
      x: (lng + 180) / 360 * 256,
      y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * 256
    };
  }

  function cityPoint(city) {
    const [lat, lng] = coordinates[city.id];
    return mercator(lat, lng);
  }

  function fitView(pool, width, height) {
    const points = pool.map(cityPoint);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const availableWidth = Math.max(100, width - Math.max(120, width * .22));
    const availableHeight = Math.max(100, height - Math.max(125, height * .32));
    const zoom = Math.max(3, Math.min(12, Math.log2(Math.min(
      availableWidth / (maxX - minX || .01),
      availableHeight / (maxY - minY || .01)
    ))));
    return {x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom};
  }

  function screenPoint(point, view, width, height) {
    const scale = 2 ** view.zoom;
    return {x: width / 2 + (point.x - view.x) * scale, y: height / 2 + (point.y - view.y) * scale};
  }

  function drawTiles(target, width, height) {
    const {view, tileLayer, mapStatus} = target;
    const tileZoom = Math.max(5, Math.min(18, Math.floor(view.zoom)));
    const tileScale = 2 ** (view.zoom - tileZoom);
    const tileSize = 256 * tileScale;
    const centerX = view.x * (2 ** tileZoom);
    const centerY = view.y * (2 ** tileZoom);
    const firstX = Math.floor((centerX - width / (2 * tileScale)) / 256);
    const lastX = Math.floor((centerX + width / (2 * tileScale)) / 256);
    const firstY = Math.floor((centerY - height / (2 * tileScale)) / 256);
    const lastY = Math.floor((centerY + height / (2 * tileScale)) / 256);
    const sequence = ++target.tileSequence;
    const tiles = document.createDocumentFragment();
    let count = 0;
    let failed = 0;
    mapStatus.textContent = '地理院地図を読み込み中…';
    mapStatus.hidden = false;
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        if (x < 0 || y < 0 || x >= 2 ** tileZoom || y >= 2 ** tileZoom) continue;
        count += 1;
        const tile = document.createElement('img');
        tile.className = 'gsi-tile';
        tile.alt = '';
        tile.draggable = false;
        tile.style.left = `${width / 2 + (x * 256 - centerX) * tileScale}px`;
        tile.style.top = `${height / 2 + (y * 256 - centerY) * tileScale}px`;
        tile.style.width = `${tileSize + .5}px`;
        tile.style.height = `${tileSize + .5}px`;
        tile.addEventListener('load', () => {
          if (sequence === target.tileSequence) mapStatus.hidden = true;
        }, {once:true});
        tile.addEventListener('error', () => {
          failed += 1;
          if (sequence === target.tileSequence && failed === count) {
            mapStatus.textContent = '地図の画像を取得できません。町の位置は点で表示しています。';
          }
        }, {once:true});
        tile.src = `https://cyberjapandata.gsi.go.jp/xyz/pale/${tileZoom}/${x}/${y}.png`;
        tiles.append(tile);
      }
    }
    tileLayer.replaceChildren(tiles);
    els.sourceNote.hidden = false;
    els.sourceNote.querySelector('.shoreline-credit').hidden = tileZoom >= 9;
  }

  function drawTargetMap(refreshTiles=true) {
    if (!activeTarget) return;
    const target = activeTarget;
    const {pool, city, place, canvas, impact, dart, label, view} = target;
    const {width, height} = els.mapStage.getBoundingClientRect();
    if (!width || !height) return;
    if (!view) target.view = fitView(pool, width, height);
    if (refreshTiles) drawTiles(target, width, height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.fillStyle = '#27674b';
    context.globalAlpha = pool.length > 500 ? .68 : .78;
    context.beginPath();
    const radius = pool.length > 500 ? 2.2 : pool.length > 60 ? 2.9 : 3.7;
    for (const item of pool) {
      const point = screenPoint(cityPoint(item), target.view, width, height);
      if (point.x < -10 || point.x > width + 10 || point.y < -10 || point.y > height + 10) continue;
      context.moveTo(point.x + radius, point.y);
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.globalAlpha = 1;
    const winner = screenPoint(cityPoint(city), target.view, width, height);
    if (target.landed) {
    context.beginPath();
    context.arc(winner.x, winner.y, radius + 4, 0, Math.PI * 2);
    context.fillStyle = '#fffdf7';
    context.fill();
    context.beginPath();
    context.arc(winner.x, winner.y, radius + 1.5, 0, Math.PI * 2);
    context.fillStyle = '#de6746';
    context.fill();
    }
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
    target.focusButton.disabled = busy;
    target.focusButton.textContent = target.detail ? '範囲全体に戻す ↗' : '着弾地点を拡大 ↗';
    els.mapStage.setAttribute('aria-label', target.landed ? `${scopeName()}の地理院地図。${place.name}${city.city}に着弾` : `${scopeName()}の地理院地図。点は候補の町の位置です。`);
  }

  function focusWinner() {
    if (!activeTarget || busy) return;
    const target = activeTarget;
    if (target.detail) {
      const {width, height} = els.mapStage.getBoundingClientRect();
      target.view = fitView(target.pool, width, height);
      target.detail = false;
    } else {
      const point = cityPoint(target.city);
      target.view = {...point, zoom: 11};
      target.detail = true;
    }
    drawTargetMap();
  }

  function prepareTargetMap(pool, city, place) {
    mapRequest += 1;
    const mapRoot = document.createElement('div');
    mapRoot.className = 'gsi-map';
    const tileLayer = document.createElement('div');
    tileLayer.className = 'gsi-tiles';
    tileLayer.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    canvas.className = 'gsi-points';
    canvas.setAttribute('aria-hidden', 'true');
    const mapStatus = document.createElement('p');
    mapStatus.className = 'gsi-status';
    mapStatus.setAttribute('role', 'status');
    const controls = document.createElement('div');
    controls.className = 'gsi-controls';
    const focusButton = document.createElement('button');
    focusButton.type = 'button';
    focusButton.addEventListener('click', focusWinner);
    controls.append(focusButton);
    const attribution = document.createElement('a');
    attribution.className = 'gsi-attribution';
    attribution.href = 'https://maps.gsi.go.jp/development/ichiran.html';
    attribution.target = '_blank';
    attribution.rel = 'noopener noreferrer';
    attribution.textContent = '出典：国土地理院・地理院タイル ↗';
    mapRoot.append(tileLayer, canvas, mapStatus, controls, attribution);
    const dart = document.createElement('div');
    dart.className = 'throw-dart';
    dart.setAttribute('aria-hidden', 'true');
    dart.innerHTML = '<svg class="ren-real-dart" viewBox="0 0 152 44"><defs><linearGradient id="dart-metal" x2="0" y2="1"><stop stop-color="#f8f6ec"/><stop offset=".5" stop-color="#717b80"/><stop offset="1" stop-color="#e8e4d7"/></linearGradient></defs><path d="M0 3 37 15 31 22 37 29 0 41 9 22Z" fill="#cc4d35"/><path d="M3 22h36M10 10l13 12-13 12" fill="none" stroke="#87372b" stroke-width="1.5"/><path d="M32 19h68v6H32Z" fill="url(#dart-metal)"/><path d="M82 17h45v10H82Z" fill="#d4ac64" stroke="#6b5b42"/><path d="M88 18v8m6-8v8m6-8v8m6-8v8m6-8v8m6-8v8" stroke="#71664d"/><path d="M127 20 152 22 127 24Z" fill="#4c5253"/></svg>';
    const impact = document.createElement('div');
    impact.className = 'impact';
    impact.setAttribute('aria-hidden', 'true');
    const label = document.createElement('div');
    label.className = 'impact-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<small></small><strong></strong><span>↗</span>';
    els.mapStage.classList.add('gsi-mode');
    els.mapStage.parentElement.classList.add('gsi-active');
    els.mapStage.replaceChildren(mapRoot, dart, impact, label);
    activeTarget = {pool, city, place, mapRoot, tileLayer, canvas, mapStatus, focusButton, dart, impact, label, view:null, detail:false, landed:false, tileSequence:0};
    drawTargetMap();
    els.mapKeyText.textContent = '緑の点＝候補の市区町村';
    els.coordinateBottom.textContent = `${pool.length.toLocaleString('ja-JP')}市区町村`;
    els.mapNote.textContent = '地理院地図に候補の町を表示しています。';
    return activeTarget;
  }

  function setRegionButtons() {
    els.regionList.replaceChildren(...['全国', ...data.regions].map(name=>new Option(name,name)));
    els.regionList.value = region;
    els.regionList.disabled = busy;
  }

  function setPrefectureOptions() {
    els.prefectureSelect.replaceChildren();
    const allOption = new Option('指定しない', '');
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
      dart.innerHTML = '<svg class="ren-real-dart" viewBox="0 0 152 44"><defs><linearGradient id="dart-metal" x2="0" y2="1"><stop stop-color="#f8f6ec"/><stop offset=".5" stop-color="#717b80"/><stop offset="1" stop-color="#e8e4d7"/></linearGradient></defs><path d="M0 3 37 15 31 22 37 29 0 41 9 22Z" fill="#cc4d35"/><path d="M3 22h36M10 10l13 12-13 12" fill="none" stroke="#87372b" stroke-width="1.5"/><path d="M32 19h68v6H32Z" fill="url(#dart-metal)"/><path d="M82 17h45v10H82Z" fill="#d4ac64" stroke="#6b5b42"/><path d="M88 18v8m6-8v8m6-8v8m6-8v8m6-8v8m6-8v8" stroke="#71664d"/><path d="M127 20 152 22 127 24Z" fill="#4c5253"/></svg>';
      const impact = document.createElement('div');
      impact.className = 'impact';
      els.mapStage.append(dart, impact);
    } catch {
      if (current === mapRequest) els.mapStage.innerHTML = '<p class="map-loading">地図を表示できませんでした。範囲の選択と抽選は利用できます。</p>';
    }
  }

  function updateSelection() {
    activeTarget = null;
    els.mapStage.classList.remove('throwing', 'gsi-mode');
    els.mapStage.parentElement.classList.remove('gsi-active');
    els.sourceNote.hidden = true;
    setRegionButtons();
    setPrefectureOptions();
    const name = scopeName();
    const count = eligible().length;
    els.mapLocation.textContent = name === '全国' ? '日本全国' : name;
    els.mapKeyText.textContent = prefectureCode === null ? '地図をタップして県を選択' : '選択範囲の地図';
    els.coordinateBottom.textContent = name === '全国' ? '47都道府県' : '地域地図';
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
    const withoutPrevious = pool.filter(item=>item.id!==lastDestinationId);
    const drawPool = withoutPrevious.length ? withoutPrevious : pool;
    const city = drawPool[uniformIndex(drawPool.length)];
    const place = data.prefectures.find((item) => item.code === city.code);
    busy = true;
    els.throwButton.disabled = true;
    els.prefectureSelect.disabled = true;
    els.regionList.disabled = true;
    els.throwButton.querySelector('.throw-copy strong').textContent = '着弾を待っています…';
    els.result.hidden = true;
    const {dart, impact, label} = prepareTargetMap(pool, city, place);
    els.mapStage.classList.add('throwing');
    void dart.offsetWidth;
    dart.classList.add('flying');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 20 : 1450;
    setTimeout(() => {
      if (activeTarget) {activeTarget.landed=true;drawTargetMap(false);}
      impact.classList.add('hit');
      label.classList.add('shown');
    }, delay);
    setTimeout(() => {
      thrown += 1;
      lastDestinationId = city.id;
      els.resultPrefecture.textContent = place.name;
      els.resultCity.textContent = city.city;
      els.resultCaption.textContent = `${scopeName()}の${pool.length.toLocaleString('ja-JP')}市区町村から選ばれました。`;
      const basis = selection.places[city.id];
      const reasons = [
        ...(basis.population >= selection.threshold ? [`人口 ${basis.population.toLocaleString('ja-JP')}人`] : []),
        ...basis.evidence.map(item => item.type === 'heritage' ? '日本遺産の構成文化財' : item.type === 'district' ? `${item.name}（伝統的建造物群）` : item.type === 'nature' ? `${item.name}（世界自然遺産）` : item.type === 'onsen' ? `${item.name}（温泉100選 上位10位）` : item.name)
      ];
      els.resultReason.textContent = `選定理由：${reasons.join('・')}`;
      els.localNotesTitle.textContent = `${city.city}のデータ`;
      renderFacts(city.id);
      els.resultIndex.textContent = `${thrown}投目`;
      els.resultLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + city.city)}`;
      els.result.hidden = false;
      $('#result-title').focus({preventScroll:true});
      busy = false;
      els.throwButton.disabled = false;
      els.prefectureSelect.disabled = false;
      els.regionList.disabled = false;
      if (activeTarget) activeTarget.focusButton.disabled=false;
      els.throwButton.querySelector('.throw-copy strong').textContent = 'ダーツを投げる';
      els.mapStage.classList.remove('throwing');
      els.result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }, delay + (reduced ? 0 : 1300));
  }

  window.addEventListener('resize', () => {
    if (activeTarget) {
      if (!activeTarget.detail) {
        const {width, height} = els.mapStage.getBoundingClientRect();
        activeTarget.view = fitView(activeTarget.pool, width, height);
      }
      drawTargetMap();
    }
  });

  els.regionList.addEventListener('change', () => {
    if (busy) return;
    region=els.regionList.value;
    prefectureCode=null;
    updateSelection();
  });
  els.prefectureSelect.addEventListener('change', () => {
    if (busy) return;
    prefectureCode = els.prefectureSelect.value ? Number(els.prefectureSelect.value) : null;
    if (prefectureCode !== null) region = prefecture().region;
    updateSelection();
  });
  els.throwButton.addEventListener('click', throwDart);
  els.focusMapButton.addEventListener('click', () => {
    if (!activeTarget) return;
    if (!activeTarget.detail) focusWinner();
    els.mapStage.parentElement.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center'
    });
  });
  els.retryButton.addEventListener('click', () => {
    document.getElementById('explore').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
    setTimeout(throwDart, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
  });

  Promise.all(['../data/destinations.json', './coordinates.json', '../data/selection.json', '../data/place-facts.json'].map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('data failed');
    return response.json();
  })).then(([payload, coordinatesPayload, policy, facts]) => {
    const points = coordinatesPayload.points;
    if (payload.municipalities.length !== policy.total ||
        Object.keys(policy.places).length !== policy.total ||
        payload.municipalities.filter(item => policy.places[item.id]?.eligible).length !== policy.eligible ||
        Object.keys(facts.places).length !== policy.eligible ||
        payload.municipalities.some(item => policy.places[item.id]?.eligible && !facts.places[item.id])) throw new Error('incomplete selection');
    if (!payload.municipalities.every((item) => {
      const position = points[item.id];
      return position && position.length === 2 && position.every(Number.isFinite);
    })) throw new Error('incomplete coordinates');
    data = {...payload, municipalities: payload.municipalities.filter(item => policy.places[item.id].eligible)};
    selection = policy;
    placeFacts = facts;
    coordinates = points;
    els.totalCount.textContent = data.municipalities.length.toLocaleString('ja-JP');
    updateSelection();
    els.throwButton.disabled = false;
  }).catch(() => {
    els.mapStage.innerHTML = '<p class="map-loading">候補データを読み込めませんでした。ページを再読み込みしてください。</p>';
  });
})();
