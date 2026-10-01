import type {CSSProperties} from 'react';
import type {Destination} from '@/lib/destinations';

type RoulettePhase = 'windup' | 'flying' | 'landed';

const pockets = Array.from({length:24}, (_, index) => index);

function pocketFromSeed(seed: string) {
  return Number.parseInt(seed.slice(0, 8), 16) % pockets.length;
}

export function RouletteWheel({phase, destination, seed, spinMs}: {
  phase: RoulettePhase;
  destination: Destination;
  seed: string;
  spinMs: number;
}) {
  const winner = pocketFromSeed(seed);
  const landed = phase === 'landed';

  return <div
    className={`roulette-stage phase-${phase}`}
    style={{'--winner-angle':`${winner * 15}deg`, '--spin-ms':`${spinMs}ms`} as CSSProperties}
    aria-hidden="true"
  >
    <span className="roulette-kicker">DARTS × ROULETTE</span>
    <div className="roulette-arena">
      <div className="roulette-rim"/>
      <div className="roulette-disk">
        {pockets.map(index => <span
          className={`roulette-pocket ${index === winner ? 'is-winner' : ''}`}
          style={{
            left:`${50 + 43 * Math.sin(index * Math.PI / 12)}%`,
            top:`${50 - 43 * Math.cos(index * Math.PI / 12)}%`,
            '--pocket-angle':`${index * 15}deg`,
          } as CSSProperties}
          key={index}
        >{String(index + 1).padStart(2, '0')}</span>)}
      </div>
      <div className="roulette-hub">
        <span className="roulette-hub-caption">NEXT DESTINATION</span>
        <span className="roulette-hub-symbol">✦</span>
        <strong>{landed ? destination.city : '運命が、回り出す。'}</strong>
        <small>{landed ? destination.prefecture : '球が止まるまで、あと少し。'}</small>
      </div>
      <div className="roulette-ball-orbit"><span className="roulette-ball"/></div>
      <span className="roulette-pointer"/>
      <span className="roulette-impact"/>
    </div>
    <div className="roulette-caption"><span className="roulette-caption-light"/>{landed ? '旅先、決定！' : phase === 'windup' ? '球を放つ…' : 'どのポケットに入る？'}</div>
  </div>;
}
