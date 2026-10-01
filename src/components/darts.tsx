import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent} from 'react';
import {ArrowRight} from 'lucide-react';
import {type Destination} from '@/lib/destinations';
import {findDestination, type Area} from '@/lib/travel-state';

export type DartPhase = 'preview' | 'windup' | 'flying' | 'landed' | 'result';
export type DartCharge = {active:boolean; power:number};
export type DartShot = {id:string; destination:Destination; power:number; flightMs:number};
const regionalAssets: Record<string,string> = {'北海道・東北':'hokkaido-tohoku','関東':'kanto','中部':'chubu','近畿':'kinki','中国':'chugoku','四国':'shikoku','九州・沖縄':'kyushu-okinawa'};
const mapRequests = new Map<string,Promise<string>>();
export function preloadDartMap(area:Area = '全国') {
 const asset = regionalAssets[area] ? `./assets/regions/${regionalAssets[area]}.svg` : './assets/japan.svg';
 if (!mapRequests.has(asset)) mapRequests.set(asset, fetch(asset).then(response => {if (!response.ok) throw new Error('map'); return response.text();}).catch(error => {mapRequests.delete(asset); throw error;}));
 return mapRequests.get(asset)!;
}
type PrefectureLabel = {code:number; x:number; y:number; anchorX:number; anchorY:number; name:string};
const labelOffsets: Record<string,Record<number,[number,number]>> = {'北海道・東北':{3:[64,0],4:[76,0],5:[-64,0],6:[-64,0]},'中部':{17:[-28,0]},'九州・沖縄':{41:[-65,-15],42:[-55,20],47:[0,-75]}};

// The needle is at (0,0), so the same dart can land precisely on the map marker.
function DartShape() {
 const id = useId().replace(/:/g, '');
 return <g>
  <defs><linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5fbff"/><stop offset=".35" stopColor="#c4d2df"/><stop offset=".55" stopColor="#718399"/><stop offset="1" stopColor="#d5e0eb"/></linearGradient><linearGradient id={`${id}-flight`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff7352"/><stop offset="1" stopColor="#e3342e"/></linearGradient></defs>
  <path d="M0 0 48-3 48 3Z" fill="#7b8fa5"/>
  <path d="M8 0 49-1" stroke="#f8fcff" strokeWidth="1.5"/>
  <path d="M46-5 55-8 112-8 122-4 122 4 112 8 55 8 46 5Z" fill={`url(#${id}-steel)`} stroke="#62758b" strokeWidth="1.2"/>
  {[60,67,74,81,88,95,102].map(x => <path key={x} d={`M${x}-7v14`} stroke="#64758a" strokeWidth="2.3"/>)}
  <path d="M121-3H181V3H121Z" fill="#1f3762"/>
  <path d="M125-2H178" stroke="#b8c8df" strokeWidth="1.3"/>
  <path d="M157-3 191-32 229-28 217-3Z" fill={`url(#${id}-flight)`} stroke="#b1282d" strokeWidth="1.3"/>
  <path d="M157 3 191 32 229 28 217 3Z" fill="#e94235" stroke="#b1282d" strokeWidth="1.3"/>
  <path d="M178-3 212-25M178 3 212 25" stroke="#ffe9d9" strokeWidth="2"/>
  <path d="M182-1H222V2H182Z" fill="#ffe658"/>
  <path d="M204-27 224-25 216-14 198-14Z" fill="#ffb984" opacity=".65"/>
 </g>;
}
export function DartIcon({className = ''}: {className?:string}) {
 return <svg className={`dart-icon ${className}`} viewBox="0 0 245 88" aria-hidden="true"><g transform="translate(8 44)"><DartShape/></g></svg>;
}

