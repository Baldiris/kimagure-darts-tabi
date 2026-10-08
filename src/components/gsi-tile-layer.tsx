import {useState} from 'react';
import type {tilesFor} from '@/lib/geo-map';

type Tile=ReturnType<typeof tilesFor>[number];
const keyFor=(tile:Tile)=>`${tile.zoom}-${tile.x}-${tile.y}`;

export function GsiTileLayer({tiles}:{tiles:Tile[]}) {
  const [status,setStatus]=useState<Record<string,'loaded'|'failed'>>({});
  const loaded=tiles.filter(tile=>status[keyFor(tile)]==='loaded').length;
  const failed=tiles.filter(tile=>status[keyFor(tile)]==='failed').length;
  const finished=loaded+failed===tiles.length;
  const record=(key:string,value:'loaded'|'failed')=>setStatus(current=>({...current,[key]:value}));
  return <>
    <div className="gsi-tile-layer" aria-hidden="true">{tiles.map(tile=>{
      const key=keyFor(tile);
      return <img key={key} src={`https://cyberjapandata.gsi.go.jp/xyz/pale/${tile.zoom}/${tile.x}/${tile.y}.png`} alt="" draggable="false" style={{left:tile.left,top:tile.top,width:tile.size+.5,height:tile.size+.5,visibility:status[key]==='failed'?'hidden':undefined}} onLoad={()=>record(key,'loaded')} onError={()=>record(key,'failed')}/>;
    })}</div>
    {loaded===0&&<p className="map-tile-status" role="status">{finished?'地図の画像を取得できませんでした。町の位置は確認できます。':'地理院地図を読み込んでいます…'}</p>}
    {loaded>0&&failed>0&&finished&&<p className="map-partial-status">一部の地図を取得できませんでした。</p>}
  </>;
}
