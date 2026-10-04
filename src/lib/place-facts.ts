import data from '../../public/competition/data/place-facts.json';

type Sight = {kind:'nature'|'district'|'park'|'heritage';name:string;url:string};
type Fact = {area:[number,number];crop?:[string,number,number];sight?:Sight};
export type PlaceFactCard = {title:string;body:string;source:string;url:string};
const facts = data.places as unknown as Record<string,Fact>;

export function placeFactCards(id:string):PlaceFactCard[] {
  const fact = facts[id];
  if (!fact) return [];
  const cards:PlaceFactCard[] = [];
  if (fact.sight) {
    const {kind,name,url}=fact.sight;
    const copy:{[K in Sight['kind']]:[string,string,string]}={
      nature:['世界自然遺産',`環境省の世界自然遺産「${name}」の構成地域です。`,'環境省'],
      district:['歴史の町並み',`文化庁が「${name}」を重要伝統的建造物群保存地区に選定しています。`,'文化庁'],
      park:['国立公園',`環境省が示す「${name}」の関係市町村に含まれます。`,'環境省'],
      heritage:['日本遺産','文化庁の日本遺産ポータルに、この町の構成文化財が掲載されています。','文化庁']
    };
    cards.push({title:copy[kind][0],body:copy[kind][1],source:copy[kind][2],url});
  }
  if (fact.crop) {
    const [product,amount,rank]=fact.crop;
    const value=(amount/10).toLocaleString('ja-JP',{maximumFractionDigits:1});
    cards.push({title:'農業の一面',body:`2024年の農業産出額（推計）では、${product}が${value}億円${rank<=100?`・全国${rank}位`:''}。`,source:'農林水産省',url:data.sourceUrls.agriculture});
  }
  const [area,habitable]=fact.area;
  cards.push({title:'町のスケール',body:`2024年の総面積は${area.toLocaleString('ja-JP')}km²、可住地面積は${habitable.toLocaleString('ja-JP')}km²。`,source:'総務省統計局',url:data.sourceUrls.area});
  return cards;
}
