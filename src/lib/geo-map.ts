import data from '../../public/competition/ren/coordinates.json';
import type {Destination} from './destinations';

export type GeoPoint = {x:number;y:number};
export type GeoView = GeoPoint & {zoom:number};
const points = data.points as Record<string,number[]>;
export function coordinatesFor(id:string):[number,number]|undefined {const point=points[id];return point?[point[0],point[1]]:undefined;}
export function project([lat,lng]:[number,number]):GeoPoint {
  const radians=Math.max(-85,Math.min(85,lat))*Math.PI/180;
  return {x:(lng+180)/360*256,y:(1-Math.asinh(Math.tan(radians))/Math.PI)/2*256};
}
export function fitView(pool:Destination[],width:number,height:number):GeoView {
  const locations=pool.map(d=>coordinatesFor(d.id)).filter((p):p is [number,number]=>Boolean(p)).map(project);
  const xs=locations.map(p=>p.x),ys=locations.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const zoom=Math.max(3,Math.min(12,Math.log2(Math.min(Math.max(140,width-150)/(maxX-minX||.01),Math.max(140,height-170)/(maxY-minY||.01)))));
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,zoom};
}
export function screenPoint(point:GeoPoint,view:GeoView,width:number,height:number) {return {x:width/2+(point.x-view.x)*2**view.zoom,y:height/2+(point.y-view.y)*2**view.zoom};}
export function tilesFor(view:GeoView,width:number,height:number) {
  const zoom=Math.max(5,Math.min(18,Math.floor(view.zoom))),scale=2**(view.zoom-zoom),size=256*scale;
  const centerX=view.x*2**zoom,centerY=view.y*2**zoom;
  const firstX=Math.floor((centerX-width/(2*scale))/256),lastX=Math.floor((centerX+width/(2*scale))/256);
  const firstY=Math.floor((centerY-height/(2*scale))/256),lastY=Math.floor((centerY+height/(2*scale))/256);
  const tiles=[];
  for(let x=firstX;x<=lastX;x++)for(let y=firstY;y<=lastY;y++)if(x>=0&&y>=0&&x<2**zoom&&y<2**zoom)tiles.push({x,y,zoom,size,left:width/2+(x*256-centerX)*scale,top:height/2+(y*256-centerY)*scale});
  return tiles;
}
