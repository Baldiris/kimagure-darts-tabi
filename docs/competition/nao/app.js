(() => {
  const regionHost = document.querySelector('#regions');
  const prefSelect = document.querySelector('#prefecture');
  const board = document.querySelector('#dartboard');
  const count = document.querySelector('#pool-count');
  const heroCount = document.querySelector('#hero-count');
  const status = document.querySelector('#status');
  const cue = document.querySelector('#tap-cue');
  const result = document.querySelector('#result');
  const resultPref = document.querySelector('#result-pref');
  const resultCity = document.querySelector('#result-city');
  const mapLink = document.querySelector('#map-link');
  const again = document.querySelector('#again');
  const photoNote = document.querySelector('#photo-note');

  let data = null;
  let region = '全国';
  let selectedCode = '';
  let throwing = false;
  let timer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat('ja-JP');

  function pool() {
    if (!data) return [];
    const allowed = new Set(data.prefectures.filter(p => (region === '全国' || p.region === region) && (!selectedCode || String(p.code) === selectedCode)).map(p => p.code));
    return data.municipalities.filter(city => allowed.has(city.code));
  }

  function renderRegions() {
    regionHost.replaceChildren();
    ['全国', ...data.regions].forEach(name => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'region-button';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(name === region));
      button.addEventListener('click', () => {
        if (throwing || region === name) return;
        region = name;
        selectedCode = '';
        clearResult();
        renderRegions();
        renderPrefectures();
        renderCount();
      });
      regionHost.append(button);
    });
  }

  function renderPrefectures() {
    prefSelect.replaceChildren(new Option('都道府県は指定しない', ''));
    data.prefectures.filter(p => region === '全国' || p.region === region).forEach(p => {
      prefSelect.add(new Option(p.name, String(p.code)));
    });
    prefSelect.value = selectedCode;
  }

  function renderCount() {
    const amount = pool().length;
    const label = selectedCode ? data.prefectures.find(p => String(p.code) === selectedCode)?.name : region;
    count.textContent = `${label}から ${format.format(amount)} の候補`;
    status.textContent = amount ? `候補は ${format.format(amount)} 市区町村。盤面をタップして投げてください。` : 'この範囲には候補がありません。';
    board.disabled = !amount;
  }

  function clearResult() {
    if (timer) clearTimeout(timer);
    timer = null;
    result.hidden = true;
    photoNote.hidden = true;
    board.classList.remove('throwing', 'landed');
    cue.textContent = '↖ 盤面をタップして、ダーツを投げる';
  }

  function throwDart() {
    if (!data || throwing) return;
    const candidates = pool();
    if (!candidates.length) return;
    const city = candidates[Math.floor(Math.random() * candidates.length)];
    const prefecture = data.prefectures.find(p => p.code === city.code);
    if (!prefecture) return;
    throwing = true;
    clearResult();
    board.disabled = true;
    prefSelect.disabled = true;
    regionHost.querySelectorAll('button').forEach(button => button.disabled = true);
    // Restart the CSS flight even after a previous throw.
    void board.offsetWidth;
    board.classList.add('throwing');
    cue.textContent = 'どこに当たるかな…';
    status.textContent = 'ダーツを投げています。';
    timer = setTimeout(() => {
      board.classList.remove('throwing');
      board.classList.add('landed');
      resultPref.textContent = prefecture.name;
      resultCity.textContent = city.city;
      resultCity.tabIndex = -1;
      mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prefecture.name + ' ' + city.city)}`;
      result.hidden = false;
      photoNote.hidden = false;
      status.textContent = `${prefecture.name}${city.city}に決まりました。`;
      cue.textContent = 'この町に、決まり。';
      throwing = false;
      board.disabled = false;
      prefSelect.disabled = false;
      regionHost.querySelectorAll('button').forEach(button => button.disabled = false);
      resultCity.focus({preventScroll:true});
      result.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth', block:'center'});
    }, reducedMotion.matches ? 30 : 1120);
  }

  prefSelect.addEventListener('change', () => {
    if (throwing) return;
    selectedCode = prefSelect.value;
    clearResult();
    renderCount();
  });
  board.addEventListener('click', throwDart);
  again.addEventListener('click', () => {
    board.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth', block:'center'});
    throwDart();
  });

  fetch('../data/destinations.json').then(response => {
    if (!response.ok) throw new Error('destination data unavailable');
    return response.json();
  }).then(value => {
    if (!Array.isArray(value.prefectures) || !Array.isArray(value.municipalities) || !Array.isArray(value.regions)) throw new Error('destination data invalid');
    data = value;
    heroCount.textContent = format.format(data.municipalities.length);
    renderRegions();
    renderPrefectures();
    renderCount();
  }).catch(() => {
    status.textContent = '行き先データを読み込めませんでした。ページを再読み込みしてください。';
    count.textContent = '読み込みエラー';
  });
})();
