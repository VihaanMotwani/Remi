// send_imessage.js
import { IMessageSDK } from "@photon-ai/imessage-kit";
import fs from "fs";
import os from 'os';

async function main() {
  try {
    // Read latest daily report from Python (saved as JSON)
    const report = JSON.parse(fs.readFileSync("./daily_report.json", "utf-8"));

    const sdk = new IMessageSDK({ debug: true });
    const recipient = process.env.IMESSAGE_TO || "tinu.grover@gmail.com";
    await sdk.send(recipient, "📨 Test message from Remi AI — verifying connection.");
    const { greeting, urgent_tasks, follow_up_tasks, meetings_today, summary_text } = report;

    const message = `
📅 *Daily Briefing*
--------------------------
${greeting}

🧠 Summary:
${summary_text || "No summary available"}

🔥 Urgent Tasks:
${urgent_tasks?.length ? urgent_tasks.map(t => `• ${t.task} (due ${t.due_date || "N/A"})`).join("\n") : "None"}

📌 Follow-Ups:
${follow_up_tasks?.length ? follow_up_tasks.map(f => `• ${f.task}`).join("\n") : "None"}

🗓️ Meetings Today:
${meetings_today?.length ? meetings_today.map(m => `• ${m.title} at ${m.time || "TBD"}`).join("\n") : "None"}

Have a productive day! 🚀
`;

    await sdk.send(recipient, message);
    console.log("✅ iMessage daily report sent successfully!");

    await sdk.close();
  } catch (error) {
    console.error("❌ Error sending iMessage:", error);
  }
}

main();
