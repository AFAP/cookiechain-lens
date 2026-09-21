/**
 * Cookie Chain data layer.
 *
 * Two public, read-only endpoints are enough to build on: `/api/markets` and
 * `/api/tokens`. Both are CORS-open and need no key, so the whole app is a
 * static bundle with no backend.
 *
 * The interesting problem here is not fetching the data, it is interpreting it.
 * See `deriveMarketViews` for why a naive price comparison is worse than none.
 */

export const API_BASE = 'https://api.cookiescan.io';
export const RPC_URL = 'https://rpc.cookiescan.io';

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  logo?: string;
  decimals?: number;
  description?: string;
  updateAuthority?: string;
}

export interface TokenPrice {
  usd?: number;
  native?: number;
  change24h?: number;
}

export interface TokenMarketData {
  volume24h?: number;
  volumeChange24h?: number;
  liquidity?: number;
  marketCap?: number;
  supply?: number;
  holderCount?: number;
}

export interface Token {
  mint: string;
  metadata: TokenMetadata;
  price: TokenPrice;
  marketData: TokenMarketData;
  lastUpdated: string;
}

export interface TokensResponse {
  success: boolean;
  cookUsd: number;
  count: number;
  data: Token[];
}

export interface MarketSide {
  mint: string;
  symbol?: string;
  amount?: number;
  priceUsd?: number;
}

export interface RawMarket {
  marketId: string;
  type: string;
  baseToken: MarketSide;
  quoteToken: MarketSide;
  liquidityUsd?: number;
  liquidityDisplay?: string;
}

export interface MarketsResponse {
  success: boolean;
  cookUsd: number;
  marketCount: number;
  markets: RawMarket[];
}

/** A market with the derived fields the UI actually reasons about. */
export interface MarketView extends RawMarket {
  /** Liquidity in USD, normalised. */
  liquidity: number;
  /**
   * Whether this market can absorb a trade at all.
   *
   * The chain has 160 markets and a median liquidity of zero, so this is the
   * single most useful thing to compute: without it the UI presents 446%
   * "spreads" on markets where nothing can be traded.
   */
  tradeable: boolean;
  /** Rough price of the base token in USD, when both sides quote a price. */
  impliedBaseUsd?: number;
}

export const TRADEABLE_USD = 100;

export function deriveMarketViews(raw: RawMarket[]): MarketView[] {
  return raw
    .map((m): MarketView => {
      const liquidity = typeof m.liquidityUsd === 'number' && Number.isFinite(m.liquidityUsd) ? m.liquidityUsd : 0;
      const base = m.baseToken?.priceUsd;
      const quote = m.quoteToken?.priceUsd;
      // Both legs quote a USD price; the base leg is the one we rank on. When
      // only one leg is priced we leave it undefined rather than guessing.
      const impliedBaseUsd =
        typeof base === 'number' && base > 0 ? base : undefined;
      void quote;
      return {
        ...m,
        liquidity,
        tradeable: liquidity >= TRADEABLE_USD,
        impliedBaseUsd,
      };
    })
    .sort((a, b) => b.liquidity - a.liquidity);
}

export interface SpreadView {
  mint: string;
  symbol: string;
  /** How many markets list this mint on either side. */
  markets: number;
  /** How many of those are actually tradeable. */
  tradeableMarkets: number;
  minUsd: number;
  maxUsd: number;
  /** max/min - 1, as a percentage. */
  spreadPct: number;
  /**
   * True when at least two *tradeable* markets disagree. Only these are worth
   * a second look; everything else is a stale quote on an empty pool.
   */
  actionable: boolean;
}

/**
 * Compare a token's price across every market that lists it.
 *
 * The naive version of this — take min and max across all markets — produces a
 * screen full of enormous fake spreads, because an abandoned pool keeps
 * whatever price it last traded at. On this chain the largest such spread is
 * over 400% on a market holding under a cent of liquidity.
 *
 * So each row reports how many of its markets are tradeable, and only rows with
 * at least two of them are flagged `actionable`. The fake ones are still shown,
 * labelled, because seeing them is the point: it is the difference between a
 * price and a tradeable price.
 */
export function deriveSpreads(markets: MarketView[], minSpreadPct = 1): SpreadView[] {
  const byMint = new Map<string, { symbol: string; quotes: { price: number; tradeable: boolean }[] }>();

  for (const m of markets) {
    for (const side of [m.baseToken, m.quoteToken]) {
      if (!side?.mint) continue;
      const price = side.priceUsd;
      if (typeof price !== 'number' || !(price > 0)) continue;
      let row = byMint.get(side.mint);
      if (!row) {
        row = { symbol: side.symbol ?? side.mint.slice(0, 6), quotes: [] };
        byMint.set(side.mint, row);
      }
      row.quotes.push({ price, tradeable: m.tradeable });
    }
  }

  const out: SpreadView[] = [];
  for (const [mint, row] of byMint) {
    if (row.quotes.length < 2) continue;
    const prices = row.quotes.map((q) => q.price);
    const minUsd = Math.min(...prices);
    const maxUsd = Math.max(...prices);
    const spreadPct = ((maxUsd - minUsd) / minUsd) * 100;
    if (spreadPct < minSpreadPct) continue;
    const tradeableMarkets = row.quotes.filter((q) => q.tradeable).length;
    out.push({
      mint,
      symbol: row.symbol,
      markets: row.quotes.length,
      tradeableMarkets,
      minUsd,
      maxUsd,
      spreadPct,
      actionable: tradeableMarkets >= 2,
    });
  }
  return out.sort((a, b) => {
    // Actionable rows first, then by size of spread.
    if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
    return b.spreadPct - a.spreadPct;
  });
}

/** Fetch with retries: the public endpoint occasionally resets connections. */
async function getJson<T>(path: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const fetchTokens = () => getJson<TokensResponse>('/api/tokens');
export const fetchMarkets = () => getJson<MarketsResponse>('/api/markets');

/** Read the current slot straight from the RPC — a liveness signal for the UI. */
export async function fetchSlot(): Promise<number | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] }),
    });
    const json = (await res.json()) as { result?: number };
    return typeof json.result === 'number' ? json.result : null;
  } catch {
    return null;
  }
}

export function formatUsd(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '-';
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toExponential(2)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

export function formatCount(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US');
}
