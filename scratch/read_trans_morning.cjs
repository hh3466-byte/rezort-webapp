const fs = require("fs");
const readline = require("readline");
const path = process.env.USERPROFILE + "/.gemini/antigravity-ide/brain/91740ea0-be95-4cbc-846b-bbde66fca03f/.system_generated/logs/transcript.jsonl";
const rl = readline.createInterface({ input: fs.createReadStream(path) });
rl.on("line", line => {
  try {
    const obj = JSON.parse(line);
    if (obj.created_at >= "2026-10-22T05:25:00Z" && obj.created_at <= "2026-10-22T05:35:00Z") {
      if (obj.type === "PLANNER_RESPONSE" || obj.type === "RUN_COMMAND") {
        console.log(`[${obj.created_at}] [${obj.type}]`, JSON.stringify(obj.tool_calls || obj.content || "").slice(0, 300));
      }
    }
  } catch(e) {}
});
