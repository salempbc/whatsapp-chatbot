# Deployment & Operational Guide

## 1. Hosting Environment (Render / Railway / Docker)

The application is architected as a single-runtime Node.js service requiring minimal memory footprint (< 150 MB RSS) and zero external queue dependencies.

### Recommended Render Specification
- **Service Type:** Web Service
- **Runtime:** Node 20+
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/ping`

---

## 2. Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | Optional | HTTP port for Express (Render injects automatically) | `3000` |
| `MONGO_URI` | **Required** | MongoDB Atlas connection string | `<MONGO_URI>` |
| `BOT_TOKEN` | **Required** | Telegram bot token from @BotFather | `<BOT_TOKEN>` |
| `ADMIN_ID` | **Required** | Telegram user ID of authorized administrator | `<ADMIN_ID>` |
| `ADMIN_SECRET` | Recommended | Secure standalone secret for browser dashboard | `<ADMIN_SECRET>` |
| `WEBAPP_URL` | Optional | Public HTTPS domain for Webhook and WebApp | `<WEBAPP_URL>` |
| `GEMINI_API_KEY`| Optional | Google Gemini API key for AI prayers | `AIzaSy...` |
| `GEMINI_MODEL` | Optional | Gemini model name (default: `gemini-1.5-flash`) | `gemini-1.5-flash` |

---

## 3. Uptime & Free-Tier Wakeup (cron-job.org)

If deployed on Render's free tier, the container may sleep after 15 minutes of inactivity. To ensure the bot remains responsive and the morning 06:00 IST job executes reliably:

1. Create a free account on [cron-job.org](https://cron-job.org).
2. Add an HTTP GET job targeting: `https://<your-render-app>.onrender.com/ping`
3. Configure frequency: Every 10 minutes.
4. The `/ping` endpoint responds in < 2ms without initiating database queries, maintaining process readiness without database overhead.

---

## 4. Graceful Shutdown & Data Integrity

`src/app.js` listens for `SIGTERM` and `SIGINT` signals. Upon receiving a termination signal:
1. Stops accepting new HTTP connections.
2. Drains pending Telegram messages in queue.
3. Closes long-polling connections or keeps webhooks intact for rolling deploys.
4. Safely closes MongoDB connections without dropping in-flight writes.
