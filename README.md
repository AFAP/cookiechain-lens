# Cookie Chain Liquidity Lens

An analytics cApp for [Cookie Chain](https://cookiescan.io), the community-run SVM chain.

**Live:** https://afap.github.io/cookiechain-lens/

Submitting to the Superteam Earn bounty **"Create an App on Cookie Chain"**.

---

## What it does

Cookie Chain has **6,541 tokens but only 169 markets**, and the whole market layer holds
about **$5.9K of liquidity**. Most of those markets are empty. That single fact changes
what a useful explorer has to do.

The obvious thing to build — compare a token's price across every market and show the
spread — produces a screen full of enormous opportunities that cannot be captured:

| Token | Spread | Markets | Tradeable | |
| --- | --- | --- | --- | --- |
| SKIBIDI | **446.5%** | 4 | **0** | illiquidity artifact |
| anh | 179.2% | 2 | 0 | illiquidity artifact |
| BILLI | 70.3% | 10 | 0 | illiquidity artifact |
| TRASHCOIN | 92.4% | 10 | 2 | **actionable** |
| bCOOK | 38.0% | 12 | 2 | **actionable** |

The biggest spread on the chain is a 446% "opportunity" on a market holding nothing.
An abandoned pool keeps whatever price it last traded at, so a raw price comparison is
not just noisy — it is actively misleading.

So the app's one job is to separate **a price** from **a tradeable price**:

- Every market is labelled `tradeable` or `illiquid` against a $100 liquidity floor.
- The price-comparison view reports how many of a token's markets clear that floor,
  and only marks a row `actionable` when **at least two** do.
- Tokens whose market cap is more than 1000x their liquidity are flagged `thin`.

On the current data that reduces 7 apparent spreads to **2 real ones**.

## Views

**Markets** — all 169, sorted by liquidity, with type (COOKIESWAP CPAMM / COOKIEBOX DAMM /
…), base price and a tradeable badge.

**Tokens** — all 6,541, sorted by liquidity, with price, 24h change, market cap, holder
count and a `thin` flag.

**Price comparison** — the cross-market spread view described above.

The header polls the RPC every 10s for the current slot, so the chain's liveness is
visible rather than asserted.

## Data sources

Both are public, read-only and need no key, so the whole app is a static bundle:

| Source | Used for |
| --- | --- |
| `https://api.cookiescan.io/api/tokens` | 6,541 tokens with price, market cap, liquidity, holders |
| `https://api.cookiescan.io/api/markets` | 169 markets with both legs, liquidity and USD prices |
| `https://rpc.cookiescan.io` | current slot (`getSlot`) |

Nothing is proxied through a server of mine; the browser talks to Cookie Chain directly.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
```

`VITE_BASE` sets the asset base path (defaults to `/cookiechain-lens/` for GitHub Pages).

## Design notes

**No backend, no key, no wallet.** Everything the app shows is public chain data. It needs
no COOK to run, which is why it can be a static bundle.

**Retry on fetch.** The public endpoint occasionally resets a connection; every request
retries up to 4 times with backoff rather than showing a dead page.

**The derivation is the product.** `deriveMarketViews` and `deriveSpreads` in
`src/lib/cookiechain.ts` hold all the judgement; the components only render. That is where
a reviewer should look.

## License

MIT
