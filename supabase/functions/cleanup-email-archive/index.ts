import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting email-archive cleanup...');

    // List all files in email-archive bucket
    const { data: files, error: listError } = await supabase.storage
      .from('email-archive')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('Error listing files:', listError);
      throw listError;
    }

    if (!files || files.length === 0) {
      console.log('No files to clean up');
      return new Response(
        JSON.stringify({ message: 'No files to clean up', deleted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const filesToDelete: string[] = [];

    // Find files older than 24 hours
    for (const file of files) {
      if (file.created_at) {
        const fileCreatedAt = new Date(file.created_at);
        if (fileCreatedAt < twentyFourHoursAgo) {
          // Check all subfolders recursively
          const { data: nestedFiles, error: nestedError } = await supabase.storage
            .from('email-archive')
            .list(file.name, {
              limit: 100
            });

          if (nestedError) {
            console.error(`Error listing nested files in ${file.name}:`, nestedError);
            continue;
          }

          if (nestedFiles && nestedFiles.length > 0) {
            for (const nestedFile of nestedFiles) {
              if (nestedFile.created_at) {
                const nestedCreatedAt = new Date(nestedFile.created_at);
                if (nestedCreatedAt < twentyFourHoursAgo) {
                  filesToDelete.push(`${file.name}/${nestedFile.name}`);
                }
              }
            }
          }
        }
      }
    }

    console.log(`Found ${filesToDelete.length} files to delete`);

    // Delete files in batches
    let deletedCount = 0;
    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('email-archive')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        throw deleteError;
      }

      deletedCount = filesToDelete.length;
      console.log(`Successfully deleted ${deletedCount} files`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Cleanup completed successfully', 
        deleted: deletedCount,
        files: filesToDelete
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in cleanup-email-archive:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Cleanup failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

serve(handler);
