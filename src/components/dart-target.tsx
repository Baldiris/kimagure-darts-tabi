import {ArrowUpRight, Crosshair} from 'lucide-react';
import type {Destination} from '@/lib/destinations';

type Props = {
  phase:'ready'|'flying'|'landed';
  destination?:Destination;
  pool:Destination[];
  scopeName:string;
  onThrow:()=>void;
};

function Dart({className=''}:{className?:string}) {
  return <svg className={className} viewBox="0 0 162 62" aria-hidden="true" focusable="false">
    <path d="M3 31 35 26 35 36Z" fill="#e9e4d5"/>
    <path d="M33 27 115 27 115 35 33 35Z" fill="#e5ae68" stroke="#66382f" strokeWidth="2"/>
    <path d="M41 26v10m7-10v10m7-10v10m7-10v10" stroke="#56332c" strokeWidth="2"/>
    <path d="M111 27 139 27 139 35 111 35Z" fill="#262d37"/>
    <path d="M128 28 148 4 157 7 151 31 157 55 148 58 128 34Z" fill="#ec5940" stroke="#8b3029" strokeWidth="2"/>
    <path d="M134 31h21" stroke="#8b3029" strokeWidth="2"/>
  </svg>;
}

export function DartTarget({phase,destination,pool,scopeName,onThrow}:Props) {
  const index=destination ? Math.max(0,pool.findIndex(item=>item.id===destination.id)) : 0;
  // Every candidate has a stable, distinct point on this abstract board.
  const angle=index*2.399963229728653;
  const radius=destination ? 5+Math.sqrt((index+.5)/Math.max(1,pool.length))*26 : 0;
  const x=(50+Math.cos(angle)*radius).toFixed(2), y=(50+Math.sin(angle)*radius).toFixed(2);
  return <div className={`dart-stage ${phase}`}>
    <div className="dart-stage-top"><span><Crosshair size={17}/> TRAVEL DARTS</span><span>JAPAN / 47 PREFECTURES</span></div>
    <p className="board-intro">次の行き先は、<strong>一投で。</strong></p>
    <div className="target-scene">
      <button type="button" className="dart-target-button" onClick={onThrow} disabled={phase!=='ready'} aria-label={`${scopeName}の${pool.length}市区町村へダーツを投げる`}>
        <span className="dart-board" aria-hidden="true"><span className="board-number twelve">20</span><span className="board-number three">06</span><span className="board-number six">03</span><span className="board-number nine">11</span><span className="board-ring outer"/><span className="board-ring inner"/><span className="board-bull"/>
          <span className="board-cross horizontal"/><span className="board-cross vertical"/>
          <span className="impact-mark" style={{left:`${x}%`,top:`${y}%`}}/>
          <span className="dart-flight" style={{left:`${x}%`,top:`${y}%`}}><Dart/></span>
        </span>
        <span className="target-prompt" aria-hidden="true">{phase==='ready'?'ここをタップして投げる':phase==='flying'?'ダーツが飛んでいます…':'命中！'}</span>
      </button>
      <span className="board-orbit orbit-one"/><span className="board-orbit orbit-two"/>
    </div>
    <div className="board-status" aria-live="off"><div><span className="status-pulse"/><span>{phase==='ready'?'READY TO THROW':phase==='flying'?'DART IN FLIGHT':'DESTINATION FOUND'}</span></div><strong>{phase==='landed'&&destination?`${destination.prefecture}  ${destination.city}`:`${scopeName} / ${pool.length.toLocaleString('ja-JP')} の町`}</strong></div>
    <p className="board-footnote">{phase==='ready'?'盤面をタップ、または下のボタンから投げられます。':phase==='flying'?'着弾したら、当たった町を発表します。':'旅先の地図へ進みます。'}<ArrowUpRight size={13}/></p>
  </div>;
}
