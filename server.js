import express from "express";
import twilio from "twilio";
import cors from "cors";
import { createServer } from "http";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Config (loaded from .env) ─────────────────────────────────────────────
const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER;
const DEMO_NUMBER  = process.env.DEMO_PHONE_NUMBER; // real phone that gets texts

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// In-memory store: caregiverId → latest reply
const replies = {};

// ── Send SMS ──────────────────────────────────────────────────────────────
app.post("/api/send-sms", async (req, res) => {
  const { caregiverId, caregiverName, shiftTime } = req.body;

  const body =
    `Hi ${caregiverName.split(" ")[0]}, this is Alden 👋 ` +
    `You're scheduled to clock in at ${shiftTime}. Please reply:\n\n` +
    `1 – Running late\n2 – Having technical issues\n3 – Forgot to clock in`;

  try {
    await client.messages.create({
      body,
      from: FROM_NUMBER,
      to: DEMO_NUMBER,
    });

    // Clear any old reply for this caregiver
    delete replies[caregiverId];

    res.json({ ok: true, sentTo: DEMO_NUMBER });
  } catch (err) {
    console.error("Twilio send error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Twilio webhook — fires when DEMO_NUMBER replies ───────────────────────
app.post("/webhook/reply", (req, res) => {
  const incomingBody = (req.body.Body || "").trim();
  const from         = req.body.From || "";

  console.log(`📨 Reply from ${from}: "${incomingBody}"`);

  // Figure out which caregiver was most recently texted
  // Simple approach: store last-sent caregiverId server-side
  if (global.lastSentCaregiverId) {
    replies[global.lastSentCaregiverId] = {
      text: incomingBody,
      ts: new Date().toISOString(),
    };
  }

  // Twilio expects TwiML response (even if empty)
  res.set("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// ── Poll for reply ────────────────────────────────────────────────────────
app.get("/api/reply/:caregiverId", (req, res) => {
  const { caregiverId } = req.params;
  const reply = replies[caregiverId];
  res.json({ reply: reply || null });
});

// ── Track last sent ───────────────────────────────────────────────────────
app.post("/api/track-sent", (req, res) => {
  global.lastSentCaregiverId = req.body.caregiverId;
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Alden server running on http://localhost:${PORT}`));
