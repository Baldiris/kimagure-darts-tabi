import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {Destination} from '@/lib/destinations';
import {coordinatesFor,project,screenPoint,tilesFor} from '@/lib/geo-map';
import {GsiTileLayer} from './gsi-tile-layer';

export function GsiDestinationMap({destination}:{destination:Destination}) {
  const surface=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:640,height:600});
  useLayoutEffect(()=>{
    const element=surface.current;if(!element)return;
    const measure=()=>{const {width,height}=element.getBoundingClientRect();setSize(current=>current.width===width&&current.height===height?current:{width,height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);
  const coordinates=coordinatesFor(destination.id);
  const point=coordinates?project(coordinates):null;
  const view=point?{x:point.x,y:point.y+(size.width>500?size.height*.1:0)/2**11,zoom:11}:null;
  const tiles=useMemo(()=>view?tilesFor(view,size.width,size.height):[],[point?.x,point?.y,size.width,size.height]);
  const hit=point&&view?screenPoint(point,view,size.width,size.height):null;
  return <div ref={surface} className="gsi-destination-map" role="group" aria-label={`${destination.prefecture}${destination.city}の地理院地図。赤い点は自治体の位置データです。`}>
    {point?<GsiTileLayer key={destination.id} tiles={tiles}/>:<p className="gsi-destination-status">位置データを確認できません。地図アプリで町を確認できます。</p>}
    {hit&&<span className="gsi-destination-pin" style={{left:hit.x,top:hit.y}} aria-hidden="true"><i/><strong>{destination.city}</strong></span>}
    <a className="gsi-destination-credit" href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">出典：国土地理院・地理院タイル ↗</a>
  </div>;
}
