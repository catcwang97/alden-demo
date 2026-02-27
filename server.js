import express from "express";
import twilio from "twilio";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const DEMO_NUMBER = process.env.DEMO_PHONE_NUMBER;
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const replies = {};

app.post("/api/send-sms", async (req, res) => {
  const { caregiverId, caregiverName, shiftTime } = req.body;
  const body = `Hi ${caregiverName.split(" ")[0]}, this is Alden 👋 You're scheduled to clock in at ${shiftTime}. Please reply:\n\n1 – Running late\n2 – Having technical issues\n3 – Forgot to clock in`;
  try {
    await client.messages.create({ body, from: FROM_NUMBER, to: DEMO_NUMBER });
    delete replies[caregiverId];
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/webhook/reply", (req, res) => {
  const incomingBody = (req.body.Body || "").trim();
  if (global.lastSentCaregiverId) {
    replies[global.lastSentCaregiverId] = { text: incomingBody, ts: new Date().toISOString() };
  }
  res.set("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

app.get("/api/reply/:caregiverId", (req, res) => {
  res.json({ reply: replies[req.params.caregiverId] || null });
});

app.post("/api/track-sent", (req, res) => {
  global.lastSentCaregiverId = req.body.caregiverId;
  res.json({ ok: true });
});

// Serve React frontend
app.use(express.static(join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Running on port ${PORT}`));
```

Also go to Railway → **Variables** → add one more:
```
NODE_ENV = production
