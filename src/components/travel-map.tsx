import {useEffect, useMemo, useState} from 'react';
import {type Destination, findPrefecture} from '@/lib/destinations';
import {regionalAssets} from '@/lib/region-map-assets';
import {prefectureAssets} from '@/lib/prefecture-map-assets';
import type {Area} from '@/lib/travel-state';

const requests = new Map<string,Promise<string>>();
const assetFor = (area:Area, code:number|null) => code && prefectureAssets[code] || regionalAssets[area] || './assets/japan.svg';
export function preloadTravelMap(area:Area, code:number|null = null) {
  const asset = assetFor(area,code);
  if (!requests.has(asset)) requests.set(asset,fetch(asset).then(response => {
    if (!response.ok) throw new Error('地図を読み込めませんでした');
    return response.text();
  }).catch(error => {requests.delete(asset);throw error;}));
  return requests.get(asset)!;
}

type Label = {code:number;name:string;x:number;y:number};
const offsets:Record<string,Record<number,[number,number]>> = {
  '北海道・東北':{3:[64,0],4:[76,0],5:[-64,0],6:[-64,0]},
  '中部':{17:[-28,0]},
  '九州・沖縄':{41:[-65,-15],42:[-55,20],47:[0,-75]}
};

export function TravelMap({area,prefectureCode,destination}: {
  area:Area;prefectureCode:number|null;destination:Destination|null;
}) {
  const asset = assetFor(area,prefectureCode);
  const [loaded,setLoaded] = useState({asset:'',markup:'',error:false});
  const single = prefectureCode !== null;
  const mapName = single ? findPrefecture(prefectureCode)?.prefecture ?? area : area;
  useEffect(() => {
    let alive = true;
    preloadTravelMap(area,prefectureCode).then(markup => {
      if (alive) setLoaded({asset,markup,error:false});
    }).catch(() => {if (alive) setLoaded({asset,markup:'',error:true});});
    return () => {alive=false;};
  },[area,prefectureCode,asset]);
  const {markup,labels} = useMemo(() => {
    if (loaded.asset !== asset || !loaded.markup) return {markup:'',labels:[] as Label[]};
    const doc = new DOMParser().parseFromString(loaded.markup,'image/svg+xml');
    doc.querySelectorAll<SVGElement>('.prefecture').forEach(element => {
      const code = Number(element.dataset.code);
      element.style.fill = destination?.code === code ? '#ef704f' : '#9bbbd9';
      element.style.stroke = '#f6f4ea';
      element.style.strokeWidth = single || area !== '全国' ? '1.5' : '2.5';
    });
    const labels:Label[] = single || area !== '全国' ? Array.from(doc.querySelectorAll<SVGElement>('[data-anchor-x]')).map(element => {
      const code = Number(element.dataset.code), shift = offsets[area]?.[code] ?? [0,0];
      return {code,name:single ? findPrefecture(code)!.prefecture : findPrefecture(code)!.prefecture.replace(/[都府県]$/,''),x:Number(element.dataset.anchorX)+shift[0],y:Math.max(65,Number(element.dataset.anchorY)+shift[1])};
    }) : [];
    return {markup:new XMLSerializer().serializeToString(doc.documentElement),labels};
  },[loaded,asset,destination?.code,single,area]);
  return <div className={`travel-map ${single?'single-map':'regional-map'}`} role="img" aria-label={`${mapName}の地図。${destination ? `${destination.city}が選ばれました。` : '抽選対象の地域を表示しています。'}一部の離島は省略されています。`}>
    {markup ? <><div className="map-svg" aria-hidden="true" dangerouslySetInnerHTML={{__html:markup}}/>{labels.length>0 && <svg className="map-labels" viewBox="0 0 1000 1000" aria-hidden="true">{labels.map(label => <text key={label.code} x={label.x} y={label.y} className={destination?.code===label.code?'selected':''}>{label.name}</text>)}</svg>}</> : <p className="map-placeholder">{loaded.asset === asset && loaded.error ? '地図を表示できませんでした' : '地図を読み込み中…'}</p>}
  </div>;
}