export function DartMap({area, destination, phase, shot}: {area:Area; destination:Destination | null; phase:DartPhase; shot?:DartShot}) {
 const [map, setMap] = useState({area:'',markup:''}), [labels,setLabels] = useState<PrefectureLabel[]>([]), [failed, setFailed] = useState(false), [point, setPoint] = useState<{x:number;y:number} | null>(null);
 const mapRef = useRef<HTMLDivElement>(null);
 const markup = map.area === area ? map.markup : '', regional = Boolean(regionalAssets[area]);
 const hit = phase === 'landed' || phase === 'result';
 useEffect(() => {let alive = true; setFailed(false); preloadDartMap(area).then(value => {if (alive) setMap({area,markup:value});}).catch(() => {if (alive) setFailed(true);}); return () => {alive = false;};}, [area]);
 const coloredMarkup = useMemo(() => {
  if (!markup) return '';
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  document.querySelectorAll<SVGElement>('.prefecture').forEach(element => {
   const candidate = findDestination(Number(element.dataset.code));
   element.style.fill = hit && destination?.code === candidate?.code ? '#163af1' : candidate && (area === '全国' || candidate.region === area) ? '#a9c2ee' : '#dde5ef';
   element.style.stroke = '#f4f7fb'; element.style.strokeWidth = regional ? '1' : '2.5';
  });
  return new XMLSerializer().serializeToString(document.documentElement);
 }, [markup, area, regional, hit, destination?.code]);
 useLayoutEffect(() => {
  const group = mapRef.current?.querySelector<SVGGraphicsElement>(`[data-code="${destination?.code}"]`), svg = mapRef.current?.querySelector('svg');
  setLabels(regional && svg ? Array.from(svg.querySelectorAll<SVGElement>('[data-anchor-x]')).map(element => {
   const code = Number(element.dataset.code), anchorX = Number(element.dataset.anchorX), anchorY = Number(element.dataset.anchorY), offset = labelOffsets[area]?.[code] ?? [0,0];
   return {code,x:anchorX+offset[0],y:anchorY+offset[1],anchorX,anchorY,name:findDestination(code)!.prefecture.replace(/[都府県]$/, '')};
  }) : []);
  if (regional && group) {setPoint({x:Number(group.dataset.anchorX),y:Number(group.dataset.anchorY)}); return;}
  const prefecture = group && (Array.from(group.querySelectorAll<SVGGraphicsElement>('polygon,path')).sort((a,b) => {const x = a.getBBox(), y = b.getBBox(); return y.width*y.height-x.width*x.height;})[0] ?? group);
  if (!prefecture || !svg) {setPoint(null); return;}
  const box = prefecture.getBBox(), matrix = prefecture.getCTM(), inverse = svg.getCTM()?.inverse();
  if (!matrix || !inverse) return;
  const center = svg.createSVGPoint(); center.x = box.x+box.width/2; center.y = box.y+box.height/2;
  // A bounding-box center can fall in the sea for a concave coastline.
  const shape = prefecture as SVGGeometryElement;
  if (typeof shape.isPointInFill === 'function' && !shape.isPointInFill(center)) {
   const candidates: {x:number;y:number;distance:number}[] = [];
   for (let x=1;x<20;x++) for (let y=1;y<20;y++) {
    const point = svg.createSVGPoint(); point.x = box.x+box.width*x/20; point.y = box.y+box.height*y/20;
    if (shape.isPointInFill(point)) candidates.push({x:point.x,y:point.y,distance:(x-10)**2+(y-10)**2});
   }
   const inside = candidates.sort((a,b)=>a.distance-b.distance)[0];
   if (inside) {center.x = inside.x; center.y = inside.y;}
  }
  const target = center.matrixTransform(matrix).matrixTransform(inverse);
  setPoint({x:target.x,y:target.y});
 }, [coloredMarkup, area, regional, destination?.code]);
 const power = shot?.power ?? 65;
 const position = point ?? {x:510,y:520};
 const style = {'--launch-x':`${790-position.x}px`, '--launch-y':`${845-position.y}px`, '--pullback':`${32+power*.45}px`, '--flight-ms':`${shot?.flightMs ?? 690}ms`} as CSSProperties;
 return <div className={`japan-map dart-stage ${regional ? 'regional-map' : ''} phase-${phase}`} role="img" aria-label={hit && destination ? `${destination.prefecture}にダーツが刺さった${regional ? area+'の地域地図' : '日本地図'}。一部の離島は省略されています。` : phase === 'preview' ? `${area}の地域地図。県名の表示された都道府県から旅先を抽選します。${area === '九州・沖縄' ? '沖縄は別枠で表示しています。' : ''}` : `${area}の地図にダーツを投げています。`}>
  {coloredMarkup ? <div className="map-svg" ref={mapRef} aria-hidden="true" dangerouslySetInnerHTML={{__html:coloredMarkup}}/> : <p className="map-placeholder">{failed ? '地図を表示できませんでした。抽選結果は表示できます。' : '地図を読み込み中…'}</p>}
  {(point || failed || (regional && coloredMarkup)) && <svg className="map-marker dart-layer" viewBox="0 0 1000 1000" style={style} aria-hidden="true">
   {regional && <g className="prefecture-map-labels">{labels.map(label => {const chosen = hit && label.code === destination?.code, y = label.y+(chosen ? -44 : 0); return <g key={label.code}>{(label.x !== label.anchorX || label.y !== label.anchorY) && <path className="prefecture-label-line" d={`M${label.anchorX} ${label.anchorY}L${label.x} ${y}`}/>}<text x={label.x} y={y} className={chosen ? 'is-hit' : ''}>{label.name}</text></g>;})}</g>}
   {hit && <g className="dart-impact" transform={`translate(${position.x} ${position.y})`} key={shot?.id ?? destination?.code}>
    <circle className="impact-ring ring-one" r="21"/><circle className="impact-ring ring-two" r="21"/>
    <circle className="dart-target-halo" r="28"/><circle r="11" fill="#eaff48" stroke="#163af1" strokeWidth="4"/>
    {phase === 'landed' && <g className="impact-sparks">{[0,60,120,180,240,300].map(angle => <path key={angle} d="M32 0h18" transform={`rotate(${angle})`}/>)}</g>}
   </g>}
   {phase !== 'preview' && <g transform={`translate(${position.x} ${position.y})`}><g className={`dart-projectile ${phase}`}><DartShape/></g></g>}
  </svg>}
  {phase !== 'result' && phase !== 'preview' && <div className="throw-phase" aria-hidden="true"><span className={phase==='windup'?'active':'complete'}>かまえる</span><i/><span className={phase==='flying'?'active':phase==='landed'?'complete':''}>投げる</span><i/><span className={phase==='landed'?'active':''}>着地</span></div>}
 </div>;
}

