import {supabase} from '../../electron-app/src/api/supabaseClient';
import { google, gmail_v1 } from 'googleapis';
// import { OAuth2Client } from 'google-auth-library';
// import { Email } from 'src/types';

import { fs } from "fs";
import { path } from "path";


export async function sendReplyEmail(threadId, to, from, body) {
  const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
  const TOKEN_PATH = path.join(process.cwd(), "token.json");
  const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

  async function loadSavedCredentialsIfExist() {
    try {
      const content = fs.readFileSync(TOKEN_PATH, "utf-8");
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch {
      return null;
    }
  }

  async function saveCredentials(client) {
    const content = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    fs.writeFileSync(TOKEN_PATH, payload);
  }

  async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) return client;

    const { authenticate } = await import("@google-cloud/local-auth");
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
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      body,
    ];
    const message = messageParts.join("\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { raw: encodedMessage, threadId };
  }

  async function replyToThread(auth) {
    const gmail = google.gmail({ version: "v1", auth });

    // Get the thread details
    const threadDetails = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const lastMessage = threadDetails.data.messages.at(-1);
    const headers = lastMessage.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value;
    const messageId = headers.find((h) => h.name === "Message-ID")?.value;
    const references = headers.find((h) => h.name === "References")?.value || messageId;

    const email = createRawMessage({
      to: from, // sending back to original sender
      subject,
      body,
      threadId,
      inReplyTo: messageId,
      references,
    });

    // Send the message
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: email,
    });

    console.log("✅ Sent reply inside thread:", res.data.threadId);

    // Mark thread as read
    await gmail.users.threads.modify({
      userId: "me",
      id: res.data.threadId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });

    console.log("📭 Thread marked as read.");
  }

  // Run
  authorize().then(replyToThread).catch(console.error);
}
