import { supabase } from "./supabaseClient";


export async function fetchUnrespondedEmails()  {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('replied_to', false)
    .order('timestamp', { ascending: false });

  if (error) throw error;

  // Ensure action_items is always an array
  return data.map((e) => ({
    ...e,
    action_items: e.action_items ? JSON.parse(JSON.stringify(e.action_items)) : [],
  }));
}

export async function updateEmailResponse(threadId: string, responseText: string) {
  const { data, error } = await supabase
    .from('emails')
    .update({
      replied_to: true,
      response: responseText,
    })
    .eq('thread_id', threadId);  // or use .eq('message_id', messageId) depending on your key

  if (error) {
    console.error('Error updating email:', error);
    throw error;
  }
  return data;
}

