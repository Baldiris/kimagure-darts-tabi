import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Crosshair} from 'lucide-react';
import {findPrefecture,type Destination} from '@/lib/destinations';
import type {Area} from '@/lib/travel-state';
import {preloadTravelMap} from './travel-map';
import {coordinatesFor,fitView,project,screenPoint,tilesFor} from '@/lib/geo-map';

type Props={phase:'ready'|'flying'|'landed';destination?:Destination;pool:Destination[];scopeName:string;area:Area;prefectureCode:number|null;onThrow:()=>void;onSelectPrefecture:(code:number)=>void};
export function DartTarget({phase,destination,pool,scopeName,area,prefectureCode,onThrow,onSelectPrefecture}:Props) {
  const surface=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:800,height:560});
  const [outline,setOutline]=useState(''),[outlineFailed,setOutlineFailed]=useState(false);
  const [loadedTiles,setLoadedTiles]=useState(0),[failedTiles,setFailedTiles]=useState(0);
  useLayoutEffect(()=>{
    const element=surface.current;if(!element)return;
    const measure=()=>{const rect=element.getBoundingClientRect();setSize({width:rect.width,height:rect.height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let active=true;setOutlineFailed(false);
    preloadTravelMap(area,prefectureCode).then(markup=>{
      if(!active)return;
      const doc=new DOMParser().parseFromString(markup,'image/svg+xml');
      doc.querySelectorAll<SVGElement>('.prefecture').forEach(shape=>{
        const code=Number(shape.dataset.code),place=findPrefecture(code);
        shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',`${place?.prefecture??''}を選ぶ`);
        if(prefectureCode===code)shape.classList.add('selected');
      });
      setOutline(new XMLSerializer().serializeToString(doc.documentElement));
    }).catch(()=>{if(active)setOutlineFailed(true);});return()=>{active=false};
  },[area,prefectureCode]);
  const view=useMemo(()=>fitView(pool,size.width,size.height),[pool,size.width,size.height]);
  const tiles=useMemo(()=>tilesFor(view,size.width,size.height),[view,size.width,size.height]);
  useEffect(()=>{setLoadedTiles(0);setFailedTiles(0);},[view]);
  const position=destination&&coordinatesFor(destination.id);
  const hit=position?screenPoint(project(position),view,size.width,size.height):null;
  const markers=useMemo(()=>pool.map(d=>({id:d.id,...screenPoint(project(coordinatesFor(d.id)!),view,size.width,size.height)})).filter(p=>p.x>=0&&p.x<=size.width&&p.y>=0&&p.y<=size.height),[pool,view,size]);
  function choose(target:EventTarget|null){const shape=target instanceof Element?target.closest<SVGElement>('[data-code]'):null;if(phase==='ready'&&shape)onSelectPrefecture(Number(shape.dataset.code));}
  return <div className={`map-dart ${phase}`} ref={surface}>
    {phase==='ready'?<div className="ready-map" onClick={event=>choose(event.target)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(event.target);}}}>
      {outline&&!outlineFailed?<div className="country-outline" dangerouslySetInnerHTML={{__html:outline}}/>:<p className="map-state-message">{outlineFailed?'地図を表示できません。範囲を選んで投げられます。':'地図を準備しています…'}</p>}
    </div>:<div className="throw-map" role="img" aria-label={`${scopeName}の地理院地図。候補の町にダーツを投げています。`}>
      <div className="map-dart-tiles" aria-hidden="true">{tiles.map(tile=><img key={`${tile.zoom}-${tile.x}-${tile.y}`} src={`https://cyberjapandata.gsi.go.jp/xyz/pale/${tile.zoom}/${tile.x}/${tile.y}.png`} alt="" draggable="false" style={{left:tile.left,top:tile.top,width:tile.size+.5,height:tile.size+.5}} onLoad={()=>setLoadedTiles(n=>n+1)} onError={()=>setFailedTiles(n=>n+1)}/>)}</div>
      <svg className="map-town-points" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">{markers.map(point=><circle key={point.id} cx={point.x} cy={point.y} r={pool.length>400?2.1:3}/>)}</svg>
      {loadedTiles===0&&<p className="map-tile-status">{failedTiles===tiles.length?'町の位置を点で表示しています。地図の画像は取得できませんでした。':'地理院地図を読み込んでいます…'}</p>}
    </div>}
    <div className="map-dart-heading"><span>投げる地図</span><strong>{scopeName==='全国'?'日本全国':scopeName}</strong></div>
    <div className="map-north" aria-hidden="true"><span>N</span><i/></div>
    {hit&&phase!=='ready'&&<div className="map-hit-position" style={{left:hit.x,top:hit.y}} aria-hidden="true">
      <span className="map-impact-ring"/><span className="map-impact-dot"/>
      <svg className="map-real-dart" viewBox="0 0 152 44"><defs><linearGradient id="dart-metal" x2="0" y2="1"><stop stopColor="#f8f6ec"/><stop offset=".5" stopColor="#717b80"/><stop offset="1" stopColor="#e8e4d7"/></linearGradient></defs><path d="M0 3 37 15 31 22 37 29 0 41 9 22Z" fill="#cc4d35"/><path d="M3 22h36M10 10l13 12-13 12" fill="none" stroke="#87372b" strokeWidth="1.5"/><path d="M32 19h68v6H32Z" fill="url(#dart-metal)"/><path d="M82 17h45v10H82Z" fill="#d4ac64" stroke="#6b5b42"/><path d="M88 18v8m6-8v8m6-8v8m6-8v8m6-8v8m6-8v8" stroke="#71664d"/><path d="M127 20 152 22 127 24Z" fill="#4c5253"/></svg>
      {phase==='landed'&&destination&&<div className={`map-winner-label ${hit.x>size.width*.6?'label-left':''} ${hit.y<size.height*.25?'label-below':''}`}><small>{destination.prefecture}</small><strong>{destination.city}</strong></div>}
    </div>}
    <div className="map-dart-bottom"><span className="map-key-point"/><span>{phase==='ready'?'地図の県をタップして選べます':phase==='flying'?'ダーツが飛んでいます…':'この町に、着弾。'}</span><span className="map-dart-count">{pool.length.toLocaleString('ja-JP')}の町</span></div>
    {phase==='ready'?<button className="map-throw-control" onClick={onThrow}><Crosshair size={16}/>地図に投げる<ArrowUpRight size={16}/></button>:<a className="map-dart-credit" href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">出典：国土地理院</a>}
  </div>;
}
