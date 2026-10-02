import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Bookmark,Check,ChevronDown,Compass,ExternalLink,History,Info,MapPin,RotateCcw,Search,Shuffle,Utensils,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {destinations,prefectures,destinationPool,pickDestination,regions,type Destination} from '@/lib/destinations';
import {SlotMachine} from '@/components/slot-machine';
import {TravelMap,preloadTravelMap} from '@/components/travel-map';
import {loadTravelState,travelStorageKey,findDestination,findPrefecture,resolveRoute,validAreas,type Area,type TripRecord,type TravelState} from '@/lib/travel-state';

type Screen = 'explore'|'result'|'history';
type Stage = 'ready'|'spinning'|'landed';
type SlotShot = {id:string;destination:Destination;spinMs:number};
const count = (n:number) => n.toLocaleString('ja-JP');
const mapUrl = (destination:Destination,suffix='') => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.prefecture} ${destination.city}${suffix}`)}`;
const dateLabel = (timestamp:number) => timestamp ? new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(timestamp) : '保存した旅先';

export default function App() {
  const [travel,setTravel] = useState<TravelState>(loadTravelState);
  const [screen,setScreen] = useState<Screen>(() => resolveRoute(window.location.hash,loadTravelState()).screen);
  const [stage,setStage] = useState<Stage>('ready');
  const [shot,setShot] = useState<SlotShot>();
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
    navigate('explore');
  }
  function openResult(record:TripRecord) {setTravel(current=>({...current,lastResult:record}));navigate('result',record.id);}
  function toggleSaved(destination:Destination) {
    const isSaved=savedDestinationIds.includes(destination.id);
    setTravel(current=>({...current,savedDestinationIds:isSaved?current.savedDestinationIds.filter(id=>id!==destination.id):[destination.id,...current.savedDestinationIds]}));
    setAnnouncement(`${destination.city}を${isSaved?'保存から外しました':'保存しました'}。`);
  }
  function spinSlot(selectedArea:Area=area,selectedCode:number|null=prefectureCode) {
    if(running.current)return;
    clearDraw();running.current=true;
    const chosen=pickDestination(selectedArea,Math.random,selectedCode,history[0]?.destinationId);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    preloadTravelMap(chosen.region,chosen.code).catch(()=>{});
    const record:TripRecord={id:crypto.randomUUID(),code:chosen.code,destinationId:chosen.id,area:selectedArea,prefectureCode:selectedCode,drawnAt:Date.now()};
    setTravel(current=>({...current,area:selectedArea,prefectureCode:selectedCode}));
    const spinMs=3150;
    setShot({id:record.id,destination:chosen,spinMs});
    navigate('explore',undefined,screen==='result');setStage(reduced?'landed':'spinning');
    setAnnouncement(`${selectedCode?chosen.prefecture:selectedArea}の市区町村から抽選しています。`);
    requestAnimationFrame(()=>stageRef.current?.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'}));
    const land=() => {
      setStage('landed');
      if(!reduced && navigator.vibrate) {try {navigator.vibrate([25,30,45]);} catch {}}
      timeouts.current.push(setTimeout(()=>{
        setTravel(current=>({...current,lastResult:record,history:[record,...current.history].slice(0,30)}));
        setStage('ready');navigate('result',record.id);
        setAnnouncement(`旅先は${chosen.prefecture}の${chosen.city}に決まりました。`);
        running.current=false;
      },reduced?0:1250));
    };
    timeouts.current.push(setTimeout(land,reduced?100:spinMs+100));
  }
  function cancelDraw() {clearDraw();setStage('ready');setShot(undefined);setAnnouncement('抽選を中止しました。');}
  useEffect(() => {
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void}}).modelContext;
    if(!context?.registerTool)return;
    const abort=new AbortController();
    try {context.registerTool({name:'start_random_trip',title:'旅先スロットの準備',description:'エリアを指定して抽選の準備をします。抽選はまだ実行しません。',inputSchema:{type:'object',properties:{area:{type:'string',enum:validAreas}},required:['area'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{
      const selected=(input as {area?:Area})?.area;
      if(!selected||!validAreas.includes(selected))throw new Error('有効なエリアを指定してください');
      if(running.current)throw new Error('抽選が終わるまでお待ちください');
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
      <button className="brand" onClick={()=>goExplore()} disabled={busy} aria-label="きまぐれ旅 ホーム"><span className="brand-icon" aria-hidden="true"><i/><i/><i/></span><span>きまぐれ<span>旅</span></span></button>
      <nav aria-label="メインナビゲーション" className="app-nav"><button className={`nav-item ${screen!=='history'?'active':''}`} aria-current={screen!=='history'?'page':undefined} onClick={()=>goExplore()} disabled={busy}><Shuffle size={16}/>抽選</button><button className={`nav-item ${screen==='history'?'active':''}`} aria-current={screen==='history'?'page':undefined} onClick={()=>navigate('history')} disabled={busy}><History size={16}/>履歴{history.length>0&&<span className="nav-count">{history.length}</span>}</button></nav>
      <button className="info-button" aria-label="使い方と出典" disabled={busy} onClick={()=>setInfoOpen(true)}><Info size={18}/></button>
    </header>
    <main id="main-content" tabIndex={-1} className={`app-main screen-${screen}`}>
      {storageFailed&&<p className="storage-notice">このブラウザでは履歴を保存できません。抽選と地図は利用できます。</p>}
      {screen==='explore'&&<>
        <div className="screen-top"><div><p className="eyebrow">A SMALL DETOUR, A NEW PLACE.</p><h1 ref={screenHeading} tabIndex={-1}>次は、どの町へ。</h1><p className="intro">行ける範囲を決めたら、スロットを回そう。</p></div><span className="screen-count">全国 <strong>{count(destinations.length)}</strong> 市区町村</span></div>
        <section className="picker-shell" aria-label="旅先の抽選">
          <div className="picker-visual" ref={stageRef}>
            <SlotMachine key={shot?.id??`preview-${area}-${prefectureCode}`} phase={stage} destination={shot?.destination??pool[0]} pool={pool} area={area} prefectureCode={prefectureCode} seed={shot?.id??'preview'} spinMs={shot?.spinMs??3150}/>
            <p className="visual-footnote">{busy?'リールが順に止まります':`${scopeName}の${count(pool.length)}候補から選びます`}</p>
          </div>
          <div className="draw-panel">
            <div className="panel-heading"><span className="step-number">01</span><div><h2>行ける範囲</h2><p>全国からでも、県を指定しても。</p></div></div>
            <div className="scope-fields"><label htmlFor="area-select">地域</label><div className="select-wrap"><select id="area-select" value={area} disabled={busy} onChange={event=>{const next=event.target.value;setTravel(current=>({...current,area:next,prefectureCode:null}));setAnnouncement(`${next}を選びました。${count(destinationPool(next).length)}市区町村が候補です。`);}}>{validAreas.map(option=><option key={option} value={option}>{option}（{count(destinationPool(option).length)}候補）</option>)}</select><ChevronDown size={17} aria-hidden="true"/></div>
              <label htmlFor="prefecture-select">都道府県 <span>任意</span></label><div className="select-wrap"><select id="prefecture-select" value={prefectureCode??''} disabled={busy} onChange={event=>{const chosen=findPrefecture(Number(event.target.value));setTravel(current=>({...current,area:chosen?.region??current.area,prefectureCode:chosen?.code??null}));setAnnouncement(chosen?`${chosen.prefecture}の${count(destinationPool(chosen.region,chosen.code).length)}市区町村が候補です。`:`${area}の${count(destinationPool(area).length)}市区町村が候補です。`);}}><option value="">{area}の中からおまかせ</option>{area==='全国'?regions.map(region=><optgroup key={region} label={region}>{prefectures.filter(p=>p.region===region).map(p=><option key={p.code} value={p.code}>{p.prefecture}（{destinationPool(region,p.code).length}候補）</option>)}</optgroup>):regionPrefectures.map(p=><option key={p.code} value={p.code}>{p.prefecture}（{destinationPool(area,p.code).length}候補）</option>)}</select><ChevronDown size={17} aria-hidden="true"/></div>
            </div>
            <p className="scope-confirm"><span className="scope-dot"/>{scopeName}の<strong>{count(pool.length)}市区町村</strong>が候補</p>
            <div className="secondary-disclosures">
              <details className="pool-details" key={`pool-${area}-${prefectureCode}`} onToggle={event=>setPoolOpen(event.currentTarget.open)}><summary><Search size={16}/>候補の町を見る<ChevronDown size={16}/></summary>{poolOpen&&<div className="candidate-browser"><input type="search" aria-label="候補一覧を検索" placeholder="市区町村名を検索" value={poolSearch} onChange={event=>setPoolSearch(event.target.value)} disabled={busy}/><p className="candidate-count">{count(visibleCandidates.length)} / {count(pool.length)}件</p>{visibleCandidates.length?<ul className="municipality-list">{visibleCandidates.map(d=><li key={d.id}>{!selectedPrefecture&&<small>{d.prefecture}</small>}<span>{d.city}</span></li>)}</ul>:<p>一致する市区町村がありません。</p>}</div>}</details>
              <details className="map-details" key={`map-${area}-${prefectureCode}`} onToggle={event=>setMapOpen(event.currentTarget.open)}><summary><MapPin size={16}/>範囲を地図で見る<ChevronDown size={16}/></summary>{mapOpen&&<div className="map-preview"><TravelMap area={area} prefectureCode={prefectureCode} destination={null}/></div>}</details>
            </div>
            <div className="draw-action action-dock"><button className="primary-button slot-start-button" disabled={busy} onClick={()=>spinSlot()}><span className="slot-button-symbol" aria-hidden="true"><i/><i/><i/></span>{busy?'抽選中…':'スロットを回す'}<ArrowRight size={18}/></button><p className="action-hint">{busy?<button className="text-button" onClick={cancelDraw}>抽選をやめる</button>:'タップすると、町の名前が流れます'}</p></div>
          </div>
        </section>
        <div className="below-workspace">{result&&lastResult?<button className="last-trip" onClick={()=>openResult(lastResult)}><span>前回の旅先</span><strong>{result.prefecture} {result.city}</strong><ArrowRight size={16}/></button>:<p>思いがけない町へ、出かけよう。</p>}<button className="help-link" onClick={()=>setInfoOpen(true)}>抽選のしくみ <ArrowRight size={14}/></button></div>
      </>}
      {screen==='result'&&result&&lastResult&&<>
        <div className="screen-top result-top"><div><p className="eyebrow">YOUR NEXT DESTINATION</p><h1 ref={screenHeading} tabIndex={-1}>行き先が、決まりました。</h1></div><span className="draw-context">{lastResult.prefectureCode?`${result.prefecture}を指定`:`${lastResult.area}から抽選`} · {dateLabel(lastResult.drawnAt)}</span></div>
        <section className="result-shell" aria-label="抽選結果"><div className="result-panel"><div className="destination-caption"><span><span className="scope-dot"/>{result.region} / {result.prefecture}</span><button className={`save-button ${saved?'is-saved':''}`} aria-pressed={saved} onClick={()=>toggleSaved(result)}><Bookmark size={17} fill={saved?'currentColor':'none'}/>{saved?'保存済み':'保存する'}</button></div><p className="destination-overline">NEXT STOP</p><h2 className="destination-city">{result.city}</h2><p className="destination-message">いつもなら選ばなかった町に、出会えた。</p><a className="primary-button map-action" href={mapUrl(result)} target="_blank" rel="noreferrer"><MapPin size={19}/>Googleマップで見る<ExternalLink size={16}/></a><p className="action-hint">地図アプリが別タブで開きます</p><div className="nearby"><span className="small-label">近くで探す</span><div><a href={mapUrl(result,' 観光スポット')} target="_blank" rel="noreferrer"><Compass size={16}/>観光スポット<ExternalLink size={12}/></a><a href={mapUrl(result,' 飲食店')} target="_blank" rel="noreferrer"><Utensils size={16}/>ごはん<ExternalLink size={12}/></a></div></div><div className="result-retry"><button className="secondary-button" onClick={()=>spinSlot(lastResult.area,lastResult.prefectureCode??null)}><RotateCcw size={16}/>もう一度回す</button><button className="text-button change-area" onClick={()=>goExplore()}>エリアを変える<ArrowRight size={14}/></button></div></div><div className="result-map"><TravelMap area={result.region} prefectureCode={result.code} destination={result}/><span className="map-caption">{result.prefecture}の地図</span></div></section>
        <div className="result-after"><Check size={16}/><span>{storageFailed?'ブラウザの履歴保存は利用できません。':'この旅先は履歴から見返せます。'}</span><button className="help-link" onClick={()=>navigate('history')}>履歴を見る<ArrowRight size={14}/></button></div>
      </>}
      {screen==='history'&&<section className="history-screen"><div className="screen-top"><div><p className="eyebrow">PLACES FOUND BY CHANCE</p><h1 ref={screenHeading} tabIndex={-1}>旅先の記録</h1><p className="intro">気になった町を、いつでも見返せます。</p></div><button className="back-link" onClick={()=>goExplore()}><ArrowLeft size={16}/>抽選に戻る</button></div><div className="history-toolbar"><div className="history-filters" role="group" aria-label="履歴の表示切り替え"><button className={historyFilter==='all'?'selected':''} aria-pressed={historyFilter==='all'} onClick={()=>setHistoryFilter('all')}>抽選の履歴<span>{history.length}</span></button><button className={historyFilter==='saved'?'selected':''} aria-pressed={historyFilter==='saved'} onClick={()=>setHistoryFilter('saved')}><Bookmark size={15}/>保存した町<span>{savedDestinationIds.length}</span></button></div><p>{historyFilter==='all'?'最近30回まで':'保存した町は残ります'}</p></div>{historyItems.length?<ul className="history-list">{historyItems.map(record=>{const d=findDestination(record.destinationId)!,isSaved=savedDestinationIds.includes(record.destinationId);return <li className="history-row" key={record.id}><button className="history-open" aria-label={`${d.prefecture} ${d.city}の結果を見る`} onClick={()=>openResult(record)}><span className="history-pin"><MapPin size={17}/></span><span className="history-place"><small>{d.prefecture}</small><strong>{d.city}</strong><span>{dateLabel(record.drawnAt)} · {record.prefectureCode?d.prefecture:record.area}</span></span><ArrowRight className="history-arrow" size={18}/></button><button className={`history-save ${isSaved?'is-saved':''}`} aria-label={`${d.city}を${isSaved?'保存から外す':'保存する'}`} aria-pressed={isSaved} onClick={()=>toggleSaved(d)}><Bookmark size={19} fill={isSaved?'currentColor':'none'}/></button></li>;})}</ul>:<div className="empty-history"><span><Shuffle size={32}/></span><h2>{historyFilter==='all'?'まだ旅先はありません':'保存した町はありません'}</h2><p>{historyFilter==='all'?'スロットを回すと、旅先がここに並びます。':'結果画面の「保存する」で残せます。'}</p><button className="primary-button" onClick={()=>goExplore()}>旅先を探す<ArrowRight size={18}/></button></div>}<p className="history-footnote">履歴と保存した町は、このブラウザに記録されます。</p></section>}
    </main>
    <footer className="app-footer"><span>© 2026 きまぐれ旅</span><button onClick={()=>setInfoOpen(true)}>使い方・データの出典<ArrowRight size={12}/></button></footer>
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="info-dialog" showCloseButton={false}><DialogClose className="dialog-close" aria-label="閉じる"><X size={20}/></DialogClose><p className="eyebrow">ABOUT THIS APP</p><DialogTitle>偶然から、旅先を見つける。</DialogTitle><DialogDescription>行ける範囲を選び、スロットを回すだけ。</DialogDescription><ol className="info-steps"><li><b>01</b><div><strong>範囲を選ぶ</strong><p>全国・7地域・47都道府県から選べます。候補一覧と地域地図も確認できます。</p></div></li><li><b>02</b><div><strong>スロットを回す</strong><p>地域、都道府県、市区町村の順に止まります。指定した範囲は最初から固定。リールに流れる名前は演出で、抽選は全候補から市区町村単位で行い、直前と同じ町は避けます。</p></div></li><li><b>03</b><div><strong>町を調べる</strong><p>結果画面からGoogleマップへ。気になった町は保存できます。</p></div></li></ol><div className="info-notes"><p>市区町村データ：<a href="https://github.com/code4fukui/localgovjp" target="_blank" rel="noreferrer">Code for FUKUI / localgovjp</a> · <a href="./assets/municipality-source.txt" target="_blank" rel="noreferrer">出典・CC0</a>。全国{count(destinations.length)}候補。政令指定都市は市単位、東京23区は区単位です。</p><p>履歴は最近30回まで。保存した町は別に残ります。ブラウザのデータを削除すると記録も消えます。</p><p>地図：<a href="https://github.com/geolonia/japanese-prefectures" target="_blank" rel="noreferrer">Geolonia / Wikipedia</a> · <a href="./assets/map-source.txt" target="_blank" rel="noreferrer">出典</a> · <a href="./assets/map-license.txt" target="_blank" rel="noreferrer">GFDL</a>。一部の離島は省略しています。九州・沖縄の地域地図は沖縄を別枠で表示します。</p></div></DialogContent></Dialog>
  </>;
}
