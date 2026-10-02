import {useEffect,useRef,useState} from 'react';
import {findPrefecture,type Destination} from '@/lib/destinations';
import type {Area} from '@/lib/travel-state';

type SlotPhase = 'ready'|'spinning'|'landed';
function coprimeStep(length:number) {
  const gcd = (a:number,b:number):number => b ? gcd(b,a%b) : a;
  return [17,19,23,29,1].find(step => gcd(step,length) === 1)!;
}
export function SlotMachine({phase,destination,pool,area,prefectureCode,seed,spinMs}: {
  phase:SlotPhase;destination:Destination;pool:Destination[];area:Area;
  prefectureCode:number|null;seed:string;spinMs:number;
}) {
  const [frame,setFrame] = useState({tick:0,elapsed:0});
  const clock = useRef({started:performance.now(),lastTick:0});
  useEffect(() => {
    if (phase !== 'spinning') return;
    const timer = setInterval(() => {
      const elapsed = performance.now()-clock.current.started;
      const cadence = elapsed < spinMs*.55 ? 72 : elapsed < spinMs*.82 ? 130 : 245;
      if (elapsed-clock.current.lastTick >= cadence) {
        clock.current.lastTick = elapsed;
        setFrame(current => ({tick:current.tick+1,elapsed}));
      }
    },45);
    return () => clearInterval(timer);
  },[phase,spinMs]);

  const ready = phase === 'ready';
  const offset = ready ? 0 : Number.parseInt(seed.slice(0,8),16);
  const regionLocked = ready || area !== '全国' || phase === 'landed' || frame.elapsed >= 800;
  const prefectureLocked = ready || prefectureCode !== null || phase === 'landed' || frame.elapsed >= 1650;
  const regions = [...new Set(pool.map(candidate => candidate.region))];
  const shownRegion = ready ? area : regionLocked ? destination.region : regions[(offset+frame.tick)%regions.length];
  const prefectureCodes = [...new Set(pool.filter(candidate => candidate.region === shownRegion).map(candidate => candidate.code))];
  const shownCode = ready ? prefectureCode : prefectureLocked ? destination.code : prefectureCodes[(offset+frame.tick*7)%prefectureCodes.length];
  const shownPrefecture = shownCode ? findPrefecture(shownCode)!.prefecture : 'おまかせ';
  const cityPool = ready ? pool : pool.filter(candidate => candidate.code === shownCode);
  const index = ready ? 0 : phase === 'landed' ? cityPool.findIndex(candidate => candidate.id === destination.id) : (offset+frame.tick*coprimeStep(cityPool.length))%cityPool.length;
  const neighbors = ready ? [null,null,null] : [-1,0,1].map(delta => cityPool[(index+delta+cityPool.length)%cityPool.length]);
  const status = ready ? '行き先は、まだ秘密。' : phase === 'landed' ? '行き先が決まりました' : !regionLocked ? '地域を選んでいます' : !prefectureLocked ? '都道府県を選んでいます' : '町を選んでいます';
  return <div className={`slot-stage ${phase}`} aria-hidden="true">
    <div className="slot-topline"><span>TRIP SLOT</span><span className="slot-topline-mark">{ready?'01 / READY':phase==='landed'?'03 / ARRIVED':'02 / SPINNING'}</span></div>
    <div className="slot-path">
      <div className={`slot-path-part ${regionLocked?'locked':'rolling'}`}><small>地域 <em>{ready ? area==='全国'?'抽選で決定':'指定済' : area!=='全国'?'指定済':regionLocked?'決定':'抽選中'}</em></small><strong>{shownRegion}</strong></div>
      <span className="slot-path-arrow">/</span>
      <div className={`slot-path-part ${prefectureLocked?'locked':'rolling'}`}><small>都道府県 <em>{ready ? prefectureCode?'指定済':'抽選で決定' : prefectureCode?'指定済':prefectureLocked?'決定':'抽選中'}</em></small><strong>{shownPrefecture}</strong></div>
    </div>
    <div className="slot-reel-label"><span>目的地</span><span>{pool.length.toLocaleString('ja-JP')} 市区町村から</span></div>
    <div className="slot-window">
      <div className="slot-selection"/>
      <div className="slot-reel-track" key={`${phase}-${frame.tick}-${cityPool.length}`}>
        {neighbors.map((candidate,i) => <div className={`slot-row ${i===1?'current':''}`} key={`${i}-${candidate?.id??'ready'}`}><small>{candidate?.prefecture ?? (i===1?'NEXT DESTINATION':'・ ・ ・')}</small><strong>{candidate?.city ?? (i===1?'どこへ行く？':'—')}</strong></div>)}
      </div>
      <span className="slot-caret left"/><span className="slot-caret right"/>
    </div>
    <div className="slot-bottom"><span className={`slot-live-dot ${phase}`}/>{status}</div>
  </div>;
}