export function DartThrowButton({disabled, onThrow, onCharge}: {disabled:boolean; onThrow:(power:number)=>void; onCharge:(charge:DartCharge)=>void}) {
 const [charge, setCharge] = useState<DartCharge>({active:false,power:0});
 const holding = useRef(false), started = useRef(0), frame = useRef(0), suppressClickUntil = useRef(0);
 const callbacks = useRef({onThrow,onCharge}); callbacks.current = {onThrow,onCharge};
 const publish = (next:DartCharge) => {setCharge(next); callbacks.current.onCharge(next);};
 const cancel = () => {if (!holding.current) return; holding.current = false; cancelAnimationFrame(frame.current); publish({active:false,power:0});};
 const start = () => {
  if (disabled || holding.current) return;
  holding.current = true; started.current = performance.now();
  const update = () => {if (!holding.current) return; publish({active:true,power:Math.min(100,12+(performance.now()-started.current)/1200*88)}); frame.current = requestAnimationFrame(update);}; update();
 };
 const release = () => {
  if (!holding.current) return;
  const elapsed = performance.now()-started.current, power = elapsed<140 ? 65 : Math.min(100,Math.max(25,12+elapsed/1200*88));
  cancel(); suppressClickUntil.current = performance.now()+500; callbacks.current.onThrow(Math.round(power));
 };
 const pointerDown = (event:PointerEvent<HTMLButtonElement>) => {if (event.button!==0 || disabled) return; event.preventDefault(); event.currentTarget.focus({preventScroll:true}); event.currentTarget.setPointerCapture(event.pointerId); start();};
 const keyDown = (event:KeyboardEvent<HTMLButtonElement>) => {if (event.key==='Escape') {cancel(); return;} if (event.key===' ' || event.key==='Enter') {event.preventDefault(); if (!event.repeat) start();}};
 useEffect(() => {if (disabled) cancel();}, [disabled]);
 useEffect(() => {
  const loseFocus = () => cancel();
  const hidden = () => {if (document.hidden) cancel();};
  window.addEventListener('blur',loseFocus); document.addEventListener('visibilitychange',hidden);
  return () => {holding.current = false; cancelAnimationFrame(frame.current); window.removeEventListener('blur',loseFocus); document.removeEventListener('visibilitychange',hidden);};
 }, []);
 return <button className={`primary-button lime dart-throw-button ${charge.active?'is-charging':''}`} disabled={disabled} onPointerDown={pointerDown} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={keyDown} onKeyUp={event=>{if (event.key===' ' || event.key==='Enter') {event.preventDefault(); release();}}} onBlur={cancel} onContextMenu={event=>event.preventDefault()} onClick={()=>{if (!disabled && performance.now()>=suppressClickUntil.current) callbacks.current.onThrow(65);}} aria-label={disabled?'ダーツを投げています':charge.active?'指を離してダーツを投げる':'ダーツを投げる'}>
  <span className="button-dart"><DartIcon/></span><span>{disabled?'ダーツを投げています…':charge.active?'離して、投げる！':'ダーツを投げる'}</span>{charge.active?<b className="power-value">{Math.round(charge.power)}<small>%</small></b>:!disabled&&<ArrowRight size={18}/>}
  <span className="power-fill" aria-hidden="true" style={{transform:`scaleX(${charge.active?charge.power/100:0})`}}/>
 </button>;
}
