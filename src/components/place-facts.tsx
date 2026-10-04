import {ExternalLink} from 'lucide-react';
import type {Destination} from '@/lib/destinations';
import {placeFactCards} from '@/lib/place-facts';

export default function PlaceFacts({destination}:{destination:Destination}) {
  const cards = placeFactCards(destination.id);
  if (!cards.length) return null; // Older saved destinations may now be held.
  return <aside className="destination-facts" aria-label={`${destination.city}の特徴`}>
    <span className="destination-facts-label">FIELD NOTES / 国の公開資料から</span>
    <h3>この町の手掛かり</h3>
    <ul>{cards.map(fact=><li key={fact.title}><span>{fact.title}</span><p>{fact.body}</p><a href={fact.url} target="_blank" rel="noreferrer">{fact.source}の資料 <ExternalLink size={12}/></a></li>)}</ul>
    <small>資料の基準時点の情報です。現地の営業・交通・立入条件は別途ご確認ください。</small>
  </aside>;
}
