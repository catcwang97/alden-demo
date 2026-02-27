# Alden Demo — Real SMS Setup

## One-time setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

This starts:
- **React frontend** at http://localhost:5173
- **Express server** at http://localhost:3001

## Wire up Twilio replies (the webhook)

When someone texts back to your Twilio number, Twilio needs to POST to your server.
Since you're running locally, use **ngrok** to expose your server:

```bash
# Install ngrok (one time): https://ngrok.com/download
ngrok http 3001
```

It'll give you a URL like: `https://abc123.ngrok.io`

Then go to **console.twilio.com**:
1. Phone Numbers → Manage → Active Numbers → click your number
2. Under **Messaging** → "A message comes in" → set to:
   `https://abc123.ngrok.io/webhook/reply`
3. Hit Save

That's it — replies will now show up live on the webpage.

## How the SMS flow works

1. Click "💬 Text Grace" or "💬 Text Liam" in the Clock-in Manager
2. A real SMS goes to +12407534805 from your Twilio number
3. That person replies with 1, 2, or 3
4. Twilio POSTs the reply to your webhook
5. The webpage polls every 3 seconds and shows the reply live with typing dots
