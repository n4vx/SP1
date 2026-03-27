#!/usr/bin/env python3
"""
Backtest: Does holding the largest US company by market cap beat the S&P 500?

Strategy: Always hold the #1 market cap company. When leadership changes,
sell at next open and buy the new #1 at next open.

Historical #1 by market cap (approximate transition dates based on public records):
- Apple and Microsoft have traded the #1 spot multiple times
- Key transitions are well-documented in financial media
"""

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# ── Historical #1 US company by market cap ──────────────────────────────
# Sources: companiesmarketcap.com, Wikipedia, financial media
# Format: (start_date, ticker, company_name)
# These are the well-documented transitions of the #1 spot
LEADERSHIP_HISTORY = [
    ("2010-01-01", "XOM",  "Exxon Mobil"),
    ("2011-08-10", "AAPL", "Apple"),           # Apple overtakes Exxon
    ("2018-08-02", "AAPL", "Apple"),           # Apple hits $1T first
    ("2018-11-28", "MSFT", "Microsoft"),       # MSFT overtakes during Apple selloff
    ("2019-10-17", "AAPL", "Apple"),           # Apple reclaims
    ("2020-01-15", "MSFT", "Microsoft"),       # Brief MSFT lead
    ("2020-07-31", "AAPL", "Apple"),           # Apple surges post-earnings
    ("2021-10-29", "MSFT", "Microsoft"),       # MSFT overtakes Apple
    ("2022-01-04", "AAPL", "Apple"),           # Apple reclaims at $3T
    ("2024-01-12", "MSFT", "Microsoft"),       # MSFT overtakes with AI hype
    ("2024-06-18", "NVDA", "NVIDIA"),          # NVDA briefly #1 for first time
    ("2024-06-24", "MSFT", "Microsoft"),       # MSFT reclaims
    ("2024-06-28", "AAPL", "Apple"),           # Apple reclaims
    ("2024-11-05", "NVDA", "NVIDIA"),          # NVDA overtakes Apple (Washington Post)
    ("2024-11-15", "AAPL", "Apple"),           # Apple reclaims briefly
    ("2025-01-21", "NVDA", "NVIDIA"),          # NVDA passes Apple again (CNBC Jan 21 2025)
    ("2025-01-27", "AAPL", "Apple"),           # Apple reclaims briefly
    ("2025-06-04", "NVDA", "NVIDIA"),          # NVDA overtakes Apple definitively ($3.53T)
    # NVDA has held #1 since, reaching $4T on July 9 2025 (CNN)
]

def build_leadership_series(start="2012-01-01", end=None):
    """Build a daily series of which ticker is #1 by market cap."""
    if end is None:
        end = datetime.now().strftime("%Y-%m-%d")

    dates = pd.date_range(start=start, end=end, freq='B')  # business days
    leadership = pd.Series(index=dates, dtype=str)

    # Sort transitions by date
    transitions = sorted(LEADERSHIP_HISTORY, key=lambda x: x[0])

    for date in dates:
        date_str = date.strftime("%Y-%m-%d")
        current_leader = transitions[0][1]  # default
        for t_date, ticker, _ in transitions:
            if date_str >= t_date:
                current_leader = ticker
        leadership[date] = current_leader

    return leadership

