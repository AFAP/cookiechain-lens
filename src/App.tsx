import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  deriveMarketViews,
  deriveSpreads,
  fetchMarkets,
  fetchSlot,
  fetchTokens,
  formatCount,
  formatUsd,
  TRADEABLE_USD,
  type MarketView,
  type SpreadView,
  type Token,
} from './lib/cookiechain';

type Tab = 'markets' | 'tokens' | 'spreads';

interface Loaded {
  tokens: Token[];
  markets: MarketView[];
  spreads: SpreadView[];
  cookUsd: number;
  fetchedAt: Date;
}

export default function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('markets');
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<number | null>(null);

  // One shot for the dataset.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, m] = await Promise.all([fetchTokens(), fetchMarkets()]);
        if (cancelled) return;
        const markets = deriveMarketViews(m.markets ?? []);
        setData({
          tokens: t.data ?? [],
          markets,
          spreads: deriveSpreads(markets),
          cookUsd: t.cookUsd,
          fetchedAt: new Date(),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll the RPC so the header shows the chain is actually producing blocks.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await fetchSlot();
      if (alive && s !== null) setSlot(s);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const tradeable = data.markets.filter((m) => m.tradeable).length;
    const totalLiquidity = data.markets.reduce((n, m) => n + m.liquidity, 0);
    const actionable = data.spreads.filter((s) => s.actionable).length;
    return {
      tokens: data.tokens.length,
      markets: data.markets.length,
      tradeable,
      totalLiquidity,
      spreads: data.spreads.length,
      actionable,
    };
  }, [data]);

  const filteredMarkets = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.markets;
    return data.markets.filter(
      (m) =>
        m.baseToken?.symbol?.toLowerCase().includes(q) ||
        m.quoteToken?.symbol?.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q),
    );
  }, [data, query]);

  const filteredTokens = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const all = [...data.tokens].sort(
      (a, b) => (b.marketData?.liquidity ?? 0) - (a.marketData?.liquidity ?? 0),
    );
    if (!q) return all;
    return all.filter(
      (t) =>
        t.metadata?.symbol?.toLowerCase().includes(q) ||
        t.metadata?.name?.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q),
    );
  }, [data, query]);

  const filteredSpreads = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.spreads;
    return data.spreads.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.mint.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="dot" />
          <h1>Cookie Chain Liquidity Lens</h1>
        </div>
        <div className="chain-status">
          <span className={`live ${slot === null ? 'off' : ''}`} />
          {slot === null ? 'RPC unreachable' : `slot ${slot.toLocaleString('en-US')}`}
          {data && <span className="cook">COOK {formatUsd(data.cookUsd)}</span>}
        </div>
      </header>

      {error && (
        <div className="banner error">
          <strong>Could not load data.</strong> {error}
          <p>The public endpoint occasionally resets connections; reload to retry.</p>
        </div>
      )}

      {!data && !error && <div className="banner">Loading token and market data...</div>}

      {data && stats && (
        <>
          <section className="stats">
            <Stat label="Tokens" value={formatCount(stats.tokens)} />
            <Stat label="Markets" value={formatCount(stats.markets)} />
            <Stat
              label={`Tradeable (> ${formatUsd(TRADEABLE_USD)})`}
              value={formatCount(stats.tradeable)}
              tone={stats.tradeable < stats.markets / 10 ? 'warn' : undefined}
            />
            <Stat label="Total liquidity" value={formatUsd(stats.totalLiquidity)} />
            <Stat
              label="Actionable spreads"
              value={`${stats.actionable} / ${stats.spreads}`}
              tone={stats.actionable === 0 ? 'warn' : undefined}
            />
          </section>

          <div className="controls">
            <div className="tabs">
              <TabButton id="markets" tab={tab} setTab={setTab}>
                Markets
              </TabButton>
              <TabButton id="tokens" tab={tab} setTab={setTab}>
                Tokens
              </TabButton>
              <TabButton id="spreads" tab={tab} setTab={setTab}>
                Price comparison
              </TabButton>
            </div>
            <input
              className="search"
              placeholder="Filter by symbol, name or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {tab === 'markets' && <MarketsTable rows={filteredMarkets} />}
          {tab === 'tokens' && (
            <TokensTable rows={filteredTokens.slice(0, 300)} total={filteredTokens.length} />
          )}
          {tab === 'spreads' && <SpreadsTable rows={filteredSpreads} />}

          <footer>
            <span>
              {formatCount(
                tab === 'markets'
                  ? filteredMarkets.length
                  : tab === 'tokens'
                    ? filteredTokens.length
                    : filteredSpreads.length,
              )}{' '}
              rows
            </span>
            <span>fetched {data.fetchedAt.toLocaleTimeString()} - source api.cookiescan.io</span>
          </footer>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function TabButton({
  id,
  tab,
  setTab,
  children,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  children: ReactNode;
}) {
  return (
    <button className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
      {children}
    </button>
  );
}

function MarketsTable({ rows }: { rows: MarketView[] }) {
  if (!rows.length) return <p className="empty">No markets match.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Pair</th>
          <th>Type</th>
          <th className="num">Liquidity</th>
          <th className="num">Base price</th>
          <th>State</th>
          <th>Market</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.marketId}>
            <td className="pair">
              {m.baseToken?.symbol ?? '?'} / {m.quoteToken?.symbol ?? '?'}
            </td>
            <td className="dim">{m.type}</td>
            <td className="num">{formatUsd(m.liquidity)}</td>
            <td className="num">{formatUsd(m.impliedBaseUsd)}</td>
            <td>
              <span className={m.tradeable ? 'pill ok' : 'pill warn'}>
                {m.tradeable ? 'tradeable' : 'illiquid'}
              </span>
            </td>
            <td className="mono dim">{m.marketId.slice(0, 8)}...</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TokensTable({ rows, total }: { rows: Token[]; total: number }) {
  if (!rows.length) return <p className="empty">No tokens match.</p>;
  return (
    <>
      {total > rows.length && (
        <p className="note">
          Showing the {rows.length} most liquid of {formatCount(total)} matches.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th className="num">Price</th>
            <th className="num">24h</th>
            <th className="num">Liquidity</th>
            <th className="num">Market cap</th>
            <th className="num">Holders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const liq = t.marketData?.liquidity ?? 0;
            const mcap = t.marketData?.marketCap ?? 0;
            // A market cap orders of magnitude above liquidity is the shape of
            // a token that cannot actually be sold.
            const thin = mcap > 0 && liq / mcap < 0.001;
            return (
              <tr key={t.mint}>
                <td>
                  <div className="token">
                    <span className="sym">{t.metadata?.symbol ?? '?'}</span>
                    <span className="dim">{t.metadata?.name ?? ''}</span>
                  </div>
                </td>
                <td className="num">{formatUsd(t.price?.usd)}</td>
                <td className={`num ${(t.price?.change24h ?? 0) < 0 ? 'down' : 'up'}`}>
                  {t.price?.change24h ? `${t.price.change24h.toFixed(2)}%` : '-'}
                </td>
                <td className="num">{formatUsd(liq)}</td>
                <td className="num">
                  {formatUsd(mcap)}{' '}
                  {thin && (
                    <span className="flag" title="Liquidity is under 0.1% of market cap">
                      thin
                    </span>
                  )}
                </td>
                <td className="num">{formatCount(t.marketData?.holderCount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function SpreadsTable({ rows }: { rows: SpreadView[] }) {
  if (!rows.length) return <p className="empty">No token is listed on more than one market.</p>;
  const actionable = rows.filter((r) => r.actionable).length;
  return (
    <>
      <div className="banner explain">
        <strong>Why most of these are not opportunities.</strong>
        <p>
          An abandoned pool keeps whatever price it last traded at, so comparing raw prices across
          every market produces enormous spreads that cannot be captured. A row is only marked{' '}
          <span className="pill ok">actionable</span> when at least two markets holding over{' '}
          {formatUsd(TRADEABLE_USD)} of liquidity disagree. Of {rows.length} rows here,{' '}
          <strong>{actionable}</strong> qualify.
        </p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th className="num">Spread</th>
            <th className="num">Low</th>
            <th className="num">High</th>
            <th className="num">Markets</th>
            <th className="num">Tradeable</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.mint}>
              <td className="pair">{s.symbol}</td>
              <td className="num strong">{s.spreadPct.toFixed(1)}%</td>
              <td className="num">{formatUsd(s.minUsd)}</td>
              <td className="num">{formatUsd(s.maxUsd)}</td>
              <td className="num">{s.markets}</td>
              <td className="num">{s.tradeableMarkets}</td>
              <td>
                <span className={s.actionable ? 'pill ok' : 'pill dim'}>
                  {s.actionable ? 'actionable' : 'illiquidity artifact'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
