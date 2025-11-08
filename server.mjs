import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { google } from 'googleapis';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

// Load credentials and tokens from environment variables
function loadCredentials() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = JSON.parse(process.env.GOOGLE_TOKEN);
    return { credentials, token };
  } catch (err) {
    console.error('Failed to parse Google credentials or token from environment:', err);
    return null;
  }
}

async function authorize() {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Google credentials or token not found in environment variables');
  }

  const { credentials, token } = creds;

  // Create OAuth2 client from credentials
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Set credentials with token loaded from env
  oAuth2Client.setCredentials(token);

  // Optional: verify token validity here or refresh if needed

  return oAuth2Client;
}

function createRawMessage({ to, subject, body, threadId, references, inReplyTo }) {
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { raw: encodedMessage, threadId };
}

async function sendReplyEmail({ threadId, to, from, body }) {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  // Fetch thread details to get last message headers
  const threadDetails = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
  });

  const lastMessage = threadDetails.data.messages.at(-1);
  const headers = lastMessage.payload.headers;
  const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
  const messageId = headers.find((h) => h.name === 'Message-ID')?.value;
  const references = headers.find((h) => h.name === 'References')?.value || messageId;

  const email = createRawMessage({
    to: from.match(/<(.*?)>/)?.[1] || from,
    subject,
    body,
    threadId,
    inReplyTo: messageId,
    references,
  });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: email,
  });

  // Mark thread as read
  await gmail.users.threads.modify({
    userId: 'me',
    id: res.data.threadId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });

  return { threadId: res.data.threadId, messageId: res.data.id };
}

// === Express route ===
app.post('/send-reply', async (req, res) => {
  const { threadId, to, from, body } = req.body;
  if (!threadId || !to || !from || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await sendReplyEmail({ threadId, to, from, body });
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error sending reply:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Gmail backend server running on port ${PORT}`);
});
