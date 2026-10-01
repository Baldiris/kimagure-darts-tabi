import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Compass, Crosshair, ExternalLink, History, Info, MapPin, RotateCcw, Utensils, X} from 'lucide-react';
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import {destinations, prefectures, destinationPool, pickDestination, regions, type Destination} from '@/lib/destinations';
import {DartIcon, DartMap, DartThrowButton, preloadDartMap, type DartCharge, type DartShot} from '@/components/darts';
import {loadTravelState, travelStorageKey, findDestination, findPrefecture, resolveRoute, validAreas, type Area, type TripRecord, type TravelState} from '@/lib/travel-state';
type Screen = 'explore' | 'result' | 'history';
type Stage = 'ready' | 'windup' | 'flying' | 'landed';
const formatCount = (count:number) => count.toLocaleString('ja-JP');
const areaDescriptions:Record<string,string> = Object.fromEntries(validAreas.map(area => [area,`${formatCount(destinationPool(area).length)}市区町村`]));
const mapUrl = (destination: Destination, suffix = '') => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.prefecture} ${destination.city}${suffix}`)}`;
const dateLabel = (timestamp: number) => timestamp ? new Intl.DateTimeFormat('ja-JP', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(timestamp) : '保存した旅先';
export default function App() {
 const [travel, setTravel] = useState<TravelState>(loadTravelState);
 const [screen, setScreen] = useState<Screen>(() => resolveRoute(window.location.hash, loadTravelState()).screen);
 const [stage, setStage] = useState<Stage>('ready'), [ticker, setTicker] = useState(''), [shot, setShot] = useState<DartShot | undefined>();
 const [charge, setCharge] = useState<DartCharge>({active:false,power:0});
 const [poolOpen,setPoolOpen] = useState(false), [poolSearch,setPoolSearch] = useState('');
 const [infoOpen, setInfoOpen] = useState(false), [historyFilter, setHistoryFilter] = useState<'all' | 'saved'>('all'), [storageFailed, setStorageFailed] = useState(false), [announcement, setAnnouncement] = useState('');
 const running = useRef(false), timeouts = useRef<ReturnType<typeof setTimeout>[]>([]), reel = useRef<ReturnType<typeof setInterval> | null>(null);
 const screenHeading = useRef<HTMLHeadingElement>(null), sceneRef = useRef<HTMLDivElement>(null), firstRender = useRef(true);
 const {area, prefectureCode, history, savedDestinationIds, lastResult} = travel, busy = stage !== 'ready';
 const regionPrefectures = useMemo(() => prefectures.filter(prefecture => area==='全国' || prefecture.region===area),[area]);
 const pool = useMemo(() => destinationPool(area,prefectureCode), [area,prefectureCode]);
 const selectedPrefecture = prefectureCode ? findPrefecture(prefectureCode) : undefined;
 const visibleCandidates = useMemo(() => pool.filter(destination => `${destination.prefecture}${destination.city}`.includes(poolSearch.trim())),[pool,poolSearch]);
 useEffect(() => {setPoolOpen(false);setPoolSearch('');},[area,prefectureCode]);
 const scopeName = selectedPrefecture?.prefecture ?? area;
 const result = lastResult ? findDestination(lastResult.destinationId) : null, saved = result ? savedDestinationIds.includes(result.id) : false;
 const clearDraw = useCallback(() => {timeouts.current.forEach(clearTimeout); timeouts.current = []; if (reel.current) clearInterval(reel.current); reel.current = null; running.current = false;}, []);
 useEffect(() => clearDraw, [clearDraw]);
 useEffect(() => {preloadDartMap(area,prefectureCode).catch(() => {});}, [area,prefectureCode]);
 useEffect(() => {try {localStorage.setItem(travelStorageKey, JSON.stringify(travel));} catch {setStorageFailed(true);}}, [travel]);
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
   clearDraw(); setStage('ready'); setShot(undefined); setCharge({active:false,power:0});
   const route = resolveRoute(window.location.hash, travel);
   if (route.record) setTravel(current => ({...current, lastResult:route.record!}));
   setScreen(route.screen);
  };
  window.addEventListener('popstate', restore); window.addEventListener('hashchange', restore);
  return () => {window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore);};
 }, [travel, clearDraw]);
 function goExplore(selected?: Area) {if (running.current) return; setStage('ready'); setShot(undefined); setCharge({active:false,power:0}); if (selected) setTravel(current => ({...current, area:selected, prefectureCode:null})); navigate('explore');}
 function openResult(record: TripRecord) {setTravel(current => ({...current, lastResult:record})); navigate('result', record.id);}
 function toggleSaved(destination: Destination) {
  const isSaved = savedDestinationIds.includes(destination.id);
  setTravel(current => ({...current, savedDestinationIds:isSaved ? current.savedDestinationIds.filter(id => id !== destination.id) : [destination.id, ...current.savedDestinationIds]}));
  setAnnouncement(`${destination.city}を${isSaved ? '保存から外しました' : '保存しました'}。`);
 }
 function throwDart(selectedArea: Area = area, power = 65, selectedCode:number|null = prefectureCode) {
  if (running.current) return; clearDraw(); running.current = true;
  const chosen = pickDestination(selectedArea,Math.random,selectedCode,history[0]?.destinationId), reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drawPool = destinationPool(selectedArea,selectedCode);
  preloadDartMap(selectedArea,chosen.code).catch(() => {});
  const record: TripRecord = {id:crypto.randomUUID(), code:chosen.code, destinationId:chosen.id, area:selectedArea, prefectureCode:selectedCode, drawnAt:Date.now()};
  setTravel(current => ({...current, area:selectedArea, prefectureCode:selectedCode}));
  const flightMs = 850-Math.round(Math.min(100,Math.max(25,power))*2.5);
  setShot({id:record.id,destination:chosen,power,flightMs}); setCharge({active:false,power:0});
  navigate('explore', undefined, screen === 'result'); setStage(reduced ? 'landed' : 'windup'); setTicker('？ ？ ？'); setAnnouncement(selectedCode ? `${chosen.prefecture}の旅へダーツを投げています。` : `${selectedArea}から行き先を抽選しています。`);
  requestAnimationFrame(() => sceneRef.current?.scrollIntoView({block:'start', behavior:reduced ? 'instant' : 'smooth'}));
  const land = () => {
   if (reel.current) clearInterval(reel.current); reel.current = null;
   setTicker(chosen.city); setStage('landed');
   if (!reduced && navigator.vibrate) {try {navigator.vibrate([25,30,45]);} catch {}}
   timeouts.current.push(setTimeout(() => {setTravel(current => ({...current, lastResult:record, history:[record, ...current.history].slice(0, 30)})); setStage('ready'); navigate('result', record.id); setAnnouncement(`旅先は${chosen.prefecture}の${chosen.city}に決まりました。`); running.current = false;}, reduced ? 0 : 1050));
  };
  if (reduced) timeouts.current.push(setTimeout(land,100));
  else timeouts.current.push(setTimeout(() => {
   setStage('flying'); reel.current = setInterval(() => setTicker(drawPool[Math.floor(Math.random()*drawPool.length)].city),140);
   timeouts.current.push(setTimeout(land,flightMs));
  },280));
 }
 function cancelDraw() {clearDraw(); setStage('ready'); setShot(undefined); setCharge({active:false,power:0}); setAnnouncement('抽選を中止しました。');}
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
 const historyItems:TripRecord[] = historyFilter==='all' ? history : savedDestinationIds.map(id => history.find(record => record.destinationId===id) ?? {id:`saved-${id}`,destinationId:id,code:findDestination(id)!.code,area:findDestination(id)!.region,drawnAt:0});
 return <>
  <a className="skip-link" href="#main-content" onClick={event => {event.preventDefault(); document.getElementById('main-content')?.focus();}}>メインの操作へ</a>
  <header className="app-header"><button className="brand" onClick={() => goExplore()} disabled={busy || charge.active} aria-label="きまぐれダーツ旅 ホーム"><span className="brand-icon"><Crosshair/></span><span>きまぐれ<em>ダーツ旅</em></span></button><nav aria-label="メインナビゲーション" className="app-nav"><button className={`nav-item explore-nav ${screen !== 'history' ? 'active' : ''}`} aria-current={screen !== 'history' ? 'page' : undefined} onClick={() => goExplore()} disabled={busy || charge.active}><Compass size={18}/>行き先を決める</button><button className={`nav-item ${screen === 'history' ? 'active' : ''}`} aria-current={screen === 'history' ? 'page' : undefined} onClick={() => navigate('history')} disabled={busy || charge.active}><History size={18}/><span>旅の履歴</span>{history.length > 0 && <span className="nav-count">{history.length}</span>}</button></nav><button className="info-button" aria-label="使い方と抽選について" disabled={busy || charge.active} onClick={() => setInfoOpen(true)}><Info size={20}/></button></header>
  <main id="main-content" tabIndex={-1} className={`app-main screen-${screen}`}>
   {storageFailed && <p className="storage-notice">このブラウザでは履歴を保存できません。抽選と地図は利用できます。</p>}
   {screen === 'explore' && <><div className="screen-top"><div><p className="eyebrow">LET CHANCE TAKE YOU SOMEWHERE.</p><h1 ref={screenHeading} tabIndex={-1}>今日は、どこへ行こう。</h1><p className="intro">行けるエリアを選んで、あとは運まかせ。</p></div><span className="free-note"><span/>登録不要・無料</span></div>
    <section className={`workspace ${busy ? 'drawing' : ''} ${charge.active ? 'charging' : ''} ${!busy && (area !== '全国' || selectedPrefecture) ? 'regional-preview' : ''}`} aria-label="旅先の抽選">
     <div className="scene" ref={sceneRef}>
      {busy ? <><DartMap area={area} prefectureCode={prefectureCode} destination={shot?.destination ?? null} phase={stage} shot={shot}/><span className="scene-tag dark">{scopeName} / {formatCount(pool.length)}市区町村</span><div className={`live-reel ${stage}`} aria-hidden="true"><span>{stage === 'landed' ? 'ダーツが、着地！' : stage === 'windup' ? 'いくよ、次の旅へ。' : 'どこに刺さるかな…'}</span><strong>{ticker}</strong>{stage === 'landed' && <small className="result-region">{shot?.destination.prefecture}</small>}<div className="reel-dots"><i/><i/><i/></div></div></>
       : area !== '全国' || selectedPrefecture ? <><DartMap area={area} prefectureCode={prefectureCode} destination={null} phase="preview"/><span className="scene-tag dark">{scopeName} / {formatCount(pool.length)}市区町村</span><div className="regional-preview-caption"><strong>{selectedPrefecture ? `${scopeName}を、じっくり旅しよう。` : `${area}の、まだ知らない町へ。`}</strong><span>{`地図の${formatCount(pool.length)}市区町村から、行き先が決まります。`}</span></div></>
       : <><img className="scene-photo" src="./assets/coast-hero.webp" alt="青い海と緑の岬が広がる、旅のイメージ" width="1536" height="1024" fetchPriority="high"/><div className="scene-shade"/><span className="scene-tag">NO PLAN, GREAT TRIP.</span><div className="scene-copy"><h2>行き先は、<br/><em>運まかせ。</em></h2><p>いつもなら選ばない町が、<br/>次の好きな場所になるかも。</p></div><div className="scene-bottom"><span>{formatCount(destinations.length)}の市区町村。<br/><strong>まだ知らない、日本へ。</strong></span><span className="chance-stamp"><DartIcon/><span>旅に、<br/>偶然を。</span></span></div></>}
      {charge.active && <div className="charging-preview" aria-hidden="true"><DartIcon/><span className="charge-badge">パワー {Math.round(charge.power)}%<i><b style={{transform:`scaleX(${charge.power/100})`}}/></i></span></div>}
     </div>
     <div className="draw-panel"><div className="panel-heading"><span className="step-number">01</span><div><h2>どのエリアへ？</h2><p>行ける範囲を、ひとつ選ぼう。</p></div></div><fieldset className="region-options" disabled={busy || charge.active}><legend className="sr-only">抽選するエリア</legend>{validAreas.map(option => <label key={option} className={`region-option ${area === option ? 'selected' : ''}`}><input type="radio" name="travel-area" value={option} checked={area === option} onChange={() => {setTravel(current => ({...current, area:option, prefectureCode:null})); setAnnouncement(`${option}を選びました。${formatCount(destinationPool(option).length)}市区町村から旅先を抽選します。`);}}/><span className="region-text"><strong>{option}</strong><small>{areaDescriptions[option]}</small></span><span className="radio-mark" aria-hidden="true">{area === option && <Check size={14}/>}</span></label>)}</fieldset>
      <div className="prefecture-choice">
       <label htmlFor="prefecture-select">都道府県で絞る<span>任意</span></label>
       <div className="prefecture-select-wrap"><MapPin size={16} aria-hidden="true"/><select id="prefecture-select" value={prefectureCode ?? ''} disabled={busy || charge.active} aria-describedby="prefecture-hint" onChange={event => {
        const chosen = findPrefecture(Number(event.target.value));
        setTravel(current => ({...current, area:chosen?.region ?? current.area, prefectureCode:chosen?.code ?? null}));
        setAnnouncement(chosen ? `${chosen.prefecture}の地図に切り替えました。${destinationPool(chosen.region,chosen.code).length}市区町村から抽選します。` : `${area}の${formatCount(destinationPool(area).length)}市区町村から抽選します。`);
       }}>
        <option value="">{area}から、おまかせ</option>
        {area === '全国' ? regions.map(region => <optgroup key={region} label={region}>{prefectures.filter(destination => destination.region===region).map(destination => <option key={destination.code} value={destination.code}>{destination.prefecture}（{destinationPool(region,destination.code).length}候補）</option>)}</optgroup>) : regionPrefectures.map(destination => <option key={destination.code} value={destination.code}>{destination.prefecture}（{destinationPool(area,destination.code).length}候補）</option>)}
       </select><ChevronDown size={16} aria-hidden="true"/></div>
       <p id="prefecture-hint"><strong>{formatCount(pool.length)}市区町村から、ランダムに抽選します。</strong><span>下の候補一覧で、行き先を確認できます。</span></p>
      </div>
      <details className="pool-details city-pool-details" key={`${area}-${prefectureCode}`} onToggle={event => setPoolOpen(event.currentTarget.open)}><summary>抽選候補 {formatCount(pool.length)}市区町村<ChevronDown size={15}/></summary>{poolOpen && <div className="candidate-browser"><input type="search" aria-label="候補一覧を検索" placeholder="市区町村名を探す" value={poolSearch} onChange={event=>setPoolSearch(event.target.value)} disabled={busy || charge.active}/><p className="candidate-count">表示 {formatCount(visibleCandidates.length)} / {formatCount(pool.length)}件</p>{visibleCandidates.length ? <ul className="municipality-list">{visibleCandidates.map(destination=><li key={destination.id}>{!selectedPrefecture && <small>{destination.prefecture}</small>}<span>{destination.city}</span></li>)}</ul> : <p>一致する市区町村がありません。</p>}</div>}</details>
      <div className="draw-action action-dock"><div className="action-summary"><Crosshair size={15}/><span><strong>{scopeName}</strong>の{formatCount(pool.length)}市区町村から抽選</span></div><DartThrowButton disabled={busy} onThrow={power => throwDart(area,power)} onCharge={setCharge}/><p className="action-hint">{busy ? <button className="text-button" onClick={cancelDraw}>抽選をやめる</button> : charge.active ? <span className="charge-caption">指を離すとダーツが飛びます</span> : '長押しで力をためる。タップでも投げられます。'}</p></div></div>
    </section>{!busy && <div className="below-workspace">{result && lastResult ? <button className="last-trip" onClick={() => openResult(lastResult)}><span className="last-trip-icon"><MapPin size={20}/></span><span><small>前回の旅先</small><strong>{result.prefecture} <b>{result.city}</b></strong></span><span className="last-trip-link">もう一度見る<ArrowRight size={16}/></span></button> : <p className="simple-guide"><span>エリアを選ぶ</span><ArrowRight size={14}/><span>ダーツを投げる</span><ArrowRight size={14}/><span>地図で出かける</span></p>}<button className="help-link" onClick={() => setInfoOpen(true)}>抽選のしくみ<Info size={14}/></button></div>}</>}
   {screen === 'result' && result && lastResult && <><div className="screen-top result-top"><div><p className="eyebrow">YOUR NEXT DESTINATION</p><h1 ref={screenHeading} tabIndex={-1}>次の旅先が、決まりました。</h1></div><span className="draw-context">{lastResult.drawnAt ? lastResult.prefectureCode ? `${result.prefecture}を指定` : `${lastResult.area}からの抽選` : result.region}<span>{dateLabel(lastResult.drawnAt)}</span></span></div><section className="workspace result-workspace" aria-label="抽選結果"><div className="scene result-scene"><DartMap area={lastResult.area} prefectureCode={result.code} destination={result} phase="result"/><span className="scene-tag dark">{result.prefecture} / {String(result.code).padStart(2, '0')}</span><span className="map-result-label"><MapPin size={18}/>{result.prefecture}<span>に、着地。</span></span><span className="map-footnote">地図の着地は抽選結果の演出です。</span></div><div className="result-panel"><div className="destination-caption"><span><MapPin size={15}/>{result.region}</span><button className={`save-button ${saved ? 'is-saved' : ''}`} aria-pressed={saved} onClick={() => toggleSaved(result)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/>{saved ? '保存済み' : '保存する'}</button></div><p className="destination-prefecture">{result.prefecture}</p><h2 className="destination-city">{result.city}</h2><p className="destination-message">まずは地図を開いて、<br/>気になる道やお店を探してみよう。</p><div className="map-action action-dock"><a className="primary-button blue" href={mapUrl(result)} target="_blank" rel="noreferrer"><MapPin size={19}/><span>Googleマップで見る</span><ExternalLink size={16}/></a><p className="action-hint">地図アプリ・別タブで開きます</p></div><div className="nearby"><span className="small-label">この町の寄り道を探す</span><div><a href={mapUrl(result, ' 観光スポット')} target="_blank" rel="noreferrer"><Compass size={17}/>観光スポット<ExternalLink size={12}/></a><a href={mapUrl(result, ' 飲食店')} target="_blank" rel="noreferrer"><Utensils size={17}/>ごはん<ExternalLink size={12}/></a></div></div><div className="result-retry"><button className="secondary-button" onClick={() => throwDart(lastResult.area,65,lastResult.prefectureCode ?? null)}><RotateCcw size={17}/>もう一度投げる</button><button className="text-button change-area" onClick={() => goExplore()}>エリアを変える<ArrowRight size={14}/></button></div></div></section><div className="result-after"><Check size={15}/><p>{storageFailed ? '気になる町は、保存するボタンで選べます。' : lastResult.drawnAt ? 'この旅先は履歴に残っています。いつでも見返せます。' : '保存した旅先です。いつでも見返せます。'}</p><button className="help-link" onClick={() => navigate('history')}>旅の履歴へ<ArrowRight size={14}/></button></div></>}
   {screen === 'history' && <section className="history-screen"><div className="screen-top"><div><p className="eyebrow">YOUR TRAVEL COLLECTION</p><h1 ref={screenHeading} tabIndex={-1}>偶然に出会った、旅先。</h1><p className="intro">気になった町を、次の休日に。</p></div><button className="back-link" onClick={() => goExplore()}><ArrowLeft size={16}/>抽選に戻る</button></div><div className="history-toolbar"><div className="history-filters" role="group" aria-label="履歴の表示切り替え"><button className={historyFilter === 'all' ? 'selected' : ''} aria-pressed={historyFilter === 'all'} onClick={() => setHistoryFilter('all')}>抽選の履歴<span>{history.length}</span></button><button className={historyFilter === 'saved' ? 'selected' : ''} aria-pressed={historyFilter === 'saved'} onClick={() => setHistoryFilter('saved')}><Bookmark size={15}/>保存した旅先<span>{savedDestinationIds.length}</span></button></div><p>{historyFilter === 'all' ? '最近30回まで' : '気になる町をキープ'}</p></div>{historyItems.length ? <ul className="history-list">{historyItems.map(record => {const destination = findDestination(record.destinationId)!, isSaved = savedDestinationIds.includes(record.destinationId); return <li className="history-row" key={record.id}><button className="history-open" aria-label={`${destination.prefecture} ${destination.city}の結果を見る`} onClick={() => openResult(record)}><span className="history-pin"><MapPin size={20}/></span><span className="history-place"><small>{destination.prefecture}</small><strong>{destination.city}</strong><span>{dateLabel(record.drawnAt)}<i/> {record.prefectureCode ? destination.prefecture : record.area}</span></span><ArrowRight className="history-arrow" size={19}/></button><button className={`history-save ${isSaved ? 'is-saved' : ''}`} aria-label={`${destination.city}を${isSaved ? '保存から外す' : '保存する'}`} aria-pressed={isSaved} onClick={() => toggleSaved(destination)}><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'}/></button></li>;})}</ul> : <div className="empty-history"><span><Compass size={40}/></span><h2>{historyFilter === 'all' ? '最初の旅先を、見つけよう。' : '気になる町を、取っておこう。'}</h2><p>{historyFilter === 'all' ? 'ダーツを投げると、ここに旅先が並びます。' : '結果画面の「保存する」で、あとから見返せます。'}</p><button className="primary-button blue" onClick={() => goExplore()}>行き先を決める<ArrowRight size={18}/></button></div>}<p className="history-footnote">履歴と保存した旅先は、このブラウザに記録されます。</p></section>}
  </main><footer className="app-footer"><span>© 2026 きまぐれダーツ旅</span><button onClick={() => setInfoOpen(true)}>使い方・地図の出典<ArrowRight size={12}/></button></footer><div className="sr-only" role="status" aria-live="polite">{announcement}</div>
  <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="info-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="閉じる"><X size={20}/></DialogClose><span className="eyebrow">A TRIP STARTS WITH ONE THROW.</span><DialogTitle>ダーツひとつで、旅をはじめよう。</DialogTitle><DialogDescription>行き先を決めるための、小さなきっかけ。</DialogDescription><ol className="info-steps"><li><b>01</b><div><strong>行けるエリアを選ぶ</strong><p>全国、または7つのエリアから選べます。さらに都道府県を指定すると、県ごとの地図に切り替わります。</p></div></li><li><b>02</b><div><strong>ダーツを投げる</strong><p>長押しで力をためて、指を離すとダーツが飛びます。タップでも投げられます。選んだ地域・県の市区町村から、同じ確率で抽選します。直前の抽選と同じ町は続けて出ないようにしています。政令指定都市は市単位、東京23区は区単位で扱います。パワーと地図の着地は演出で、抽選確率には影響しません。</p></div></li><li><b>03</b><div><strong>地図を開いて出かける</strong><p>結果は当たった県だけを拡大した地図で表示します。道順や寄り道はGoogleマップで。投げ直しも自由です。</p></div></li></ol><div className="info-notes"><p>市区町村データ：<a href="https://github.com/code4fukui/localgovjp" target="_blank" rel="noreferrer">Code for FUKUI / localgovjp</a> · <a href="./assets/municipality-source.txt" target="_blank" rel="noreferrer">出典・CC0</a>。全国{formatCount(destinations.length)}候補を収録しています。</p><p>履歴は最近30回まで記録されます。「保存する」で選んだ町は、履歴から消えたあとも残ります。ブラウザのデータを削除すると記録も消えます。</p><p>交通・宿泊の予約は、ご自身で行ってください。</p><p>地図：<a href="https://github.com/geolonia/japanese-prefectures" target="_blank" rel="noreferrer">Geolonia / Wikipedia</a> · <a href="./assets/map-source.txt" target="_blank" rel="noreferrer">出典</a> · <a href="./assets/map-license.txt" target="_blank" rel="noreferrer">GFDL</a><br/>一部の離島は省略されています。九州・沖縄の地域地図では沖縄を別枠・異なる縮尺で表示しています。写真は生成した旅のイメージです。</p></div></DialogContent></Dialog>
 </>;
}
