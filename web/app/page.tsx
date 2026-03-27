"use client";

import { useEffect, useState } from "react";

interface Company {
  ticker: string;
  name: string;
  marketCap: number;
}

interface MarketData {
  leader: Company;
  second: Company;
  gap: {
    dollar: number;
    percent: number;
  };
  top5: Company[];
  updatedAt: string;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

function formatDollarGap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketcap")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 text-lg animate-pulse">
          Loading market data...
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-lg">
          Failed to load data. Try refreshing.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-2">
          Largest US Company by Market Cap
        </h1>
        <p className="text-xs text-zinc-600">
          Updated {new Date(data.updatedAt).toLocaleString()}
        </p>
      </div>

      {/* Hero: #1 Company */}
      <div className="text-center mb-16">
        <div className="text-6xl sm:text-8xl font-bold tracking-tight mb-2">
          {data.leader.ticker}
        </div>
        <div className="text-xl sm:text-2xl text-zinc-400 mb-4">
          {data.leader.name}
        </div>
        <div className="text-3xl sm:text-4xl font-mono text-emerald-400">
          {formatMarketCap(data.leader.marketCap)}
        </div>
      </div>

      {/* Gap Card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-12">
        <div className="text-center mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">
            Gap to #2
          </div>
          <div className="text-2xl font-bold text-amber-400">
            +{data.gap.percent.toFixed(1)}%
          </div>
          <div className="text-sm text-zinc-500 font-mono">
            {formatDollarGap(data.gap.dollar)} ahead
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-zinc-500">#2</div>
              <div className="text-lg font-semibold">{data.second.ticker}</div>
              <div className="text-xs text-zinc-500">{data.second.name}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono text-zinc-300">
                {formatMarketCap(data.second.marketCap)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 */}
      <div className="w-full max-w-md">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4 text-center">
          Top 5 by Market Cap
        </h2>
        <div className="space-y-2">
          {data.top5.map((company, i) => (
            <div
              key={company.ticker}
              className={`flex items-center justify-between p-3 rounded-lg ${
                i === 0
                  ? "bg-zinc-900 border border-zinc-700"
                  : "bg-zinc-900/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-600 w-5">
                  #{i + 1}
                </span>
                <div>
                  <span className="font-semibold">{company.ticker}</span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {company.name}
                  </span>
                </div>
              </div>
              <div className="font-mono text-sm text-zinc-400">
                {formatMarketCap(company.marketCap)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backtest Results */}
      <div className="w-full max-w-md mt-16">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4 text-center">
          Backtest — 2012 to Present
        </h2>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {/* CAGR comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <div className="text-xs font-mono text-zinc-500 mb-1">#1 Market Cap</div>
              <div className="text-3xl font-bold text-emerald-400">17.6%</div>
              <div className="text-xs text-zinc-500">CAGR</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-mono text-zinc-500 mb-1">S&P 500</div>
              <div className="text-3xl font-bold text-zinc-400">14.2%</div>
              <div className="text-xs text-zinc-500">CAGR</div>
            </div>
          </div>

          {/* Outperformance badge */}
          <div className="text-center mb-6">
            <span className="inline-block bg-emerald-400/10 text-emerald-400 text-sm font-mono px-3 py-1 rounded-full">
              +3.4%/yr outperformance
            </span>
          </div>

          {/* Stats table */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            {[
              { label: "Total Return", strat: "805%", spy: "475%" },
              { label: "Sharpe Ratio", strat: "0.56", spy: "0.60" },
              { label: "Max Drawdown", strat: "-35.1%", spy: "-33.7%" },
              { label: "Volatility", strat: "28.3%", spy: "17.9%" },
              { label: "Switches", strat: "15", spy: "—" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">{row.label}</span>
                <div className="flex gap-6 font-mono">
                  <span className="text-zinc-200 w-16 text-right">{row.strat}</span>
                  <span className="text-zinc-500 w-16 text-right">{row.spy}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Holdings timeline */}
          <div className="border-t border-zinc-800 pt-4 mt-4">
            <div className="text-xs font-mono text-zinc-500 mb-2">Holdings Over Time</div>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div className="bg-blue-500" style={{ width: "55%" }} title="AAPL" />
              <div className="bg-emerald-500" style={{ width: "25%" }} title="MSFT" />
              <div className="bg-purple-500" style={{ width: "12%" }} title="NVDA" />
              <div className="bg-amber-500" style={{ width: "8%" }} title="XOM" />
            </div>
            <div className="flex justify-between mt-2 text-xs text-zinc-600">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" />AAPL</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />MSFT</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-purple-500" />NVDA</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" />XOM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-xs text-zinc-600">
        <p>Data from Yahoo Finance. Not financial advice.</p>
      </div>
    </main>
  );
}
