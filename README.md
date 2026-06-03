# Gold AI Signal Lab — MVP Console

A SaaS-ready, institutional-grade gold trading signal lab and risk engine for XAUUSD. Built with Next.js, Tailwind CSS, Prisma 7, and SQLite.

## Features

1. **Console Authentication:** Secure administrative login with glassmorphism styling and auto-redirects.
2. **Decision Engine Logs:** Full history of all TradingView alert webhooks, anti-fakeout scores, and risk checks.
3. **Paper Trading Journal:** Complete trade log showing entry price, exit price, R-profit/loss multiples, and system closing logs.
4. **S/R Zones Scanner:** Dynamic scanning of multi-timeframe swing extremes (Highs/Lows) from historical data to map Support, Resistance, and Liquidity pools.
5. **Interactive Webhook Simulator:** Directly test BUY/SELL alerts, fakeout filters, and trade evaluations directly from the overview dashboard.
6. **Dynamic Price Ticker & Tick Tester:** Update active trades' TP/SL targets in real-time based on simulated price walks or manual inputs.
7. **AI Review Tool & Export:** Pre-formatted daily JSON logs of all trade activities, with automated institutional recommendations for OpenAI model ingestion.

---

## Technical Specifications

- **Frontend/Backend:** Next.js (App Router, Route Handlers, Tailwind CSS)
- **Database:** SQLite (local `dev.db` database for zero-dependency local testing)
- **ORM:** Prisma v7.8.0 (configured with the `better-sqlite3` driver adapter for premium native performance)
- **Engine Rules:**
  - Risk Reward Ratio minimum 1:2
  - Max risk per trade: 1% of virtual balance
  - Max trades per day: 5
  - Consecutive losses cooldown: 3 losses pauses trading
  - Fakeout score triggers: closes back inside zone (+40), volatility range > 2x average (+25), sideways chop (+20). Rejects if score > 60.

---

## Quick Start Guide

### 1. Run Development Server

Instantly run the application locally (no external database server required):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3050) (or the port specified in terminal) in your browser.

### 2. Login Credentials

- **Master Email:** `admin@goldsignal.ai`
- **Security Key:** `goldadmin123`

### 3. Initialize & Seed Sample Market Data

To test the support/resistance scanner and alert calculations:
1. Log in and go to the Admin Dashboard.
2. Click the glowing **"Reset & Seed Candles"** button in the header.
3. This seeds 150 historical candles for M15, H1, and H4 charts and calculates active zones instantly!

---

## TradingView Webhook Integration

### Endpoint URL

```txt
POST http://localhost:3000/api/webhooks/tradingview
```

### JSON Payload Schema

Ensure the TradingView Alert Message looks exactly like this:

```json
{
  "secret": "GOLD_AI_SECRET",
  "symbol": "XAUUSD",
  "timeframe": "M15",
  "direction": "BUY",
  "price": 3336.5,
  "strategy": "support_bounce",
  "timestamp": "2026-05-31T10:00:00+07:00"
}
```

### Test Webhook manually via Curl

Ensure the development server is running and run this terminal command to simulate a TradingView alert:

```bash
curl -X POST http://localhost:3000/api/webhooks/tradingview \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "GOLD_AI_SECRET",
    "symbol": "XAUUSD",
    "timeframe": "M15",
    "direction": "BUY",
    "price": 3336.5,
    "strategy": "support_bounce"
  }'
```

---

## Production / SaaS Scaling (PostgreSQL)

To switch the local database from SQLite to PostgreSQL:
1. Change the provider in `prisma/schema.prisma` from `sqlite` to `postgresql`.
2. Configure the `DATABASE_URL` environment variable inside your production `.env`.
3. In `src/lib/prisma.ts`, initialize `new PrismaClient()` without the `better-sqlite3` adapter as PostgreSQL handles direct pool connections natively.
# goldaisignal
