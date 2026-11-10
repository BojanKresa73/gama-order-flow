import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildPlan, norm, type Consumption } from '@/lib/procurementPlan';
import { procurementTotals } from '@/lib/procurementMoney';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
const key='gama-procurement-plan-v1';
const initial={budget:25000,price:2.82,transport:700,rate:'',lead:90,cycle:90,safety:30,biro:true,factors:{} as Record<string,number>,qty:{'745x605':15000,'724x615':1000,'1060x795':0} as Record<string,number>};
export function ChinaOrderRecommendation({plateFormats,orders}:{plateFormats:any[];orders:any[]}) {
 const [settings,setSettings]=useState(initial);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved)setSettings({...initial,...JSON.parse(saved)});}catch{}setLoaded(true);},[]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(key,JSON.stringify(settings));}catch{}},[settings,loaded]);
 const {data=[],isLoading,error}=useQuery({queryKey:['planning-consumption-v1'],queryFn:async()=>{const r=await supabase.rpc('get_planning_consumption' as any);if(r.error)throw r.error;return (r.data||[]) as unknown as Consumption[];}});
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Belgrade'}).format(new Date());
 const factors=useMemo(()=>Object.fromEntries(data.map(u=>[u.client_id,settings.factors[u.client_id]??(/slu[zž]beni.*glasnik/i.test(u.client_name)?0:1)])),[data,settings.factors]);
 const rows=useMemo(()=>buildPlan(plateFormats,orders,data,today,factors,settings.biro,settings.lead,settings.cycle,settings.safety),[plateFormats,orders,data,today,settings,factors]);
 const clients=useMemo(()=>Array.from(new Map(data.map(u=>[u.client_id,u.client_name])).entries()).sort((a,b)=>a[1].localeCompare(b[1])),[data]);
 const imports=rows.filter(r=>!r.local);
 const goods=imports.reduce((s,r)=>s+(settings.qty[norm(r.name)]||0)*r.area*settings.price,0);
 const money=procurementTotals(goods,settings.transport,Number(settings.rate)||null);
 const qty=imports.reduce((s,r)=>s+(settings.qty[norm(r.name)]||0),0);
 const setNumber=(field:string,value:string)=>setSettings(s=>({...s,[field]:Math.max(field==='lead'?1:0,Number(value)||0)}));
 if(isLoading)return <Card className="p-6">Učitavanje potrošnje…</Card>;
 if(error)return <Card className="p-6 text-destructive">Prognoza nije učitana: {(error as Error).message}</Card>;
 return <Card><CardHeader><CardTitle>Plan nabavke — budžet i potrošnja klijenata</CardTitle></CardHeader><CardContent className="space-y-5">
  <p className="text-sm text-muted-foreground">Prosek poslednjih 6 punih kalendarskih meseci, uključujući mesece bez potrošnje. Pošiljke produžavaju pokrivenost tek na datum dolaska. Plan se čuva u ovom pregledaču; nije porudžbina dobavljaču.</p>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['budget','Budžet USD'],['price','Procena cene USD/m²'],['transport','Transport i troškovi EUR'],['lead','Rok dolaska (dana)'],['cycle','Pokriće posle dolaska (dana)'],['safety','Rezerva (dana)']].map(([k,l])=><label key={k} className="text-sm">{l}<Input type="number" min={k==='lead'?1:0} step={k==='price'?'0.01':'1'} value={(settings as any)[k]} onChange={e=>setNumber(k,e.target.value)}/></label>)}<label className="text-sm">1 USD = EUR (potvrđen kurs)<Input type="number" min="0.0001" step="0.0001" placeholder="Unesite kurs" value={settings.rate} onChange={e=>setSettings(s=>({...s,rate:e.target.value}))}/></label></div>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.biro} onChange={e=>setSettings(s=>({...s,biro:e.target.checked}))}/>Koristi višak fizičkog lagera 1050×795 za Birograf umesto 1060×795 (jedna ploča za jednu)</label>
  <details className="border rounded p-3"><summary className="cursor-pointer">Scenario potrošnje po klijentu — 100% je dosadašnji prosek</summary><p className="text-sm text-muted-foreground my-2">Službeni glasnik je u početnom scenariju na 0%; po potrebi promenite procenat. Za mogući prestanak saradnje postavite 0%. Ovo menja samo prognozu, ne istorijske naloge.</p><div className="grid md:grid-cols-3 gap-3">{clients.map(([id,name])=><label key={id} className="text-sm">{name}<Input type="number" min="0" max="200" step="10" value={Math.round((factors[id]??1)*100)} onChange={e=>setSettings(s=>({...s,factors:{...s.factors,[id]:Math.max(0,Math.min(200,Number(e.target.value)||0))/100}}))}/></label>)}</div></details>
  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b">{['Format','Lager','Na putu','Prosek/mes.','Do nestašice','Predlog','Moj plan','USD'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{imports.map(r=><tr key={r.id} className={r.cover<settings.lead?'bg-destructive/10 border-b':'border-b'}><td className="p-2 font-medium">{r.name}{r.substitute>0&&<div className="text-xs">Birograf zamena: {Math.round(r.substitute)}/mes.</div>}</td><td className="p-2">{r.physicalStock}</td><td className="p-2">{r.pending}{r.uncertain>0&&<div className="text-xs text-destructive">{r.uncertain} bez pouzdanog roka</div>}</td><td className="p-2">{Math.round(r.monthly)}</td><td className="p-2">{r.monthly>0?Math.floor(r.cover)+' dana':'Nema potrošnje'}</td><td className="p-2">{r.recommended}</td><td className="p-2"><Input aria-label={'Plan '+r.name} className="w-28" type="number" min="0" step="100" value={settings.qty[norm(r.name)]||0} onChange={e=>setSettings(s=>({...s,qty:{...s.qty,[norm(r.name)]:Math.max(0,Math.floor(Number(e.target.value)||0))}}))}/></td><td className="p-2">{((settings.qty[norm(r.name)]||0)*r.area*settings.price).toLocaleString('sr-RS',{maximumFractionDigits:2})}</td></tr>)}</tbody></table></div>
  <p className="text-sm">B3 (450×370 i 510×400): lokalna nabavka. Potrošnja 1030×785 uključena je u 1030×790; 730×605 i 740×605 u 745×605. Zamena za Birograf ograničena je raspoloživim viškom 1050×795, bez dvostrukog računanja iste zalihe.</p>
  <div className="border rounded p-4 space-y-1"><strong>{qty.toLocaleString('sr-RS')} ploča · roba {goods.toLocaleString('sr-RS',{maximumFractionDigits:2})} USD</strong><div>Troškovi: {settings.transport} EUR</div>{money.totalUsd==null?<p className="text-orange-700">Unesite potvrđen kurs da bi se proverio ukupan budžet.</p>:<p className={money.totalUsd>settings.budget?'text-destructive font-bold':'font-bold'}>Ukupno {money.totalUsd.toLocaleString('sr-RS',{maximumFractionDigits:2})} USD · {money.totalUsd>settings.budget?'Prekoračenje':'Preostaje'} {Math.abs(settings.budget-money.totalUsd).toLocaleString('sr-RS',{maximumFractionDigits:2})} USD</p>}<p className="text-xs text-muted-foreground">Procena: proveriti ponudu dobavljača, dodatne uvozne troškove i PDV.</p></div>
  <div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={()=>setSettings(s=>({...s,qty:Object.fromEntries(imports.map(r=>[norm(r.name),r.recommended]))}))}>Preuzmi količine iz predloga</Button><Button onClick={async()=>{try{await navigator.clipboard.writeText('Format\tKoličina\n'+imports.filter(r=>(settings.qty[norm(r.name)]||0)>0).map(r=>r.name+'\t'+settings.qty[norm(r.name)]).join('\n'));toast.success('Plan kopiran');}catch{toast.error('Kopiranje nije uspelo');}}}>Kopiraj moj plan</Button></div>
 </CardContent></Card>;
}
