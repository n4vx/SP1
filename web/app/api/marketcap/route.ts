import { NextResponse } from "next/server";

const TOP_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOG", "AMZN", "META", "BRK-B", "TSM", "LLY", "AVGO",
];

interface CompanyData {
  ticker: string;
  name: string;
  marketCap: number;
}

const TIMEOUT_MS = 8000;

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function fetchWithYahoo(): Promise<CompanyData[]> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

  // Step 1: Get cookies
  const cookieRes = await fetch("https://fc.yahoo.com/curveball", {
    headers: { "User-Agent": ua },
    redirect: "manual",
    signal: timeoutSignal(TIMEOUT_MS),
  });
  const cookies = cookieRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");

  // Step 2: Get crumb
  const crumbRes = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: { "User-Agent": ua, Cookie: cookieStr },
      signal: timeoutSignal(TIMEOUT_MS),
    }
  );
  const crumb = await crumbRes.text();

  if (!crumb || crumb.length > 50) {
    throw new Error("Invalid crumb received");
  }

  // Step 3: Fetch quotes
  const symbols = TOP_TICKERS.join(",");
  const quoteRes = await fetch(
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${encodeURIComponent(crumb)}`,
    {
      headers: { "User-Agent": ua, Cookie: cookieStr },
      signal: timeoutSignal(TIMEOUT_MS),
    }
  );

  if (!quoteRes.ok) {
    throw new Error(`Yahoo API returned ${quoteRes.status}`);
  }

  const data = await quoteRes.json();
  const results = data?.quoteResponse?.result || [];

  return results
    .filter(
      (r: Record<string, unknown>) => r.marketCap && (r.marketCap as number) > 0
    )
    .map((r: Record<string, unknown>) => ({
      ticker: (r.symbol as string).replace("-", "."),
      name: (r.shortName || r.longName || r.symbol) as string,
      marketCap: r.marketCap as number,
    }));
}

// Fallback: use Yahoo chart API (no crumb needed) with known shares outstanding
const SHARES_OUTSTANDING: Record<string, number> = {
  AAPL: 14700000000,
  MSFT: 7430000000,
  NVDA: 24500000000,
  GOOG: 5580000000,
  AMZN: 10530000000,
  META: 2530000000,
  "BRK-B": 1300000000,
  TSM: 25900000000,
  LLY: 950000000,
  AVGO: 4660000000,
};

const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  GOOG: "Alphabet Inc.",
  AMZN: "Amazon.com, Inc.",
  META: "Meta Platforms, Inc.",
  "BRK-B": "Berkshire Hathaway",
  TSM: "Taiwan Semiconductor",
  LLY: "Eli Lilly and Company",
  AVGO: "Broadcom Inc.",
};

async function fetchWithChartFallback(): Promise<CompanyData[]> {
  const ua = "Mozilla/5.0";
  const results: CompanyData[] = [];

  const fetches = TOP_TICKERS.map(async (ticker) => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`,
        {
          headers: { "User-Agent": ua },
          signal: timeoutSignal(TIMEOUT_MS),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;

      const price = meta.regularMarketPrice;
      const shares = meta.sharesOutstanding || SHARES_OUTSTANDING[ticker] || 0;
      if (shares === 0) return null;

      return {
        ticker: ticker.replace("-", "."),
        name: meta.shortName || COMPANY_NAMES[ticker] || ticker,
        marketCap: price * shares,
      };
    } catch {
      return null;
    }
  });

  const all = await Promise.all(fetches);
  for (const item of all) {
    if (item) results.push(item);
  }
  return results;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Try primary Yahoo crumb-based API first
    let companies: CompanyData[];
    try {
      companies = await fetchWithYahoo();
    } catch (e) {
      console.warn("Yahoo crumb API failed, using chart fallback:", e);
      companies = await fetchWithChartFallback();
    }

    companies.sort((a, b) => b.marketCap - a.marketCap);

    if (companies.length < 2) {
      return NextResponse.json(
        { error: "Could not fetch market cap data from any source" },
        { status: 500 }
      );
    }

    const first = companies[0];
    const second = companies[1];
    const gapDollar = first.marketCap - second.marketCap;
    const gapPercent = (gapDollar / second.marketCap) * 100;

    return NextResponse.json({
      leader: first,
      second: second,
      gap: {
        dollar: gapDollar,
        percent: gapPercent,
      },
      top5: companies.slice(0, 5),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Market cap fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
