import municipalities from './municipalities.json';
export type Prefecture={code:number;prefecture:string;region:string};
export type Destination=Prefecture & {id:string;city:string};
export const regions=['北海道・東北','関東','中部','近畿','中国','四国','九州・沖縄'];
const rows=[
['北海道','小樽市',0],['青森県','弘前市',0],['岩手県','盛岡市',0],['宮城県','松島町',0],['秋田県','仙北市',0],['山形県','鶴岡市',0],['福島県','会津若松市',0],
['茨城県','水戸市',1],['栃木県','日光市',1],['群馬県','草津町',1],['埼玉県','川越市',1],['千葉県','銚子市',1],['東京都','青梅市',1],['神奈川県','鎌倉市',1],
['新潟県','村上市',2],['富山県','高岡市',2],['石川県','金沢市',2],['福井県','小浜市',2],['山梨県','富士河口湖町',2],['長野県','松本市',2],['岐阜県','高山市',2],['静岡県','下田市',2],['愛知県','犬山市',2],
['三重県','伊勢市',3],['滋賀県','近江八幡市',3],['京都府','京都市',3],['大阪府','大阪市',3],['兵庫県','豊岡市',3],['奈良県','奈良市',3],['和歌山県','白浜町',3],
['鳥取県','鳥取市',4],['島根県','松江市',4],['岡山県','倉敷市',4],['広島県','尾道市',4],['山口県','萩市',4],
['徳島県','鳴門市',5],['香川県','高松市',5],['愛媛県','松山市',5],['高知県','四万十市',5],
['福岡県','柳川市',6],['佐賀県','唐津市',6],['長崎県','長崎市',6],['熊本県','阿蘇市',6],['大分県','別府市',6],['宮崎県','日南市',6],['鹿児島県','指宿市',6],['沖縄県','那覇市',6]
]as const;
export const prefectures:Prefecture[]=rows.map(([prefecture,,region],i)=>({code:i+1,prefecture,region:regions[region]}));
export const findPrefecture = (code:number) => prefectures.find(prefecture => prefecture.code === code);
export const destinations:Destination[]=municipalities.map(city=>({...findPrefecture(city.code)!,id:city.id,city:city.city}));
const destinationById = new Map(destinations.map(destination => [destination.id,destination]));
export const findDestination = (id:string):Destination|undefined => destinationById.get(id);
// Preserve the actual towns shown by the original 47-choice version.
export function findLegacyDestination(code:number):Destination|undefined {
 const name = rows[code-1]?.[1];
 return name ? destinations.find(destination => destination.code === code && (destination.city === name || destination.city.endsWith(name))) : undefined;
}
export function destinationPool(area:string,prefectureCode:number|null=null){return destinations.filter(d=>(area==='全国'||d.region===area)&&(prefectureCode===null||d.code===prefectureCode))}
export function pickDestination(area:string,random=Math.random,prefectureCode:number|null=null,previousId?:string){
 const pool=destinationPool(area,prefectureCode);
 const candidates=pool.length>1 ? pool.filter(destination => destination.id!==previousId) : pool;
 if(!candidates.length)throw new Error('有効なエリアを選んでください');
 return candidates[Math.min(candidates.length-1,Math.max(0,Math.floor(random()*candidates.length)))];
}
