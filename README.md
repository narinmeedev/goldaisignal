# Gold AI Signal

Production service for XAUUSD trading plans. The system receives live gold ticks and M5/M15/H1 candles from MT5, evaluates one stable plan at a time, tracks each plan through entry and TP/SL, and sends eligible plan updates through LINE Messaging API.

## Service Rules

- XAU symbols only. Non-gold webhook and candle-sync requests are acknowledged and ignored without database logging.
- No synthetic market candles, manual price simulation, or demo trading plans.
- A customer plan requires fresh MT5 structure, technical score at least 70/100, risk score at most 55/100, and Risk/Reward of at least 1:2.
- A plan remains waiting until price reaches Entry. It becomes measurable after entry and closes when TP, SL, break-even, cancellation, or invalidation is recorded.
- Win rate uses only decided XAU plan results. Waiting, open, cancelled, and break-even plans are excluded from the win-rate denominator.
- LINE pushes go only to active members with a linked LINE account. Test messages go only to the authenticated admin's linked LINE account.

## Runtime

- Next.js 16 App Router
- React 19 and Tailwind CSS 4
- Prisma 7 with PostgreSQL
- Supabase Storage for payment slips
- MT5 Expert Advisor: `MT5_Webhook_Sender.mq5`

## Local Development

Configure the required environment variables in `.env`, then run:

```bash
npm install
npm run dev
```

Open the URL printed by Next.js. Authentication and market data require the configured PostgreSQL database.

## Required Configuration

```text
DATABASE_URL
POSTGRES_PRISMA_URL
JWT_SECRET
TRADINGVIEW_WEBHOOK_SECRET
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
LINE_CHANNEL_ID
LINE_CHANNEL_SECRET
CRON_SECRET
```

Payment auto-verification also requires either the SlipOK or EasySlip credentials. Without a verification provider, uploaded slips remain pending for manual admin review.

## Data Retention

- Raw webhook events are retained for 3 days.
- Login and activity logs are retained for 90 days.
- Completed or cancelled trade plans are retained for 180 days so 7/30/90-day performance remains measurable.
- Customer accounts, payments, affiliate commissions, and system settings are not removed by automated cleanup.
- Vercel calls `/api/cron/retention` once per day and authenticates with `CRON_SECRET`.

## MT5 Setup

1. Attach `MT5_Webhook_Sender.mq5` to an XAU chart only. The EA refuses to initialize on non-gold symbols.
2. Allow WebRequest access to the production domain in MT5.
3. Configure the webhook secret to match `TRADINGVIEW_WEBHOOK_SECRET`.
4. Confirm that price-feed events and M5/M15/H1 candle syncs appear in production before allowing customers to use plans.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run build
```

After deployment, verify the public market status, authenticated customer dashboard, MT5 freshness, plan lifecycle records, LINE delivery, payment-slip behavior, and the absence of non-XAU data.
