import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloseWorkOrderRequest {
  work_order_id: string;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Nedostaje autorizacija');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Niste autentifikovani');
    }

    const { work_order_id, note }: CloseWorkOrderRequest = await req.json();

    if (!work_order_id) {
      throw new Error('work_order_id je obavezan');
    }

    console.log('Closing work order:', work_order_id, 'by user:', user.id);

    // 1. Fetch work order to check status and type
    const { data: workOrder, error: fetchError } = await supabase
      .from('work_orders')
      .select('id, order_number, status, order_type, client_id, clients(name, notification_email)')
      .eq('id', work_order_id)
      .single();

    if (fetchError || !workOrder) {
      throw new Error('Radni nalog nije pronađen');
    }

    if (workOrder.status === 'closed') {
      throw new Error('Nalog je već zatvoren');
    }

    // 2. Call appropriate database function to close the order
    const functionName = workOrder.order_type === 'film' 
      ? 'close_film_work_order' 
      : 'close_work_order_atomic';

    console.log('Calling database function:', functionName);

    const { data: closeResult, error: closeError } = await supabase.rpc(functionName, {
      p_work_order_id: work_order_id,
      p_user_id: user.id
    });

    if (closeError) {
      console.error('Error closing work order:', closeError);
      throw new Error(closeError.message);
    }

    const result = closeResult as { success: boolean; error?: string };
    if (!result?.success) {
      throw new Error(result?.error || 'Greška pri zatvaranju naloga');
    }

    console.log('Work order closed successfully');

    // 3. Add closing note if provided
    if (note?.trim()) {
      const { error: noteError } = await supabase
        .from('work_order_events')
        .insert({
          work_order_id,
          event_type: 'note',
          created_by: user.id,
          metadata: { note: note.trim(), context: 'closing' }
        });

      if (noteError) {
        console.error('Error adding closing note:', noteError);
      }
    }

    // 4. Check if delivery note already exists
    const { data: existingDeliveryNote, error: checkError } = await supabase
      .from('delivery_notes')
      .select('id, sent_at')
      .eq('work_order_id', work_order_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking delivery note:', checkError);
    }

    let deliveryNoteSent = false;

    // 5. Send delivery note if it doesn't exist
    if (!existingDeliveryNote) {
      console.log('No existing delivery note found, sending new one...');
      
      try {
        const { error: sendError } = await supabase.functions.invoke('send-delivery-note', {
          body: { workOrderId: work_order_id }
        });

        if (sendError) {
          console.error('Error sending delivery note:', sendError);
          // Don't throw here - the order is already closed, just log the error
        } else {
          console.log('Delivery note sent successfully');
          deliveryNoteSent = true;
        }
      } catch (sendError) {
        console.error('Exception sending delivery note:', sendError);
        // Don't throw here - the order is already closed
      }
    } else {
      console.log('Delivery note already exists, skipping send');
      deliveryNoteSent = true;
    }

    // 6. Fetch updated work order
    const { data: updatedOrder, error: updateFetchError } = await supabase
      .from('work_orders')
      .select(`
        *,
        clients (name),
        profiles (full_name)
      `)
      .eq('id', work_order_id)
      .single();

    if (updateFetchError) {
      console.error('Error fetching updated order:', updateFetchError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        work_order: updatedOrder,
        delivery_note_sent: deliveryNoteSent,
        message: deliveryNoteSent 
          ? 'Nalog zatvoren i otpremnica poslata' 
          : 'Nalog zatvoren (otpremnica nije poslata)'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('Error in close-work-order function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Nepoznata greška'
      }),
      {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
