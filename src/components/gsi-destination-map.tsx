import {useEffect,useMemo,useState} from 'react';
import type {Destination} from '@/lib/destinations';

type Coordinates = {points:Record<string,[number,number]>};
let coordinateRequest:Promise<Coordinates>|undefined;
function loadCoordinates() {
  coordinateRequest ??= fetch('./competition/ren/coordinates.json').then(response => {
    if (!response.ok) throw new Error('位置データを読み込めませんでした');
    return response.json() as Promise<Coordinates>;
  }).catch(error => {coordinateRequest=undefined;throw error;});
  return coordinateRequest;
}

const zoom=11;
const tileSize=256;
const scale=2**zoom;
function pointOnTiles([latitude,longitude]:[number,number]) {
  const safeLatitude=Math.max(-85,Math.min(85,latitude));
  const sin=Math.sin(safeLatitude*Math.PI/180);
  return {x:(longitude+180)/360*scale*tileSize,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale*tileSize};
}

export function GsiDestinationMap({destination}:{destination:Destination}) {
  const [location,setLocation]=useState<{id:string;point:[number,number]}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(() => {
    let active=true;
    setFailed(false);
    loadCoordinates().then(data => {
      if (!active) return;
      const point=data.points[destination.id];
      if (point) setLocation({id:destination.id,point});
      else setFailed(true);
    }).catch(() => {if (active) setFailed(true)});
    return () => {active=false};
  },[destination.id]);
  const tiles=useMemo(() => {
    if (!location || location.id!==destination.id) return [];
    const center=pointOnTiles(location.point);
    const startX=Math.floor(center.x/tileSize),startY=Math.floor(center.y/tileSize);
    return Array.from({length:25},(_,index) => {
      const x=startX+index%5-2,y=startY+Math.floor(index/5)-2;
      return {x,y,left:x*tileSize-center.x,top:y*tileSize-center.y};
    }).filter(tile=>tile.x>=0&&tile.y>=0&&tile.x<scale&&tile.y<scale);
  },[location,destination.id]);
  return <div className="gsi-destination-map" role="img" aria-label={`${destination.prefecture}${destination.city}の地理院地図。赤い点が着弾した町の位置データです。`}>
    {tiles.map(tile=><img key={`${tile.x}-${tile.y}`} src={`https://cyberjapandata.gsi.go.jp/xyz/pale/${zoom}/${tile.x}/${tile.y}.png`} alt="" draggable="false" style={{left:`calc(50% + ${tile.left}px)`,top:`calc(50% + ${tile.top}px)`}}/>)}
    {tiles.length>0&&<span className="gsi-destination-pin" aria-hidden="true"><i/><strong>{destination.city}</strong></span>}
    {!tiles.length&&<p className="gsi-destination-status">{failed?'地図を読み込めませんでした。下の地図アプリから町を確認できます。':'町の地図を読み込んでいます…'}</p>}
    <a className="gsi-destination-credit" href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">出典：国土地理院・地理院タイル ↗</a>
  </div>;
}