def run_backtest():
    print("=" * 65)
    print("  BACKTEST: Largest US Company by Market Cap vs S&P 500")
    print("=" * 65)

    START = "2012-01-01"
    END = datetime.now().strftime("%Y-%m-%d")

    # Build leadership timeline
    print("\n📊 Building market cap leadership timeline...")
    leadership = build_leadership_series(START, END)

    # Get unique tickers we need
    tickers_needed = list(leadership.unique())
    tickers_needed.append("SPY")
    print(f"   Tickers needed: {tickers_needed}")

    # Download all price data
    print("\n📥 Downloading price data from Yahoo Finance...")
    data = yf.download(tickers_needed, start=START, end=END, auto_adjust=True)

    # Use 'Open' for switching (next day open) and 'Close' for valuation
    opens = data['Open']
    closes = data['Close']

    # ── Strategy returns ────────────────────────────────────────────────
    print("\n🔄 Simulating strategy...")

    # Align leadership with trading days
    trading_days = closes.index
    strategy_returns = []
    holdings_log = []

    prev_holding = None

    for i in range(1, len(trading_days)):
        today = trading_days[i]
        yesterday = trading_days[i - 1]

        # What should we hold today? Based on yesterday's leadership
        # Find the nearest leadership date
        leader_dates = leadership.index[leadership.index <= yesterday]
        if len(leader_dates) == 0:
            continue
        current_leader = leadership[leader_dates[-1]]

        if prev_holding is None:
            prev_holding = current_leader

        # If leader changed, we switch at today's open (already priced in)
        holding_today = current_leader

        if holding_today != prev_holding:
            holdings_log.append((today.strftime("%Y-%m-%d"), prev_holding, holding_today))

        # Daily return — on switch days, split into exit and entry legs using opens
        if holding_today != prev_holding:
            # Switch day: exit old at open, enter new at open
            try:
                exit_ret = (opens[prev_holding].loc[today] / closes[prev_holding].loc[yesterday]) - 1
                entry_ret = (closes[holding_today].loc[today] / opens[holding_today].loc[today]) - 1
                ret = (1 + exit_ret) * (1 + entry_ret) - 1
                if not np.isnan(ret):
                    strategy_returns.append((today, ret, holding_today))
            except (KeyError, TypeError):
                pass
        elif holding_today in closes.columns:
            ret = (closes[holding_today].loc[today] / closes[holding_today].loc[yesterday]) - 1
            if not np.isnan(ret):
                strategy_returns.append((today, ret, holding_today))

        prev_holding = holding_today

    # Build return series
    strat_df = pd.DataFrame(strategy_returns, columns=['date', 'return', 'holding'])
    strat_df.set_index('date', inplace=True)

    # SPY returns
    spy_returns = closes['SPY'].pct_change().dropna()

    # Align dates
    common_dates = strat_df.index.intersection(spy_returns.index)
    strat_rets = strat_df.loc[common_dates, 'return']
    spy_rets = spy_returns.loc[common_dates]

    # Cumulative returns
    strat_cumulative = (1 + strat_rets).cumprod()
    spy_cumulative = (1 + spy_rets).cumprod()

    # ── Statistics ──────────────────────────────────────────────────────
    years = len(common_dates) / 252

    # Total return
    strat_total = strat_cumulative.iloc[-1] - 1
    spy_total = spy_cumulative.iloc[-1] - 1

    # CAGR
    strat_cagr = (strat_cumulative.iloc[-1]) ** (1 / years) - 1
    spy_cagr = (spy_cumulative.iloc[-1]) ** (1 / years) - 1

    # Annualized volatility
    strat_vol = strat_rets.std() * np.sqrt(252)
    spy_vol = spy_rets.std() * np.sqrt(252)

    # Sharpe (assuming 4% risk-free)
    rf = 0.04
    strat_sharpe = (strat_cagr - rf) / strat_vol
    spy_sharpe = (spy_cagr - rf) / spy_vol

    # Max drawdown
    def max_drawdown(cumulative):
        peak = cumulative.cummax()
        dd = (cumulative - peak) / peak
        return dd.min()

    strat_mdd = max_drawdown(strat_cumulative)
    spy_mdd = max_drawdown(spy_cumulative)

    # ── Print results ───────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print(f"  RESULTS ({START} to {END})  •  {years:.1f} years")
    print("=" * 65)
    print(f"{'Metric':<25} {'#1 Market Cap':>18} {'SPY (S&P 500)':>18}")
    print("-" * 65)
    print(f"{'Total Return':<25} {strat_total:>17.1%} {spy_total:>17.1%}")
    print(f"{'CAGR':<25} {strat_cagr:>17.1%} {spy_cagr:>17.1%}")
    print(f"{'Annual Volatility':<25} {strat_vol:>17.1%} {spy_vol:>17.1%}")
    print(f"{'Sharpe Ratio':<25} {strat_sharpe:>17.2f} {spy_sharpe:>17.2f}")
    print(f"{'Max Drawdown':<25} {strat_mdd:>17.1%} {spy_mdd:>17.1%}")
    print("-" * 65)
    print(f"{'Outperformance (CAGR)':<25} {(strat_cagr - spy_cagr):>17.1%}")
    print(f"{'Outperformance (Total)':<25} {(strat_total - spy_total):>17.1%}")

    print(f"\n📋 Leadership changes ({len(holdings_log)} switches):")
    for date, old, new in holdings_log:
        print(f"   {date}: {old} → {new}")

    # ── Holdings breakdown ──────────────────────────────────────────────
    print(f"\n📊 Time spent holding each stock:")
    holding_counts = strat_df['holding'].value_counts()
    for ticker, count in holding_counts.items():
        pct = count / len(strat_df) * 100
        print(f"   {ticker}: {pct:.1f}% of trading days ({count} days)")

    # ── Chart ───────────────────────────────────────────────────────────
    print("\n📈 Generating chart...")

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10), height_ratios=[3, 1])

    # Main chart
    ax1.plot(strat_cumulative.index, strat_cumulative.values,
             label=f'#1 Market Cap Strategy ({strat_cagr:.1%} CAGR)',
             color='#2563eb', linewidth=2)
    ax1.plot(spy_cumulative.index, spy_cumulative.values,
             label=f'SPY / S&P 500 ({spy_cagr:.1%} CAGR)',
             color='#64748b', linewidth=2, alpha=0.8)

    # Mark switches
    for date_str, old, new in holdings_log:
        date = pd.Timestamp(date_str)
        if date in strat_cumulative.index:
            ax1.axvline(x=date, color='red', alpha=0.2, linewidth=0.8)

    ax1.set_title('Largest US Company by Market Cap vs S&P 500', fontsize=16, fontweight='bold')
    ax1.set_ylabel('Growth of $1', fontsize=12)
    ax1.legend(fontsize=12, loc='upper left')
    ax1.grid(True, alpha=0.3)
    ax1.set_yscale('log')

    # Bottom chart: which stock is held
    holdings_series = strat_df['holding']
    unique_tickers = holdings_series.unique()
    colors = {'AAPL': '#2563eb', 'MSFT': '#10b981', 'XOM': '#f59e0b', 'NVDA': '#8b5cf6', 'GOOG': '#ef4444', 'GOOGL': '#ef4444'}

    for ticker in unique_tickers:
        mask = holdings_series == ticker
        dates = holdings_series.index[mask]
        ax2.scatter(dates, [ticker] * len(dates),
                   color=colors.get(ticker, '#64748b'), s=1, alpha=0.7)

    ax2.set_title('Current Holding', fontsize=12)
    ax2.set_xlabel('Date', fontsize=12)
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    chart_path = '/Users/nicoparadigm/Desktop/SP1/backtest_chart.png'
    plt.savefig(chart_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   Chart saved to: {chart_path}")

    # ── Verdict ─────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    if strat_cagr > spy_cagr:
        print(f"  ✅ CONFIRMED: #1 market cap strategy BEATS S&P 500")
        print(f"     by {(strat_cagr - spy_cagr):.1%} CAGR annually")
    else:
        print(f"  ❌ REJECTED: #1 market cap strategy UNDERPERFORMS S&P 500")
        print(f"     by {(spy_cagr - strat_cagr):.1%} CAGR annually")
    print("=" * 65)

    return strat_cagr > spy_cagr

if __name__ == "__main__":
    result = run_backtest()
