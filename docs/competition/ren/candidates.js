(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const els = {
    grid: $('#prefecture-grid'),
    search: $('#candidate-search'),
    prefecture: $('#candidate-prefecture'),
    type: $('#candidate-type'),
    candidateStatus: $('#candidate-status'),
    status: $('#list-status'),
    rows: $('#candidate-rows'),
    more: $('#load-more')
  };
  let data;
  let points;
  let selection;
  let results = [];
  let visible = 0;
  const batch = 48;

  function match(place) {
    if (els.prefecture.value && place.code !== Number(els.prefecture.value)) return false;
    if (els.type.value && !place.city.endsWith(els.type.value)) return false;
    if (els.candidateStatus.value === 'eligible' && !selection.places[place.id].eligible) return false;
    if (els.candidateStatus.value === 'held' && selection.places[place.id].eligible) return false;
    const query = els.search.value.trim().normalize('NFKC').toLowerCase();
    if (!query) return true;
    const pref = data.prefectures.find(item => item.code === place.code);
    return `${pref.name} ${place.city} ${place.id}`.normalize('NFKC').toLowerCase().includes(query);
  }

  function updateGrid() {
    for (const button of els.grid.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', button.dataset.code === els.prefecture.value ? 'true' : 'false');
    }
  }

  function showMore() {
    const fragment = document.createDocumentFragment();
    const prefectures = new Map(data.prefectures.map(pref => [pref.code, pref.name]));
    for (const place of results.slice(visible, visible + batch)) {
      const row = document.createElement('tr');
      const basis = selection.places[place.id];
      if (!basis.eligible) row.className = 'is-held';
      const reasons = basis.evidence.map(item => item.type === 'heritage' ? '日本遺産の構成文化財' : item.type === 'district' ? `${item.name}（伝統的建造物群）` : item.type === 'nature' ? `${item.name}（世界自然遺産）` : item.type === 'onsen' ? `${item.name}（温泉100選 上位10位）` : item.name);
      const reason = basis.eligible ? [...(basis.population >= selection.threshold ? ['人口1万人以上'] : []), ...reasons].join('・') : '人口1万人未満・今回の観光資料には掲載なし';
      for (const [index, value] of [prefectures.get(place.code), place.city, `${basis.population.toLocaleString('ja-JP')}人`, reason, place.id].entries()) {
        const cell = document.createElement('td');
        if (index === 3) {
          const badge = document.createElement('strong');
          badge.className = basis.eligible ? 'verdict eligible' : 'verdict held';
          badge.textContent = basis.eligible ? '抽選対象' : '保留';
          const detail = document.createElement('span');
          detail.className = 'verdict-detail';
          detail.textContent = value;
          cell.append(badge, detail);
        } else cell.textContent = value;
        row.append(cell);
      }
      const cell = document.createElement('td');
      const link = document.createElement('a');
      const [lat, lng] = points[place.id];
      link.href = `https://maps.gsi.go.jp/#12/${lat}/${lng}/&base=pale&ls=pale&disp=1`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '地理院地図 ↗';
      link.setAttribute('aria-label', `${prefectures.get(place.code)}${place.city}の位置を地理院地図で見る`);
      cell.append(link);
      row.append(cell);
      fragment.append(row);
    }
    els.rows.append(fragment);
    visible = Math.min(visible + batch, results.length);
    els.status.textContent = `${results.length.toLocaleString('ja-JP')}件が一致 / ${visible.toLocaleString('ja-JP')}件を表示（抽選対象 ${selection.eligible.toLocaleString('ja-JP')}件・保留 ${(selection.total-selection.eligible).toLocaleString('ja-JP')}件）`;
    els.more.hidden = visible >= results.length;
  }

  function filter() {
    results = data.municipalities.filter(match);
    visible = 0;
    els.rows.replaceChildren();
    updateGrid();
    showMore();
    if (!results.length) els.status.textContent = '一致する候補はありません。条件を変えてお試しください。';
  }

  function buildPrefectures() {
    const fragment = document.createDocumentFragment();
    for (const pref of data.prefectures) {
      const count = selection.byPrefecture.find(item => item.code === pref.code).count;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.code = String(pref.code);
      button.title = `${pref.name}：抽選対象${count}件`;
      button.setAttribute('aria-pressed', 'false');
      const name = document.createElement('span');
      name.textContent = pref.name;
      const value = document.createElement('strong');
      value.textContent = count.toLocaleString('ja-JP');
      button.append(name, value);
      button.addEventListener('click', () => {
        els.prefecture.value = els.prefecture.value === String(pref.code) ? '' : String(pref.code);
        filter();
        $('#list').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      });
      fragment.append(button);
      els.prefecture.add(new Option(pref.name, String(pref.code)));
    }
    els.grid.replaceChildren(fragment);
  }

  Promise.all(['../data/destinations.json', './coordinates.json', '../data/selection.json'].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  })).then(([catalog, coordinates, policy]) => {
    if (catalog.municipalities.length !== 1741 || catalog.prefectures.length !== 47 ||
        policy.total !== 1741 || policy.eligible !== 1432 ||
        catalog.municipalities.some(place => !coordinates.points[place.id] || !policy.places[place.id])) throw new Error('候補データが不完全です');
    data = catalog;
    points = coordinates.points;
    selection = policy;
    buildPrefectures();
    filter();
    els.search.addEventListener('input', filter);
    els.prefecture.addEventListener('change', filter);
    els.type.addEventListener('change', filter);
    els.candidateStatus.addEventListener('change', filter);
    els.more.addEventListener('click', showMore);
  }).catch(() => {
    els.status.textContent = '候補を読み込めませんでした。再読み込みしてください。';
    els.grid.textContent = '候補を読み込めませんでした。';
  });
})();
