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
  let region = '全国';
  let prefectureCode = null;
  let mapRequest = 0;
  let thrown = 0;
  let busy = false;

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
    setRegionButtons();
    setPrefectureOptions();
    const name = scopeName();
    const count = eligible().length;
    els.mapLocation.textContent = name === '全国' ? '日本全国' : name;
    els.mapKeyText.textContent = prefectureCode === null ? '地図をタップして県を選択' : '選択範囲の地図';
    els.selectedScope.textContent = name;
    els.candidateCount.innerHTML = `${count.toLocaleString('ja-JP')} <small>市区町村</small>`;
    els.result.hidden = true;
    renderMap();
  }

  function throwDart() {
    if (!data || busy) return;
    const pool = eligible();
    if (!pool.length) return;
    busy = true;
    els.throwButton.disabled = true;
    els.prefectureSelect.disabled = true;
    els.throwButton.querySelector('.throw-copy strong').textContent = '投擲中…';
    els.result.hidden = true;
    els.mapStage.classList.add('throwing');
    const dart = els.mapStage.querySelector('.throw-dart');
    const impact = els.mapStage.querySelector('.impact');
    dart?.classList.remove('flying');
    impact?.classList.remove('hit');
    void dart?.offsetWidth;
    dart?.classList.add('flying');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 850;
    setTimeout(() => impact?.classList.add('hit'), delay);
    setTimeout(() => {
      const city = pool[uniformIndex(pool.length)];
      const place = data.prefectures.find((item) => item.code === city.code);
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
    }, delay + 420);
  }

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

  fetch('../data/destinations.json').then((response) => {
    if (!response.ok) throw new Error('data failed');
    return response.json();
  }).then((payload) => {
    data = payload;
    els.totalCount.textContent = data.municipalities.length.toLocaleString('ja-JP');
    updateSelection();
    els.throwButton.disabled = false;
  }).catch(() => {
    els.mapStage.innerHTML = '<p class="map-loading">候補データを読み込めませんでした。ページを再読み込みしてください。</p>';
  });
})();
