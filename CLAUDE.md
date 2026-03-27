# SP1 — Full Port the #1

## What This Is
A strategy that always holds the #1 US company by market cap. When leadership changes, switch at the next open.

## Project Structure
- `backtest.py` — Python backtest (2012–present) using Yahoo Finance. Compares #1 market cap strategy vs S&P 500.
- `web/` — Next.js 14 dashboard (React 18, Tailwind CSS). Shows live #1 company, gap to #2, top 5, and backtest results.

## Deployment
- **Live site:** https://sp1-fullport.vercel.app
- **Vercel project:** `web` under `n4vxs-projects`
- **GitHub:** https://github.com/n4vx/SP1
- Vercel is NOT auto-deploying from GitHub — deploy manually with `cd web && npx vercel --prod --yes`

## Key Backtest Results
- #1 Market Cap CAGR: 17.6% vs S&P 500: 14.2% (+3.4%/yr)
- ~15 switches over 13+ years (AAPL, MSFT, NVDA, XOM)

## Dev Commands
```bash
# Run backtest
pip install yfinance pandas numpy matplotlib
python backtest.py

# Run dashboard locally
cd web && npm install && npm run dev

# Deploy to Vercel
cd web && npx vercel --prod --yes
```
