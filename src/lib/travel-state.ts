import {destinations, regions, type Destination} from './destinations';
export const validAreas = ['全国', ...regions];
export type Area = string;
export type TripRecord = {id: string; code: number; area: Area; drawnAt: number; prefectureCode?:number|null};
export type TravelState = {area: Area; prefectureCode:number|null; history: TripRecord[]; savedCodes: number[]; lastResult: TripRecord | null};
export const findDestination = (code: number): Destination | undefined => destinations.find(destination => destination.code === code);
const defaults = (): TravelState => ({area:'全国', prefectureCode:null, history:[], savedCodes:[], lastResult:null});
function isRecord(value: unknown): value is TripRecord {
 if (!value || typeof value !== 'object') return false;
 const record = value as TripRecord;
 return typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 120 && !!findDestination(record.code) && validAreas.includes(record.area) && Number.isFinite(record.drawnAt) && record.drawnAt >= 0 && (record.prefectureCode == null || (record.prefectureCode === record.code && (record.area === '全国' || findDestination(record.code)!.region === record.area)));
}
export function parseTravelState(raw: string | null): TravelState {
 if (!raw) return defaults();
 try {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object') return defaults();
  const history: TripRecord[] = Array.isArray(value.history) ? value.history.filter(isRecord).filter((record: TripRecord, index: number, records: TripRecord[]) => records.findIndex(candidate => candidate.id === record.id) === index).slice(0, 30) : [];
  const savedCodes: number[] = Array.isArray(value.savedCodes) ? [...new Set<number>(value.savedCodes.filter((code: unknown) => typeof code === 'number' && !!findDestination(code)))] : [];
  const area = validAreas.includes(value.area) ? value.area : '全国';
  const selected = typeof value.prefectureCode === 'number' ? findDestination(value.prefectureCode) : undefined;
  return {area, prefectureCode:selected && (area === '全国' || selected.region === area) ? selected.code : null, history, savedCodes, lastResult:isRecord(value.lastResult) ? value.lastResult : null};
 } catch {return defaults();}
}
export function loadTravelState(): TravelState {
 try {return parseTravelState(localStorage.getItem('kimagure-darts-travel-v2'));}
 catch {return defaults();}
}

export function resolveRoute(hash: string, state: TravelState): {screen:'explore' | 'result' | 'history'; record?: TripRecord} {
 if (hash === '#explore') return {screen:'explore'};
 if (hash === '#history') return {screen:'history'};
 if (hash.startsWith('#trip=')) {
  const id = hash.slice(6);
  const record = state.history.find(item => item.id === id) ?? (state.lastResult?.id === id ? state.lastResult : undefined);
  if (record) return {screen:'result', record};
  if (/^saved-\d+$/.test(id)) {
   const code = Number(id.slice(6)), destination = findDestination(code);
   if (destination && state.savedCodes.includes(code)) return {screen:'result', record:{id, code, area:destination.region, drawnAt:0}};
  }
  return {screen:'explore'};
 }
 return state.lastResult ? {screen:'result', record:state.lastResult} : {screen:'explore'};
}
