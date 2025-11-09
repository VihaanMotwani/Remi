// ===============================
//  iMessage Send Script (final fixed)
// ===============================

// Support both ESM and CommonJS imports for Photon SDK
import fs from "fs";
import path from "path";
import os from "os";

// Dynamic import so it works in both modes
const { IMessageSDK } = await import("@photon-ai/imessage-kit");

(async () => {
  try {
    const reportPath = path.resolve("./daily_report.json");
    if (!fs.existsSync(reportPath)) {
      console.error("❌ daily_report.json not found!");
      process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const { greeting, urgent_tasks, follow_up_tasks, meetings_today, summary_text } = report;

    const sdk = new IMessageSDK({ debug: true });
    const recipient = process.env.IMESSAGE_TO || "tinu.grover@gmail.com";

    await sdk.send(recipient, "📨 Test message from Remi AI — verifying connection...");

    const message = `
📅 **Daily Briefing**
────────────────────────────
${greeting}

🧠 Summary:
${summary_text || "No summary available"}

🔥 Urgent Tasks:
${urgent_tasks?.length ? urgent_tasks.map(t => `• ${t.task} (due ${t.due_date || "N/A"})`).join("\n") : "None"}

📌 Follow-Ups:
${follow_up_tasks?.length ? follow_up_tasks.map(f => `• ${f.task}`).join("\n") : "None"}

🗓️ Meetings Today:
${meetings_today?.length ? meetings_today.map(m => `• ${m.title} at ${m.time || "TBD"}`).join("\n") : "None"}

🚀 Have a productive day, Tanya!
`;

    await sdk.send(recipient, message);
    console.log("✅ iMessage daily report sent successfully!");

    await sdk.close();
  } catch (error) {
    console.error("❌ Error sending iMessage:", error);
  }
})();
