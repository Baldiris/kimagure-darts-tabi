import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,Bookmark,Check,ChevronDown,Compass,Crosshair,ExternalLink,History,Info,MapPin,RotateCcw,Search,Utensils,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {destinations,prefectures,destinationPool,pickDestination,regions,type Destination} from '@/lib/destinations';
import {DartTarget} from '@/components/dart-target';
import {TravelMap,preloadTravelMap} from '@/components/travel-map';
import {loadTravelState,travelStorageKey,findDestination,findPrefecture,resolveRoute,validAreas,type Area,type TripRecord,type TravelState} from '@/lib/travel-state';

type Screen = 'explore'|'result'|'history';
type Stage = 'ready'|'flying'|'landed';
type DartShot = {id:string;destination:Destination};
const count = (n:number) => n.toLocaleString('ja-JP');
const mapUrl = (destination:Destination,suffix='') => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.prefecture} ${destination.city}${suffix}`)}`;
const dateLabel = (timestamp:number) => timestamp ? new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(timestamp) : '保存した旅先';

export default function App() {
  const [travel,setTravel] = useState<TravelState>(loadTravelState);
  const [screen,setScreen] = useState<Screen>(() => resolveRoute(window.location.hash,loadTravelState()).screen);
  const [stage,setStage] = useState<Stage>('ready');
  const [shot,setShot] = useState<DartShot>();
  const [poolOpen,setPoolOpen] = useState(false),[poolSearch,setPoolSearch] = useState('');
  const [mapOpen,setMapOpen] = useState(false),[infoOpen,setInfoOpen] = useState(false);
  const [historyFilter,setHistoryFilter] = useState<'all'|'saved'>('all');
  const [storageFailed,setStorageFailed] = useState(false),[announcement,setAnnouncement] = useState('');
  const running = useRef(false),timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const screenHeading = useRef<HTMLHeadingElement>(null),stageRef = useRef<HTMLDivElement>(null),firstRender = useRef(true);
  const {area,prefectureCode,history,savedDestinationIds,lastResult} = travel;
  const busy = stage !== 'ready';
  const regionPrefectures = useMemo(() => prefectures.filter(p => area==='全国'||p.region===area),[area]);
  const pool = useMemo(() => destinationPool(area,prefectureCode),[area,prefectureCode]);
  const selectedPrefecture = prefectureCode ? findPrefecture(prefectureCode) : undefined;
  const scopeName = selectedPrefecture?.prefecture ?? area;
  const visibleCandidates = useMemo(() => pool.filter(d => `${d.prefecture}${d.city}`.includes(poolSearch.trim())),[pool,poolSearch]);
  const result = lastResult ? findDestination(lastResult.destinationId) : null;
  const saved = result ? savedDestinationIds.includes(result.id) : false;
  useEffect(() => {setPoolOpen(false);setPoolSearch('');setMapOpen(false);},[area,prefectureCode]);
  const clearDraw = useCallback(() => {timeouts.current.forEach(clearTimeout);timeouts.current=[];running.current=false;},[]);
  useEffect(() => clearDraw,[clearDraw]);
  useEffect(() => {try {localStorage.setItem(travelStorageKey,JSON.stringify(travel));} catch {setStorageFailed(true);}},[travel]);
  useEffect(() => {if(firstRender.current){firstRender.current=false;return;}window.scrollTo({top:0,behavior:'instant'});screenHeading.current?.focus({preventScroll:true});},[screen]);
  function navigate(next:Screen,recordId?:string,replace=false) {
    const hash = next==='result' ? `#trip=${recordId}` : `#${next}`;
    if(window.location.hash!==hash) window.history[replace?'replaceState':'pushState'](null,'',hash);
    setScreen(next);
  }
  useEffect(() => {
    const initial = resolveRoute(window.location.hash,loadTravelState());
    if(initial.record) setTravel(current => ({...current,lastResult:initial.record!}));
    navigate(initial.screen,initial.record?.id,true);
  },[]);
  useEffect(() => {
    const restore=() => {
      clearDraw();setStage('ready');setShot(undefined);
      const route=resolveRoute(window.location.hash,travel);
      if(route.record) setTravel(current=>({...current,lastResult:route.record!}));
      setScreen(route.screen);
    };
    window.addEventListener('popstate',restore);window.addEventListener('hashchange',restore);
    return()=>{window.removeEventListener('popstate',restore);window.removeEventListener('hashchange',restore);};
  },[travel,clearDraw]);
  function goExplore(selected?:Area) {
    if(running.current)return;
    setStage('ready');setShot(undefined);
    if(selected) setTravel(current=>({...current,area:selected,prefectureCode:null}));
    if(screen==='explore') {
      requestAnimationFrame(()=>selected
        ? document.getElementById('trip-picker')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
        : window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
    }
    navigate('explore');
  }
  function openResult(record:TripRecord) {setTravel(current=>({...current,lastResult:record}));navigate('result',record.id);}
  function toggleSaved(destination:Destination) {
    const isSaved=savedDestinationIds.includes(destination.id);
    setTravel(current=>({...current,savedDestinationIds:isSaved?current.savedDestinationIds.filter(id=>id!==destination.id):[destination.id,...current.savedDestinationIds]}));
    setAnnouncement(`${destination.city}を${isSaved?'保存から外しました':'保存しました'}。`);
  }
  function throwDart(selectedArea:Area=area,selectedCode:number|null=prefectureCode) {
    if(running.current)return;
    clearDraw();running.current=true;
    const chosen=pickDestination(selectedArea,Math.random,selectedCode,history[0]?.destinationId);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    preloadTravelMap(chosen.region,chosen.code).catch(()=>{});
    const record:TripRecord={id:crypto.randomUUID(),code:chosen.code,destinationId:chosen.id,area:selectedArea,prefectureCode:selectedCode,drawnAt:Date.now()};
    setTravel(current=>({...current,area:selectedArea,prefectureCode:selectedCode}));
    setShot({id:record.id,destination:chosen});
    navigate('explore',undefined,screen==='result');setStage(reduced?'landed':'flying');
    setAnnouncement(`${selectedCode?chosen.prefecture:selectedArea}の市区町村へダーツを投げました。`);
    requestAnimationFrame(()=>stageRef.current?.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'}));
    const land=() => {
      setStage('landed');
      if(!reduced && navigator.vibrate) {try {navigator.vibrate([25,30,45]);} catch {}}
      timeouts.current.push(setTimeout(()=>{
        setTravel(current=>({...current,lastResult:record,history:[record,...current.history].slice(0,30)}));
        setStage('ready');navigate('result',record.id);
        setAnnouncement(`旅先は${chosen.prefecture}の${chosen.city}に決まりました。`);
        running.current=false;
      },reduced?0:750));
    };
    timeouts.current.push(setTimeout(land,reduced?100:1650));
  }
  function cancelDraw() {clearDraw();setStage('ready');setShot(undefined);setAnnouncement('ダーツの投擲を中止しました。');}
  useEffect(() => {
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void}}).modelContext;
    if(!context?.registerTool)return;
    const abort=new AbortController();
    try {context.registerTool({name:'start_random_trip',title:'旅先ダーツの準備',description:'エリアを指定して旅先ダーツの準備をします。投げる操作はまだ実行しません。',inputSchema:{type:'object',properties:{area:{type:'string',enum:validAreas}},required:['area'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{
      const selected=(input as {area?:Area})?.area;
      if(!selected||!validAreas.includes(selected))throw new Error('有効なエリアを指定してください');
      if(running.current)throw new Error('ダーツが着弾するまでお待ちください');
      goExplore(selected);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      return {status:'ready',area:selected};
    }},{signal:abort.signal});} catch {}
    return()=>abort.abort();
  },[]);
  const historyItems:TripRecord[]=historyFilter==='all' ? history : savedDestinationIds.map(id=>history.find(record=>record.destinationId===id)??{id:`saved-${id}`,destinationId:id,code:findDestination(id)!.code,area:findDestination(id)!.region,drawnAt:0});
  return <>
    <a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus();}}>メインの操作へ</a>
    <header className="app-header">
      <button className="brand" onClick={()=>goExplore()} disabled={busy} aria-label="きまぐれダーツ旅 ホーム"><span className="brand-icon" aria-hidden="true"><i/><i/><i/></span><span>きまぐれ<span>ダーツ旅</span></span></button>
      <nav aria-label="メインナビゲーション" className="app-nav"><button className={`nav-item ${screen!=='history'?'active':''}`} aria-label="旅先ダーツ" aria-current={screen!=='history'?'page':undefined} onClick={()=>goExplore()} disabled={busy}><Crosshair size={16}/><span className="nav-label">旅先を決める</span></button><button className={`nav-item ${screen==='history'?'active':''}`} aria-label={`履歴 ${history.length}件`} aria-current={screen==='history'?'page':undefined} onClick={()=>navigate('history')} disabled={busy}><History size={16}/><span className="nav-label">履歴</span>{history.length>0&&<span className="nav-count">{history.length}</span>}</button></nav>
      <button className="info-button" aria-label="使い方と出典" disabled={busy} onClick={()=>setInfoOpen(true)}><Info size={18}/></button>
    </header>
    <main id="main-content" tabIndex={-1} className={`app-main screen-${screen}`}>
      {storageFailed&&<p className="storage-notice">このブラウザでは履歴を保存できません。抽選と地図は利用できます。</p>}
      {screen==='explore'&&<>
        <section className="landing-hero" aria-label="旅のはじまり">
          <img className="hero-photo" src="./assets/dart-journey-hero.webp" alt="" fetchPriority="high"/>
          <div className="hero-shade" aria-hidden="true"/>
          <div className="hero-content">
            <p className="hero-kicker"><span/>JAPAN, BY CHANCE.</p>
            <h1 ref={screenHeading} tabIndex={-1}>次の旅は、<br/><em>ダーツに</em><br/>決めてもらおう。</h1>
            <p className="hero-lead">行き先を決めない自由も、旅の楽しさ。<br/>日本全国の町から、偶然の一か所へ。</p>
            <button className="hero-cta" onClick={()=>document.getElementById('trip-picker')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><Crosshair size={22}/>ダーツを投げに行く<ArrowDown size={17}/></button>
            <p className="hero-fine">無料・登録不要。思い立ったら、すぐに一投。</p>
          </div>
          <div className="hero-bottom"><span>ひと投げで、まだ知らない町へ。</span><span>47 PREFECTURES · {count(destinations.length)} TOWNS</span></div>
        </section>
        <section className="promise-strip" aria-label="旅先ダーツの特徴">
          <div><Crosshair size={19}/><strong>ダーツで決まる旅先</strong><span>投げて、着弾を見届ける</span></div>
          <div><MapPin size={19}/><strong>全国{count(destinations.length)}の町</strong><span>47都道府県から選べる</span></div>
          <div><Bookmark size={19}/><strong>見つけた町を残す</strong><span>地図で調べて、次の旅へ</span></div>
        </section>
        <section className="trip-section" aria-label="旅先を決める"><div className="explore-heading"><div><p className="eyebrow">THROW A DART. FIND YOUR NEXT PLACE.</p><h2>さあ、旅先を決めよう。</h2><p>範囲を決めたら、ダーツをひと投げ。</p></div><span className="screen-count"><strong>47</strong> 都道府県 / <strong>{count(destinations.length)}</strong> 市区町村</span></div>
        <div className="picker-shell" id="trip-picker" role="group" aria-label="旅先ダーツ">
          <div className="draw-panel selection-panel">
            <div className="panel-heading"><span className="step-number">01</span><div><h3>行ける範囲を選ぶ</h3><p>全国からでも、県を指定しても。</p></div></div>
            <div className="scope-fields"><label htmlFor="area-select">地域</label><div className="select-wrap"><select id="area-select" value={area} disabled={busy} onChange={event=>{const next=event.target.value;setTravel(current=>({...current,area:next,prefectureCode:null}));setAnnouncement(`${next}を選びました。${count(destinationPool(next).length)}市区町村が候補です。`);}}>{validAreas.map(option=><option key={option} value={option}>{option}（{count(destinationPool(option).length)}候補）</option>)}</select><ChevronDown size={17} aria-hidden="true"/></div>
              <label htmlFor="prefecture-select">都道府県 <span>任意</span></label><div className="select-wrap"><select id="prefecture-select" value={prefectureCode??''} disabled={busy} onChange={event=>{const chosen=findPrefecture(Number(event.target.value));setTravel(current=>({...current,area:chosen?.region??current.area,prefectureCode:chosen?.code??null}));setAnnouncement(chosen?`${chosen.prefecture}の${count(destinationPool(chosen.region,chosen.code).length)}市区町村が候補です。`:`${area}の${count(destinationPool(area).length)}市区町村が候補です。`);}}><option value="">{area}の中からおまかせ</option>{area==='全国'?regions.map(region=><optgroup key={region} label={region}>{prefectures.filter(p=>p.region===region).map(p=><option key={p.code} value={p.code}>{p.prefecture}（{destinationPool(region,p.code).length}候補）</option>)}</optgroup>):regionPrefectures.map(p=><option key={p.code} value={p.code}>{p.prefecture}（{destinationPool(area,p.code).length}候補）</option>)}</select><ChevronDown size={17} aria-hidden="true"/></div>
            </div>
            <p className="scope-confirm"><span className="scope-dot"/>{scopeName}の<strong>{count(pool.length)}市区町村</strong>が候補</p>
          </div>
          <div className="picker-visual" ref={stageRef}>
            <DartTarget key={shot?.id??`preview-${area}-${prefectureCode}`} phase={stage} destination={shot?.destination} pool={pool} scopeName={scopeName} onThrow={()=>throwDart()}/>
          </div>
          <div className="draw-panel details-panel">
            <div className="secondary-disclosures">
              <details className="pool-details" key={`pool-${area}-${prefectureCode}`} onToggle={event=>setPoolOpen(event.currentTarget.open)}><summary><Search size={16}/>候補の町を見る<ChevronDown size={16}/></summary>{poolOpen&&<div className="candidate-browser"><input type="search" aria-label="候補一覧を検索" placeholder="市区町村名を検索" value={poolSearch} onChange={event=>setPoolSearch(event.target.value)} disabled={busy}/><p className="candidate-count">{count(visibleCandidates.length)} / {count(pool.length)}件</p>{visibleCandidates.length?<ul className="municipality-list">{visibleCandidates.map(d=><li key={d.id}>{!selectedPrefecture&&<small>{d.prefecture}</small>}<span>{d.city}</span></li>)}</ul>:<p>一致する市区町村がありません。</p>}</div>}</details>
              <details className="map-details" key={`map-${area}-${prefectureCode}`} onToggle={event=>setMapOpen(event.currentTarget.open)}><summary><MapPin size={16}/>範囲を地図で見る<ChevronDown size={16}/></summary>{mapOpen&&<div className="map-preview"><TravelMap area={area} prefectureCode={prefectureCode} destination={null}/></div>}</details>
            </div>
            <div className="draw-action action-dock"><button className="primary-button dart-start-button" disabled={busy} onClick={()=>throwDart()}><Crosshair size={21}/>{busy?'ダーツが飛んでいます…':'ダーツを投げる'}<ArrowRight size={18}/></button><p className="action-hint">{busy?<button className="text-button" onClick={cancelDraw}>投げるのを中止</button>:'どの町に当たるかは、投げてからのお楽しみ。'}</p></div>
          </div>
        </div></section>
        <section className="journey-steps" aria-label="旅の楽しみ方">
          <div className="journey-photo"><img src="./assets/coastal-town-hero.webp" alt="海辺の町並みの旅のイメージ" loading="lazy"/><span>いつもと違う町へ。</span></div>
          <div className="journey-copy"><p className="eyebrow">FOR THE NEXT OPEN WEEKEND</p><h2>予定のない週末に、<br/>偶然の町と出会おう。</h2><p className="journey-lead">自分では選ばなかった町にも、好きになる景色があるかもしれない。ダーツを投げて、気になった町を地図で覗いてみよう。</p>
            <div className="journey-steps-list"><div><span>01</span><strong>行ける範囲を決める</strong><p>全国、地域、都道府県から。</p></div><div><span>02</span><strong>ダーツを投げる</strong><p>着弾したら、ひとつの町が決まる。</p></div><div><span>03</span><strong>町を見つけに行く</strong><p>地図で調べて、気になったら保存。</p></div></div>
            <button className="journey-cta" onClick={()=>document.getElementById('trip-picker')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>ダーツを投げる<ArrowRight size={17}/></button>
          </div>
        </section>
        <div className="below-workspace">{result&&lastResult?<button className="last-trip" onClick={()=>openResult(lastResult)}><span>前回の旅先</span><strong>{result.prefecture} {result.city}</strong><ArrowRight size={16}/></button>:<p>思いがけない町へ、出かけよう。</p>}<button className="help-link" onClick={()=>setInfoOpen(true)}>決め方のしくみ <ArrowRight size={14}/></button></div>
      </>}
      {screen==='result'&&result&&lastResult&&<>
        <div className="screen-top result-top"><div><p className="eyebrow">THE DART HAS LANDED</p><h1 ref={screenHeading} tabIndex={-1}>命中！ 次の旅先は。</h1></div><span className="draw-context">{lastResult.prefectureCode?`${result.prefecture}を指定`:`${lastResult.area}から抽選`} · {dateLabel(lastResult.drawnAt)}</span></div>
        <section className="result-shell" aria-label="抽選結果"><div className="result-panel"><div className="destination-caption"><span><span className="scope-dot"/>{result.region} / {result.prefecture}</span><button className={`save-button ${saved?'is-saved':''}`} aria-pressed={saved} onClick={()=>toggleSaved(result)}><Bookmark size={17} fill={saved?'currentColor':'none'}/>{saved?'保存済み':'保存する'}</button></div><div className="result-ticket"><span>ダーツが選んだ旅先</span><strong aria-label="命中"><Crosshair size={32}/></strong></div><p className="destination-overline">YOUR NEXT STOP</p><h2 className="destination-city">{result.city}</h2><p className="destination-message">今日はこの町を、目的地にしてみよう。</p><a className="primary-button map-action" href={mapUrl(result)} target="_blank" rel="noreferrer"><MapPin size={19}/>Googleマップで見る<ExternalLink size={16}/></a><p className="action-hint">地図アプリが別タブで開きます</p><div className="nearby"><span className="small-label">近くで探す</span><div><a href={mapUrl(result,' 観光スポット')} target="_blank" rel="noreferrer"><Compass size={16}/>観光スポット<ExternalLink size={12}/></a><a href={mapUrl(result,' 飲食店')} target="_blank" rel="noreferrer"><Utensils size={16}/>ごはん<ExternalLink size={12}/></a></div></div><div className="result-retry"><button className="secondary-button" onClick={()=>throwDart(lastResult.area,lastResult.prefectureCode??null)}><RotateCcw size={16}/>もう一度投げる</button><button className="text-button change-area" onClick={()=>goExplore()}>エリアを変える<ArrowRight size={14}/></button></div></div><div className="result-map"><TravelMap area={result.region} prefectureCode={result.code} destination={result}/><span className="map-caption">{result.prefecture}の地図</span><span className="map-note">一部離島は省略。町の位置はGoogleマップで確認できます。</span></div></section>
        <div className="result-after"><Check size={16}/><span>{storageFailed?'ブラウザの履歴保存は利用できません。':'この旅先は履歴から見返せます。'}</span><button className="help-link" onClick={()=>navigate('history')}>履歴を見る<ArrowRight size={14}/></button></div>
      </>}
      {screen==='history'&&<section className="history-screen"><div className="screen-top"><div><p className="eyebrow">PLACES FOUND BY CHANCE</p><h1 ref={screenHeading} tabIndex={-1}>旅先の記録</h1><p className="intro">気になった町を、いつでも見返せます。</p></div><button className="back-link" onClick={()=>goExplore()}><ArrowLeft size={16}/>旅先ダーツに戻る</button></div><div className="history-toolbar"><div className="history-filters" role="group" aria-label="履歴の表示切り替え"><button className={historyFilter==='all'?'selected':''} aria-pressed={historyFilter==='all'} onClick={()=>setHistoryFilter('all')}>投げた履歴<span>{history.length}</span></button><button className={historyFilter==='saved'?'selected':''} aria-pressed={historyFilter==='saved'} onClick={()=>setHistoryFilter('saved')}><Bookmark size={15}/>保存した町<span>{savedDestinationIds.length}</span></button></div><p>{historyFilter==='all'?'最近30回まで':'保存した町は残ります'}</p></div>{historyItems.length?<ul className="history-list">{historyItems.map(record=>{const d=findDestination(record.destinationId)!,isSaved=savedDestinationIds.includes(record.destinationId);return <li className="history-row" key={record.id}><button className="history-open" aria-label={`${d.prefecture} ${d.city}の結果を見る`} onClick={()=>openResult(record)}><span className="history-pin"><MapPin size={17}/></span><span className="history-place"><small>{d.prefecture}</small><strong>{d.city}</strong><span>{dateLabel(record.drawnAt)} · {record.prefectureCode?d.prefecture:record.area}</span></span><ArrowRight className="history-arrow" size={18}/></button><button className={`history-save ${isSaved?'is-saved':''}`} aria-label={`${d.city}を${isSaved?'保存から外す':'保存する'}`} aria-pressed={isSaved} onClick={()=>toggleSaved(d)}><Bookmark size={19} fill={isSaved?'currentColor':'none'}/></button></li>;})}</ul>:<div className="empty-history"><span><Crosshair size={32}/></span><h2>{historyFilter==='all'?'まだ旅先はありません':'保存した町はありません'}</h2><p>{historyFilter==='all'?'ダーツを投げると、旅先がここに並びます。':'結果画面の「保存する」で残せます。'}</p><button className="primary-button" onClick={()=>goExplore()}>旅先を探す<ArrowRight size={18}/></button></div>}<p className="history-footnote">履歴と保存した町は、このブラウザに記録されます。</p></section>}
    </main>
    <footer className="app-footer"><span>© 2026 きまぐれダーツ旅</span><button onClick={()=>setInfoOpen(true)}>使い方・データの出典<ArrowRight size={12}/></button></footer>
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="info-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="閉じる"><X size={20}/></DialogClose><p className="eyebrow">ABOUT THIS APP</p><DialogTitle>偶然から、旅先を見つける。</DialogTitle><DialogDescription>行ける範囲を選んで、ダーツを投げるだけ。</DialogDescription><ol className="info-steps"><li><b>01</b><div><strong>範囲を選ぶ</strong><p>全国・7地域・47都道府県から選べます。候補一覧と地域地図も確認できます。</p></div></li><li><b>02</b><div><strong>ダーツを投げる</strong><p>着弾点は選ばれた町に対応します。町は指定範囲の全候補から市区町村単位で均等に抽選し、直前と同じ町は避けます。盤面は地理的な位置を示す地図ではありません。</p></div></li><li><b>03</b><div><strong>町を調べる</strong><p>結果画面からGoogleマップへ。気になった町は保存できます。</p></div></li></ol><div className="info-notes"><p>市区町村データ：<a href="https://github.com/code4fukui/localgovjp" target="_blank" rel="noreferrer">Code for FUKUI / localgovjp</a> · <a href="./assets/municipality-source.txt" target="_blank" rel="noreferrer">出典・CC0</a>。全国{count(destinations.length)}候補。政令指定都市は市単位、東京23区は区単位です。</p><p>履歴は最近30回まで。保存した町は別に残ります。ブラウザのデータを削除すると記録も消えます。</p><p>地図：<a href="https://github.com/geolonia/japanese-prefectures" target="_blank" rel="noreferrer">Geolonia / Wikipedia</a> · <a href="./assets/map-source.txt" target="_blank" rel="noreferrer">出典</a> · <a href="./assets/map-license.txt" target="_blank" rel="noreferrer">GFDL</a>。一部の離島は省略しています。九州・沖縄の地域地図は沖縄を別枠で表示します。写真は生成した旅のイメージで、抽選先の風景ではありません。</p></div></DialogContent></Dialog>
  </>;
}
