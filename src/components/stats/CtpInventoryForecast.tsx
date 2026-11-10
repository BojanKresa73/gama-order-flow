import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildPlan, type Consumption } from '@/lib/procurementPlan';
import { Card,CardHeader,CardTitle,CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
export function CtpInventoryForecast(){
 const navigate=useNavigate();
 const {data,isLoading,error}=useQuery({queryKey:['ctp-shared-forecast-v1'],queryFn:async()=>{
  const [f,o,u]=await Promise.all([supabase.from('plate_formats').select('*'),supabase.from('procurement_orders').select('*,procurement_order_items(*)'),supabase.rpc('get_planning_consumption' as any)]);
  if(f.error||o.error||u.error)throw f.error||o.error||u.error;
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Belgrade'}).format(new Date());
  return buildPlan(f.data||[],o.data||[],(u.data||[]) as unknown as Consumption[],today);
 }});
 return <Card><CardHeader><CardTitle>Prognoza lagera</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Osnovni scenario: poslednjih 6 punih meseci, bez ručnih promena potrošnje klijenata. Roba se računa od očekivanog dolaska.</p>{isLoading?<p>Učitavanje…</p>:error?<p className="text-destructive">Prognoza nije učitana.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Format</th><th>Lager</th><th>Na putu</th><th>Prosek/mes.</th><th>Do nestašice</th></tr></thead><tbody>{data?.map(r=><tr className={r.monthly>0&&r.cover<90&&!r.local?'bg-destructive/10 border-b':'border-b'} key={r.id}><td className="py-2">{r.name}{r.local?' (lokalno)':''}</td><td>{r.physicalStock}</td><td>{r.pending}</td><td>{Math.round(r.monthly)}</td><td>{r.monthly>0?Math.floor(r.cover)+' dana':'Nema potrošnje'}</td></tr>)}</tbody></table></div>}<Button variant="outline" onClick={()=>navigate('/nabavka')}>Plan nabavke i scenariji</Button></CardContent></Card>;
}
