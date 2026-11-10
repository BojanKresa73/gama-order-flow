import { daysOfCover, pendingForFormat } from './plateForecast';
export type Consumption = { format_id: string; client_id: string; client_name: string; month: string; total: number };
export const norm = (s: string) => s.toLowerCase().replace(/×/g,'x').replace(/\s/g,'');
const replacements: Record<string,string> = {'1030x785':'1030x790','730x605':'745x605','740x605':'745x605'};
export const localFormats = new Set(['450x370','510x400']);
export function sixMonths(today: string) {
 const [y,m]=today.slice(0,7).split('-').map(Number);
 return Array.from({length:6},(_,i)=>new Date(Date.UTC(y,m-2-i,1)).toISOString().slice(0,7));
}
export function buildPlan(formats: any[], orders: any[], usage: Consumption[], today: string, factors: Record<string,number>={}, biroFallback=false, lead=90, cycle=90, safety=30) {
 const months=sixMonths(today); const targetDays=lead+cycle+safety;
 const byId=new Map(formats.map(f=>[f.id,f]));
 const active=formats.filter(f=>!replacements[norm(f.format_name)]);
 const demand=new Map<string,number>(); const biro=new Map<string,number>();
 for(const u of usage) {
  if(!months.includes(u.month.slice(0,7))) continue;
  const f=byId.get(u.format_id); if(!f) continue;
  const name=replacements[norm(f.format_name)] || norm(f.format_name);
  const factor=Math.max(0,Math.min(2, factors[u.client_id] ?? 1));
  const monthly=Number(u.total)*factor/6;
  demand.set(name,(demand.get(name)||0)+monthly);
  if(/birograf/i.test(u.client_name)) biro.set(name,(biro.get(name)||0)+monthly);
 }
 let substitute=0;
 if(biroFallback) {
  const donor=formats.find(f=>norm(f.format_name)==='1050x795');
  const ownNeed=(demand.get('1050x795')||0)/30*targetDays;
  const spare=Math.max(0,(donor?.current_stock||0)-ownNeed);
  substitute=Math.min(biro.get('1060x795')||0,spare/targetDays*30);
  demand.set('1060x795',Math.max(0,(demand.get('1060x795')||0)-substitute));
  demand.set('1050x795',(demand.get('1050x795')||0)+substitute);
 }
 return active.map(f=>{
  const name=norm(f.format_name); const monthly=demand.get(name)||0;
  // Smaller retired stock cannot cover larger jobs; use it only against matching retired demand.
  const old=formats.filter(x=>replacements[norm(x.format_name)]===name);
  let stock=Math.max(0,Number(f.current_stock)||0);
  for(const x of old) {
   const retiredDemand=usage.filter(u=>u.format_id===x.id && months.includes(u.month.slice(0,7))).reduce((s,u)=>s+Number(u.total)*Math.max(0,Math.min(2,factors[u.client_id]??1)),0)/6;
   stock+=Math.min(Math.max(0,x.current_stock||0),retiredDemand*targetDays/30);
  }
  const pending=pendingForFormat(orders,f.id,today);
  const dated=pending.arrivals.filter(a=>a.inDays<=targetDays).reduce((s,a)=>s+a.qty,0);
  const cover=daysOfCover(stock,monthly/30,pending.arrivals);
  const raw=Math.max(0,monthly/30*targetDays-stock-dated);
  const dims=name.match(/^(\d+)x(\d+)$/);
  return {id:f.id,name:f.format_name,stock,physicalStock:f.current_stock,monthly,pending:pending.total,uncertain:pending.uncertain,cover,
   recommended:Math.ceil(raw/100)*100,area:dims?Number(dims[1])*Number(dims[2])/1e6:0,
   local:localFormats.has(name),substitute:name==='1050x795'||name==='1060x795'?substitute:0};
 }).sort((a,b)=>a.cover-b.cover);
}
