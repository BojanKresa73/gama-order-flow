export type SyncRow={entity:string;status:string;updated_at:string;last_error?:string|null};
export function syncFreshness(rows:SyncRow[],now=new Date()) {
 const required=['customers','accounts','issuedinvoices','receivedinvoices','journals_'+now.getFullYear(),'journal_details','link_vat'];
 const selected=required.map(entity=>rows.find(r=>r.entity===entity));
 const incomplete=selected.some(r=>!r||r.status!=='done'||r.last_error);
 const dates=selected.filter(Boolean).map(r=>Date.parse(r!.updated_at));
 const oldest=dates.length===required.length&&dates.every(Number.isFinite)?Math.min(...dates):null;
 return {incomplete,last:oldest===null?null:new Date(oldest).toISOString(),stale:incomplete||oldest===null||now.getTime()-oldest>86400000};
}
