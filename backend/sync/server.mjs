import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

// === Google OAuth + Gmail API setup ===
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch {
    return null;
  }
}

async function saveCredentials(client) {
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  fs.writeFileSync(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;

  const { authenticate } = await import('@google-cloud/local-auth');
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (auth.credentials) await saveCredentials(auth);
  return auth;
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
  console.log(`🚀 Gmail backend server running on http://localhost:${PORT}`);
});
