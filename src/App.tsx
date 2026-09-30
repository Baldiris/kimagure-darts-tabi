import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Compass, Crosshair, ExternalLink, History, Info, MapPin, Navigation2, RotateCcw, Utensils, X} from 'lucide-react';
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import {destinations, pickDestination, type Destination} from '@/lib/destinations';
import {loadTravelState, findDestination, resolveRoute, validAreas, type Area, type TripRecord, type TravelState} from '@/lib/travel-state';
type Screen = 'explore' | 'result' | 'history';
type Stage = 'ready' | 'flying' | 'landed';
const areaDescriptions: Record<string, string> = {'全国':'日本のどこかへ','北海道・東北':'7都道府県','関東':'7都道府県','中部':'9都道府県','近畿':'7都道府県','中国':'5都道府県','四国':'4都道府県','九州・沖縄':'8都道府県'};
const mapUrl = (destination: Destination, suffix = '') => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.prefecture} ${destination.city}${suffix}`)}`;
const dateLabel = (timestamp: number) => timestamp ? new Intl.DateTimeFormat('ja-JP', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(timestamp) : '保存した旅先';
function JapanMap({area, selected, spinning = false}: {area: Area; selected: Destination | null; spinning?: boolean}) {
 const [markup, setMarkup] = useState(''), [failed, setFailed] = useState(false), [point, setPoint] = useState<{x:number; y:number} | null>(null);
 const mapRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const abort = new AbortController();
  fetch('./assets/japan.svg', {signal:abort.signal}).then(response => {if (!response.ok) throw new Error('map'); return response.text();}).then(setMarkup).catch(error => {if (error.name !== 'AbortError') setFailed(true);});
  return () => abort.abort();
 }, []);
 const coloredMarkup = useMemo(() => {
  if (!markup) return '';
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  document.querySelectorAll<SVGElement>('.prefecture').forEach(element => {
   const destination = findDestination(Number(element.dataset.code));
   element.style.fill = selected?.code === destination?.code ? '#163af1' : destination && (area === '全国' || destination.region === area) ? '#a9c2ee' : '#dde5ef';
   element.style.stroke = '#f4f7fb'; element.style.strokeWidth = '2.5';
  });
  return new XMLSerializer().serializeToString(document.documentElement);
 }, [markup, area, selected?.code]);
 useEffect(() => {
  const container = mapRef.current;
  const group = container?.querySelector<SVGGraphicsElement>(`[data-code="${selected?.code}"]`), svg = container?.querySelector('svg');
  const prefecture = group && (Array.from(group.querySelectorAll<SVGGraphicsElement>('polygon,path')).sort((a, b) => {const x = a.getBBox(), y = b.getBBox(); return y.width * y.height - x.width * x.height;})[0] ?? group);
  if (!prefecture || !svg) {setPoint(null); return;}
  const bounds = prefecture.getBBox(), matrix = prefecture.getCTM(), inverse = svg.getCTM()?.inverse();
  if (!matrix || !inverse) {setPoint(null); return;}
  const center = svg.createSVGPoint(); center.x = bounds.x + bounds.width / 2; center.y = bounds.y + bounds.height / 2;
  const position = center.matrixTransform(matrix).matrixTransform(inverse); setPoint({x:position.x, y:position.y});
 }, [coloredMarkup, selected?.code]);
 return <div className={`japan-map ${spinning ? 'map-spinning' : ''}`} role="img" aria-label={selected ? `${selected.prefecture}に当たった日本地図。一部の離島は省略されています。` : `${area}の抽選対象を示す日本地図。一部の離島は省略されています。`}>
  {coloredMarkup ? <div className="map-svg" ref={mapRef} aria-hidden="true" dangerouslySetInnerHTML={{__html:coloredMarkup}}/> : <p className="map-placeholder">{failed ? '地図を表示できませんでした。抽選は利用できます。' : '地図を読み込み中…'}</p>}
  {point && <svg className="map-marker" viewBox="0 0 1000 1000" aria-hidden="true"><circle className="landing-ring" cx={point.x} cy={point.y} r="39"/><circle cx={point.x} cy={point.y} r="17" fill="#eaff48" stroke="#163af1" strokeWidth="7"/><Navigation2 x={point.x - 10} y={point.y - 75} width="72" height="72" fill="#eaff48" stroke="#163af1" strokeWidth="3" transform={`rotate(190 ${point.x + 25} ${point.y - 35})`}/></svg>}
 </div>;
}
export default function App() {
 const [travel, setTravel] = useState<TravelState>(loadTravelState);
 const [screen, setScreen] = useState<Screen>(() => resolveRoute(window.location.hash, loadTravelState()).screen);
 const [stage, setStage] = useState<Stage>('ready'), [ticker, setTicker] = useState(''), [landing, setLanding] = useState<Destination | null>(null);
 const [infoOpen, setInfoOpen] = useState(false), [historyFilter, setHistoryFilter] = useState<'all' | 'saved'>('all'), [storageFailed, setStorageFailed] = useState(false), [announcement, setAnnouncement] = useState('');
 const running = useRef(false), timeouts = useRef<ReturnType<typeof setTimeout>[]>([]), reel = useRef<ReturnType<typeof setInterval> | null>(null);
 const screenHeading = useRef<HTMLHeadingElement>(null), sceneRef = useRef<HTMLDivElement>(null), firstRender = useRef(true);
 const {area, history, savedCodes, lastResult} = travel, busy = stage !== 'ready';
 const pool = useMemo(() => destinations.filter(destination => area === '全国' || destination.region === area), [area]);
 const result = lastResult ? findDestination(lastResult.code) : null, saved = result ? savedCodes.includes(result.code) : false;
 const clearDraw = useCallback(() => {timeouts.current.forEach(clearTimeout); timeouts.current = []; if (reel.current) clearInterval(reel.current); reel.current = null; running.current = false;}, []);
 useEffect(() => clearDraw, [clearDraw]);
 useEffect(() => {try {localStorage.setItem('kimagure-darts-travel-v2', JSON.stringify(travel));} catch {setStorageFailed(true);}}, [travel]);
 useEffect(() => {if (firstRender.current) {firstRender.current = false; return;} window.scrollTo({top:0, behavior:'instant'}); screenHeading.current?.focus({preventScroll:true});}, [screen]);
 function navigate(next: Screen, recordId?: string, replace = false) {
  const hash = next === 'result' ? `#trip=${recordId}` : `#${next}`;
  if (window.location.hash !== hash) window.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  setScreen(next);
 }
 useEffect(() => {
  const initial = resolveRoute(window.location.hash, loadTravelState());
  if (initial.record) setTravel(current => ({...current, lastResult:initial.record!}));
  navigate(initial.screen, initial.record?.id, true);
 }, []);
 useEffect(() => {
  const restore = () => {
   clearDraw(); setStage('ready'); setLanding(null);
   const route = resolveRoute(window.location.hash, travel);
   if (route.record) setTravel(current => ({...current, lastResult:route.record!}));
   setScreen(route.screen);
  };
  window.addEventListener('popstate', restore); window.addEventListener('hashchange', restore);
  return () => {window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore);};
 }, [travel, clearDraw]);
 function goExplore(selected?: Area) {if (running.current) return; setStage('ready'); setLanding(null); if (selected) setTravel(current => ({...current, area:selected})); navigate('explore');}
 function openResult(record: TripRecord) {setTravel(current => ({...current, lastResult:record})); navigate('result', record.id);}
 function toggleSaved(destination: Destination) {
  const isSaved = savedCodes.includes(destination.code);
  setTravel(current => ({...current, savedCodes:isSaved ? current.savedCodes.filter(code => code !== destination.code) : [destination.code, ...current.savedCodes]}));
  setAnnouncement(`${destination.city}を${isSaved ? '保存から外しました' : '保存しました'}。`);
 }
 function throwDart(selectedArea: Area = area) {
  if (running.current) return; clearDraw(); running.current = true;
  const chosen = pickDestination(selectedArea), reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drawPool = destinations.filter(destination => selectedArea === '全国' || destination.region === selectedArea);
  const record: TripRecord = {id:crypto.randomUUID(), code:chosen.code, area:selectedArea, drawnAt:Date.now()};
  setTravel(current => ({...current, area:selectedArea}));
  navigate('explore', undefined, screen === 'result'); setStage('flying'); setLanding(null); setTicker(drawPool[0].city); setAnnouncement(`${selectedArea}から行き先を抽選しています。`);
  requestAnimationFrame(() => sceneRef.current?.scrollIntoView({block:'start', behavior:reduced ? 'instant' : 'smooth'}));
  if (!reduced) reel.current = setInterval(() => setTicker(drawPool[Math.floor(Math.random() * drawPool.length)].city), 85);
  timeouts.current.push(setTimeout(() => {
   if (reel.current) clearInterval(reel.current); reel.current = null; setTicker(chosen.city); setLanding(chosen); setStage('landed');
   timeouts.current.push(setTimeout(() => {setTravel(current => ({...current, lastResult:record, history:[record, ...current.history].slice(0, 30)})); setStage('ready'); navigate('result', record.id); setAnnouncement(`旅先は${chosen.prefecture}の${chosen.city}に決まりました。`); running.current = false;}, reduced ? 0 : 520));
  }, reduced ? 100 : 1750));
 }
 function cancelDraw() {clearDraw(); setStage('ready'); setLanding(null); setAnnouncement('抽選を中止しました。');}
 useEffect(() => {
  const context = (document as Document & {modelContext?: {registerTool: (tool:unknown, options:{signal:AbortSignal}) => void}}).modelContext;
  if (!context?.registerTool) return; const abort = new AbortController();
  try {context.registerTool({name:'start_darts_trip', title:'ダーツ旅をはじめる', description:'エリアを指定して抽選の準備をします。抽選はまだ実行しません。', inputSchema:{type:'object', properties:{area:{type:'string', enum:validAreas}}, required:['area'], additionalProperties:false}, annotations:{readOnlyHint:false, untrustedContentHint:false}, execute:async (input:unknown) => {
   const selected = (input as {area?: Area})?.area;
   if (!selected || !validAreas.includes(selected)) throw new Error('有効なエリアを指定してください');
   if (running.current) throw new Error('抽選が終わるまでお待ちください');
   goExplore(selected); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); return {status:'ready', area:selected};
  }}, {signal:abort.signal});} catch {} return () => abort.abort();
 }, []);
 const historyItems: TripRecord[] = historyFilter === 'all' ? history : savedCodes.map(code => history.find(record => record.code === code) ?? {id:`saved-${code}`, code, area:findDestination(code)!.region as Area, drawnAt:0});
 return <>
  <a className="skip-link" href="#main-content" onClick={event => {event.preventDefault(); document.getElementById('main-content')?.focus();}}>メインの操作へ</a>
  <header className="app-header"><button className="brand" onClick={() => goExplore()} disabled={busy} aria-label="きまぐれダーツ旅 ホーム"><span className="brand-icon"><Crosshair/></span><span>きまぐれ<em>ダーツ旅</em></span></button><nav aria-label="メインナビゲーション" className="app-nav"><button className={`nav-item explore-nav ${screen !== 'history' ? 'active' : ''}`} aria-current={screen !== 'history' ? 'page' : undefined} onClick={() => goExplore()} disabled={busy}><Compass size={18}/>行き先を決める</button><button className={`nav-item ${screen === 'history' ? 'active' : ''}`} aria-current={screen === 'history' ? 'page' : undefined} onClick={() => navigate('history')} disabled={busy}><History size={18}/><span>旅の履歴</span>{history.length > 0 && <span className="nav-count">{history.length}</span>}</button></nav><button className="info-button" aria-label="使い方と抽選について" disabled={busy} onClick={() => setInfoOpen(true)}><Info size={20}/></button></header>
  <main id="main-content" tabIndex={-1} className={`app-main screen-${screen}`}>
   {storageFailed && <p className="storage-notice">このブラウザでは履歴を保存できません。抽選と地図は利用できます。</p>}
   {screen === 'explore' && <><div className="screen-top"><div><p className="eyebrow">LET CHANCE TAKE YOU SOMEWHERE.</p><h1 ref={screenHeading} tabIndex={-1}>今日は、どこへ行こう。</h1><p className="intro">行けるエリアを選んで、あとは運まかせ。</p></div><span className="free-note"><span/>登録不要・無料</span></div>
    <section className={`workspace ${busy ? 'drawing' : ''}`} aria-label="旅先の抽選"><div className="scene" ref={sceneRef}>{busy ? <><JapanMap area={area} selected={landing} spinning={stage === 'flying'}/><span className="scene-tag dark">{area} / {pool.length}都道府県</span>{stage === 'flying' && <Navigation2 className="flying-dart" aria-hidden="true"/>}<div className={`live-reel ${stage}`} aria-hidden="true"><span>{stage === 'landed' ? 'ここに、決まり。' : '次の旅先を探しています'}</span><strong>{ticker}</strong><div className="reel-dots"><i/><i/><i/></div></div></> : <><img className="scene-photo" src="./assets/coast-hero.webp" alt="青い海と緑の岬が広がる、旅のイメージ" width="1536" height="1024" fetchPriority="high"/><div className="scene-shade"/><span className="scene-tag">NO PLAN, GREAT TRIP.</span><div className="scene-copy"><h2>行き先は、<br/><em>運まかせ。</em></h2><p>いつもなら選ばない町が、<br/>次の好きな場所になるかも。</p></div><div className="scene-bottom"><span>47の都道府県。<br/><strong>まだ知らない、日本へ。</strong></span><span className="chance-stamp"><Navigation2/><span>旅に、<br/>偶然を。</span></span></div></>}</div>
     <div className="draw-panel"><div className="panel-heading"><span className="step-number">01</span><div><h2>どのエリアへ？</h2><p>行ける範囲を、ひとつ選ぼう。</p></div></div><fieldset className="region-options" disabled={busy}><legend className="sr-only">抽選するエリア</legend>{validAreas.map(option => <label key={option} className={`region-option ${area === option ? 'selected' : ''}`}><input type="radio" name="travel-area" value={option} checked={area === option} onChange={() => setTravel(current => ({...current, area:option}))}/><span className="region-text"><strong>{option}</strong><small>{areaDescriptions[option]}</small></span><span className="radio-mark" aria-hidden="true">{area === option && <Check size={14}/>}</span></label>)}</fieldset><details className="pool-details" key={area}><summary>{pool.length}都道府県を確認<ChevronDown size={15}/></summary><p>{pool.map(destination => destination.prefecture).join('・')}</p></details><div className="draw-action action-dock"><div className="action-summary"><Crosshair size={15}/><span><strong>{area}</strong>の{pool.length}都道府県から抽選</span></div><button className="primary-button lime" onClick={() => throwDart()} disabled={busy}><Navigation2 size={20}/><span>{busy ? 'ダーツを投げています…' : 'ダーツを投げる'}</span>{!busy && <ArrowRight size={18}/>}</button><p className="action-hint">{busy ? <button className="text-button" onClick={cancelDraw}>抽選をやめる</button> : '各都道府県にひとつ、代表の町をご案内。'}</p></div></div>
    </section>{!busy && <div className="below-workspace">{result && lastResult ? <button className="last-trip" onClick={() => openResult(lastResult)}><span className="last-trip-icon"><MapPin size={20}/></span><span><small>前回の旅先</small><strong>{result.prefecture} <b>{result.city}</b></strong></span><span className="last-trip-link">もう一度見る<ArrowRight size={16}/></span></button> : <p className="simple-guide"><span>エリアを選ぶ</span><ArrowRight size={14}/><span>ダーツを投げる</span><ArrowRight size={14}/><span>地図で出かける</span></p>}<button className="help-link" onClick={() => setInfoOpen(true)}>抽選のしくみ<Info size={14}/></button></div>}</>}
   {screen === 'result' && result && lastResult && <><div className="screen-top result-top"><div><p className="eyebrow">YOUR NEXT DESTINATION</p><h1 ref={screenHeading} tabIndex={-1}>次の旅先が、決まりました。</h1></div><span className="draw-context">{lastResult.drawnAt ? `${lastResult.area}からの抽選` : result.region}<span>{dateLabel(lastResult.drawnAt)}</span></span></div><section className="workspace result-workspace" aria-label="抽選結果"><div className="scene result-scene"><JapanMap area={lastResult.area} selected={result}/><span className="scene-tag dark">JAPAN / {String(result.code).padStart(2, '0')}</span><span className="map-result-label"><MapPin size={18}/>{result.prefecture}<span>に、着地。</span></span><span className="map-footnote">地図の着地は抽選結果の演出です。</span></div><div className="result-panel"><div className="destination-caption"><span><MapPin size={15}/>{result.region}</span><button className={`save-button ${saved ? 'is-saved' : ''}`} aria-pressed={saved} onClick={() => toggleSaved(result)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/>{saved ? '保存済み' : '保存する'}</button></div><p className="destination-prefecture">{result.prefecture}</p><h2 className="destination-city">{result.city}</h2><p className="destination-message">まずは地図を開いて、<br/>気になる道やお店を探してみよう。</p><div className="map-action action-dock"><a className="primary-button blue" href={mapUrl(result)} target="_blank" rel="noreferrer"><MapPin size={19}/><span>Googleマップで見る</span><ExternalLink size={16}/></a><p className="action-hint">地図アプリ・別タブで開きます</p></div><div className="nearby"><span className="small-label">この町の寄り道を探す</span><div><a href={mapUrl(result, ' 観光スポット')} target="_blank" rel="noreferrer"><Compass size={17}/>観光スポット<ExternalLink size={12}/></a><a href={mapUrl(result, ' 飲食店')} target="_blank" rel="noreferrer"><Utensils size={17}/>ごはん<ExternalLink size={12}/></a></div></div><div className="result-retry"><button className="secondary-button" onClick={() => throwDart(lastResult.area)}><RotateCcw size={17}/>もう一度投げる</button><button className="text-button change-area" onClick={() => goExplore()}>エリアを変える<ArrowRight size={14}/></button></div></div></section><div className="result-after"><Check size={15}/><p>{storageFailed ? '気になる町は、保存するボタンで選べます。' : lastResult.drawnAt ? 'この旅先は履歴に残っています。いつでも見返せます。' : '保存した旅先です。いつでも見返せます。'}</p><button className="help-link" onClick={() => navigate('history')}>旅の履歴へ<ArrowRight size={14}/></button></div></>}
   {screen === 'history' && <section className="history-screen"><div className="screen-top"><div><p className="eyebrow">YOUR TRAVEL COLLECTION</p><h1 ref={screenHeading} tabIndex={-1}>偶然に出会った、旅先。</h1><p className="intro">気になった町を、次の休日に。</p></div><button className="back-link" onClick={() => goExplore()}><ArrowLeft size={16}/>抽選に戻る</button></div><div className="history-toolbar"><div className="history-filters" role="group" aria-label="履歴の表示切り替え"><button className={historyFilter === 'all' ? 'selected' : ''} aria-pressed={historyFilter === 'all'} onClick={() => setHistoryFilter('all')}>抽選の履歴<span>{history.length}</span></button><button className={historyFilter === 'saved' ? 'selected' : ''} aria-pressed={historyFilter === 'saved'} onClick={() => setHistoryFilter('saved')}><Bookmark size={15}/>保存した旅先<span>{savedCodes.length}</span></button></div><p>{historyFilter === 'all' ? '最近30回まで' : '気になる町をキープ'}</p></div>{historyItems.length ? <ul className="history-list">{historyItems.map(record => {const destination = findDestination(record.code)!, isSaved = savedCodes.includes(record.code); return <li className="history-row" key={record.id}><button className="history-open" aria-label={`${destination.prefecture} ${destination.city}の結果を見る`} onClick={() => openResult(record)}><span className="history-pin"><MapPin size={20}/></span><span className="history-place"><small>{destination.prefecture}</small><strong>{destination.city}</strong><span>{dateLabel(record.drawnAt)}<i/> {record.area}</span></span><ArrowRight className="history-arrow" size={19}/></button><button className={`history-save ${isSaved ? 'is-saved' : ''}`} aria-label={`${destination.city}を${isSaved ? '保存から外す' : '保存する'}`} aria-pressed={isSaved} onClick={() => toggleSaved(destination)}><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'}/></button></li>;})}</ul> : <div className="empty-history"><span><Compass size={40}/></span><h2>{historyFilter === 'all' ? '最初の旅先を、見つけよう。' : '気になる町を、取っておこう。'}</h2><p>{historyFilter === 'all' ? 'ダーツを投げると、ここに旅先が並びます。' : '結果画面の「保存する」で、あとから見返せます。'}</p><button className="primary-button blue" onClick={() => goExplore()}>行き先を決める<ArrowRight size={18}/></button></div>}<p className="history-footnote">履歴と保存した旅先は、このブラウザに記録されます。</p></section>}
  </main><footer className="app-footer"><span>© 2026 きまぐれダーツ旅</span><button onClick={() => setInfoOpen(true)}>使い方・地図の出典<ArrowRight size={12}/></button></footer><div className="sr-only" role="status" aria-live="polite">{announcement}</div>
  <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="info-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="閉じる"><X size={20}/></DialogClose><span className="eyebrow">A TRIP STARTS WITH ONE THROW.</span><DialogTitle>ダーツひとつで、旅をはじめよう。</DialogTitle><DialogDescription>行き先を決めるための、小さなきっかけ。</DialogDescription><ol className="info-steps"><li><b>01</b><div><strong>行けるエリアを選ぶ</strong><p>全国、または7つのエリアから選べます。</p></div></li><li><b>02</b><div><strong>ダーツを投げる</strong><p>各都道府県を同じ確率で抽選し、代表の町を案内します。地図の着地は演出です。</p></div></li><li><b>03</b><div><strong>地図を開いて出かける</strong><p>道順や寄り道はGoogleマップで。投げ直しも自由です。</p></div></li></ol><div className="info-notes"><p>履歴は最近30回まで記録されます。「保存する」で選んだ町は、履歴から消えたあとも残ります。ブラウザのデータを削除すると記録も消えます。</p><p>交通・宿泊の予約は、ご自身で行ってください。</p><p>地図：<a href="https://github.com/geolonia/japanese-prefectures" target="_blank" rel="noreferrer">Geolonia / Wikipedia</a> · <a href="./assets/map-source.txt" target="_blank" rel="noreferrer">出典</a> · <a href="./assets/map-license.txt" target="_blank" rel="noreferrer">GFDL</a><br/>一部の離島は省略されています。写真は生成した旅のイメージです。</p></div></DialogContent></Dialog>
 </>;
}
