import {useEffect, useRef, useState} from 'react';
import {findPrefecture, type Destination} from '@/lib/destinations';
import type {Area} from '@/lib/travel-state';

type SlotPhase = 'spinning' | 'landed';

function coprimeStep(length:number) {
  const gcd = (a:number,b:number):number => b ? gcd(b,a%b) : a;
  return [17,19,23,29,1].find(step => gcd(step,length) === 1)!;
}

export function SlotMachine({phase,destination,pool,area,prefectureCode,seed,spinMs}: {
  phase:SlotPhase;
  destination:Destination;
  pool:Destination[];
  area:Area;
  prefectureCode:number|null;
  seed:string;
  spinMs:number;
}) {
  const [frame,setFrame] = useState({tick:0,elapsed:0});
  const clock = useRef({started:performance.now(),lastTick:0});
  useEffect(() => {
    if (phase === 'landed') return;
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

  const offset = Number.parseInt(seed.slice(0,8),16);
  const regionLocked = area !== '全国' || phase === 'landed' || frame.elapsed >= 800;
  const prefectureLocked = prefectureCode !== null || phase === 'landed' || frame.elapsed >= 1650;
  const regionChoices = [...new Set(pool.map(candidate => candidate.region))];
  const shownRegion = regionLocked ? destination.region : regionChoices[(offset+frame.tick)%regionChoices.length];
  const prefectureChoices = [...new Set(pool.filter(candidate => candidate.region === shownRegion).map(candidate => candidate.code))];
  const shownPrefectureCode = prefectureLocked ? destination.code : prefectureChoices[(offset+frame.tick*7)%prefectureChoices.length];
  const shownPrefecture = findPrefecture(shownPrefectureCode)!.prefecture;
  const cityPool = pool.filter(candidate => candidate.code === shownPrefectureCode);
  const step = coprimeStep(cityPool.length);
  const currentIndex = phase === 'landed' ? cityPool.findIndex(candidate => candidate.id === destination.id) : (offset+frame.tick*step)%cityPool.length;
  const shownCities = [-1,0,1].map(delta => cityPool[(currentIndex+delta+cityPool.length)%cityPool.length]);
  const stageLabel = phase === 'landed' ? '行き先、決定！' : !regionLocked ? '地域を選んでいます…' : !prefectureLocked ? '都道府県を選んでいます…' : '町を選んでいます…';

  return <div className={`slot-stage ${phase}`} aria-hidden="true">
    <div className="slot-cabinet">
      <div className="slot-topbar"><span className="slot-brand">DESTINATION <b>SLOT</b></span><span className="slot-lamps"><i className={regionLocked?'on':''}/><i className={prefectureLocked?'on':''}/><i className={phase==='landed'?'on':''}/></span></div>
      <div className="slot-path">
        <div className={`slot-path-part ${regionLocked?'locked':'rolling'}`}><small>REGION <em>{area !== '全国' ? '指定済' : regionLocked ? '確定' : '抽選中'}</em></small><strong>{shownRegion}</strong></div>
        <span className="slot-path-arrow">›</span>
        <div className={`slot-path-part ${prefectureLocked?'locked':'rolling'}`}><small>PREFECTURE <em>{prefectureCode !== null ? '指定済' : prefectureLocked ? '確定' : '抽選中'}</em></small><strong>{shownPrefecture}</strong></div>
      </div>
      <div className="slot-city-head"><span>CITY / TOWN</span><span>対象 {pool.length.toLocaleString('ja-JP')} 市区町村</span></div>
      <div className="slot-window">
        <div className="slot-selection"/>
        <div className="slot-reel-track" key={`${phase}-${frame.tick}-${cityPool.length}`}>
          {shownCities.map((candidate,index) => <div className={`slot-row ${index===1?'current':''}`} key={`${index}-${candidate.id}`}><small>{candidate.prefecture}</small><strong>{candidate.city}</strong></div>)}
        </div>
        <span className="slot-caret left">▶</span><span className="slot-caret right">◀</span>
      </div>
      <div className="slot-bottom"><span className="slot-live-dot"/>{stageLabel}<span className="slot-bottom-mark">{phase==='landed'?'★':'✦'}</span></div>
    </div>
  </div>;
}
