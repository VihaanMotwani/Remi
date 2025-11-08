import { supabase } from './supabaseClient';

export interface Email {
  id: string;
  from_email: string;
  to_email: string[];
  cc?: string[];
  subject: string;
  body?: string;
  summary?: string;
  timestamp?: string;
  action_items?: Record<string, any>[];
  repliedTo: boolean;
  response?: string;
}

// 📨 Fetch all emails where replied_to = false
export async function fetchUnrespondedEmails(): Promise<Email[]> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('replied_to', false)
    .order('timestamp', { ascending: false });

  if (error) throw error;

  return data.map((e) => ({
    ...e,
    action_items: e.action_items ? JSON.parse(JSON.stringify(e.action_items)) : [],
  }));
}

// // 💾 Save draft in Supabase
// export async function saveEmailDraft(emailId: string, content: string) {
//   const { error } = await supabase
//     .from('drafts')
//     .insert({ email_id: emailId, content, status: 'draft' });

//   if (error) throw error;
//   return true;
// }

// ✅ Log sent email in Supabase
export async function logSentEmail(emailId: string, content: string) {
  // Mark the email as replied
  const { error: updateError } = await supabase
    .from('emails')
    .update({ replied_to: true })
    .eq('id', emailId);

  if (updateError) throw updateError;

  return true;
}

// ✉️ Send email via Gmail API
export async function sendEmailViaGmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string
) {
  const message =
    `To: ${to.join(', ')}\r\n` +
    `Subject: ${subject}\r\n\r\n` +
    `${body}`;

  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
  return await response.json();
}

// 🗂 Save draft via Gmail API
export async function saveDraftViaGmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string
) {
  const message =
    `To: ${to.join(', ')}\r\n` +
    `Subject: ${subject}\r\n\r\n` +
    `${body}`;

  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw: encodedMessage } }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save draft: ${response.statusText}`);
  }
  return await response.json();
}
