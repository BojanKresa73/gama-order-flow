import {describe,it,expect} from 'vitest';
import {buildPlan,sixMonths} from '../procurementPlan';
import {procurementTotals} from '../procurementMoney';
import {syncFreshness} from '../syncFreshness';
const formats=[{id:'a',format_name:'745×605',current_stock:100},{id:'b',format_name:'1060x795',current_stock:100},{id:'c',format_name:'1050x795',current_stock:700}];
const usage=[{format_id:'a',client_id:'1',client_name:'Kupac',month:'2026-10',total:600}];
describe('plan nabavke',()=>{
 it('uključuje nulte mesece i prelaz godine',()=>{expect(sixMonths('2026-02-10')[0]).toBe('2026-01');expect(sixMonths('2026-02-10')[5]).toBe('2025-08');expect(buildPlan(formats,[],usage,'2026-11-10').find(r=>r.id==='a')?.monthly).toBe(100);});
 it('januarska roba ne pokriva decembarsku nestašicu',()=>{const orders=[{status:'ordered',expected_arrival_date:'2027-01-19',procurement_order_items:[{plate_format_id:'a',quantity:15000}]}];expect(buildPlan(formats,orders,usage,'2026-11-10').find(r=>r.id==='a')?.cover).toBe(30);});
 it('0% klijenta ne briše istoriju i uklanja buduću potrošnju',()=>{expect(buildPlan(formats,[],usage,'2026-11-10',{'1':0}).find(r=>r.id==='a')?.monthly).toBe(0);expect(usage[0].total).toBe(600);});
 it('zamena Birografa ne duplira lager i ne prelazi višak',()=>{const u=[{format_id:'b',client_id:'2',client_name:'Birograf',month:'2026-10',total:6000}];const rows=buildPlan(formats,[],u,'2026-11-10',{},true);expect(rows.find(r=>r.id==='b')?.monthly).toBe(900);expect(rows.find(r=>r.id==='c')?.monthly).toBe(100);expect(rows.reduce((s,r)=>s+r.physicalStock,0)).toBe(900);});
 it('nepoznat datum pošiljke nije raspoloživa zaliha',()=>{const r=buildPlan(formats,[{status:'ordered',expected_arrival_date:null,procurement_order_items:[{plate_format_id:'a',quantity:5000}]}],usage,'2026-11-10').find(r=>r.id==='a')!;expect(r.uncertain).toBe(5000);expect(r.recommended).toBe(600);});
});
describe('valute',()=>{
 it('pretvara EUR troškove pre sabiranja USD',()=>expect(procurementTotals(1000,100,0.8)).toEqual({totalUsd:1125,totalEur:900}));
 it('ne izmišlja kurs',()=>expect(procurementTotals(1000,100,null).totalUsd).toBeNull());
 it('bez EUR troškova može prikazati USD bez kursa',()=>expect(procurementTotals(1000,0,null).totalUsd).toBe(1000));
});
describe('ažurnost',()=>{
 it('jedan svež izvor ne sakriva ostale stare izvore',()=>{const entities=['customers','accounts','issuedinvoices','receivedinvoices','journals_2026','journal_details','link_vat'];const rows=entities.map(entity=>({entity,status:'done',updated_at:entity==='link_vat'?'2026-11-10T08:00:00Z':'2026-10-16T08:00:00Z'}));expect(syncFreshness(rows,new Date('2026-11-10T09:00:00Z')).stale).toBe(true);});
 it('nedostajući izvor nije ažuran',()=>expect(syncFreshness([],new Date('2026-11-10')).stale).toBe(true));
});
