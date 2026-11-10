import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {syncFreshness,type SyncRow} from '@/lib/syncFreshness';
export function useSyncFreshness(){return useQuery({queryKey:['mm-sync-freshness'],queryFn:async()=>{const {data,error}=await supabase.from('mm_sync_state' as any).select('entity,status,updated_at,last_error');if(error)throw error;return syncFreshness((data||[]) as unknown as SyncRow[]);},refetchInterval:60000});}
