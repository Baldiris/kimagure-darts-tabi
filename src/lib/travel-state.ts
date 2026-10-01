import {regions, findDestination, findPrefecture, findLegacyDestination} from './destinations';
export {findDestination, findPrefecture};
export const validAreas = ['全国', ...regions];
export type Area = string;
export type TripRecord = {id:string; code:number; destinationId:string; area:Area; drawnAt:number; prefectureCode?:number|null};
export type TravelState = {area:Area; prefectureCode:number|null; history:TripRecord[]; savedDestinationIds:string[]; lastResult:TripRecord|null};
export const travelStorageKey = 'kimagure-darts-travel-v3';
const defaults = ():TravelState => ({area:'全国',prefectureCode:null,history:[],savedDestinationIds:[],lastResult:null});
function parseRecord(value:unknown):TripRecord|null {
 if (!value || typeof value !== 'object') return null;
 const record = value as Record<string,unknown>;
 const destination = typeof record.destinationId === 'string' ? findDestination(record.destinationId) : record.destinationId === undefined && typeof record.code === 'number' ? findLegacyDestination(record.code) : undefined;
 if (!destination || record.code !== destination.code || typeof record.id !== 'string' || !record.id.length || record.id.length>120 || typeof record.area !== 'string' || !validAreas.includes(record.area) || (record.area !== '全国' && record.area !== destination.region) || typeof record.drawnAt !== 'number' || !Number.isFinite(record.drawnAt) || record.drawnAt<0) return null;
 if (record.prefectureCode != null && record.prefectureCode !== destination.code) return null;
 return {id:record.id,code:destination.code,destinationId:destination.id,area:record.area,drawnAt:record.drawnAt,prefectureCode:record.prefectureCode == null ? null : destination.code};
}
export function parseTravelState(raw:string|null):TravelState {
 if (!raw) return defaults();
 try {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object') return defaults();
  const parsed:TripRecord[] = Array.isArray(value.history) ? value.history.map(parseRecord).filter((record:TripRecord|null):record is TripRecord => !!record) : [];
  const history = parsed.filter((record,index,records)=>records.findIndex(candidate=>candidate.id===record.id)===index).slice(0,30);
  const ids = Array.isArray(value.savedDestinationIds) ? value.savedDestinationIds.filter((id:unknown):id is string=>typeof id==='string' && !!findDestination(id)) : Array.isArray(value.savedCodes) ? value.savedCodes.flatMap((code:unknown)=>typeof code==='number' && findLegacyDestination(code) ? [findLegacyDestination(code)!.id] : []) : [];
  const area = validAreas.includes(value.area) ? value.area : '全国';
  const selected = typeof value.prefectureCode === 'number' ? findPrefecture(value.prefectureCode) : undefined;
  return {area,prefectureCode:selected && (area==='全国' || selected.region===area) ? selected.code : null,history,savedDestinationIds:[...new Set<string>(ids)],lastResult:parseRecord(value.lastResult)};
 } catch {return defaults();}
}
export function loadTravelState():TravelState {
 try {return parseTravelState(localStorage.getItem(travelStorageKey) ?? localStorage.getItem('kimagure-darts-travel-v2'));}
 catch {return defaults();}
}
export function resolveRoute(hash:string,state:TravelState):{screen:'explore'|'result'|'history';record?:TripRecord} {
 if (hash==='#explore') return {screen:'explore'};
 if (hash==='#history') return {screen:'history'};
 if (hash.startsWith('#trip=')) {
  const id = hash.slice(6);
  const record = state.history.find(item=>item.id===id) ?? (state.lastResult?.id===id ? state.lastResult : undefined);
  if (record) return {screen:'result',record};
  if (/^saved-\d+$/.test(id)) {
   const savedId = id.slice(6);
   const destination = savedId.length===5 ? findDestination(savedId) : findLegacyDestination(Number(savedId));
   if (destination && state.savedDestinationIds.includes(destination.id)) return {screen:'result',record:{id,code:destination.code,destinationId:destination.id,area:destination.region,drawnAt:0}};
  }
  return {screen:'explore'};
 }
 return state.lastResult ? {screen:'result',record:state.lastResult} : {screen:'explore'};
}
