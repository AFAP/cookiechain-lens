# Submission text — Cookie Chain Liquidity Lens

For the Superteam Earn bounty **"Create an App on Cookie Chain"**.

Paste into the submission form. Links are final.

---

## Project

**Cookie Chain Liquidity Lens** — a liquidity-aware market explorer for Cookie Chain.

- **Live app:** https://afap.github.io/cookiechain-lens/
- **Repository:** https://github.com/AFAP/cookiechain-lens
- **Stack:** React 19 + TypeScript + Vite, static bundle, no backend

---

## The problem it solves

Cookie Chain has **6,541 tokens but only 169 markets**, and the entire market layer holds
about **$5.9K of liquidity**. Most of those markets are empty.

That single fact breaks the obvious app. If you compare a token's price across every
market and rank by spread — the natural thing to build — you get a screen full of enormous
opportunities that cannot be captured:

| Token | Spread | Markets listing it | Markets above $100 liquidity |
| --- | --- | --- | --- |
| SKIBIDI | **446.5%** | 4 | **0** |
| anh | 179.2% | 2 | 0 |
| BILLI | 70.3% | 10 | 0 |
| TRASHCOIN | 92.4% | 10 | **2** |
| bCOOK | 38.0% | 12 | **2** |

The largest spread on the whole chain is a 446% "opportunity" on markets that hold
nothing. An abandoned pool keeps whatever price it last traded at, so a raw price
comparison is not merely noisy — it is actively misleading, and it is the first thing a
naive explorer will show you.

## What the app does instead

It separates **a price** from **a tradeable price**:

- Every one of the 169 markets is labelled `tradeable` or `illiquid` against a $100
  liquidity floor, and sorted by liquidity.
- The cross-market price comparison reports how many of a token's markets clear that
  floor, and marks a row `actionable` **only when at least two do**. Rows that do not are
  kept and labelled `illiquidity artifact` — seeing them is the point.
- Tokens whose market cap exceeds 1000x their liquidity are flagged `thin` in the token
  list.

**On live data this reduces 7 apparent spreads to 2 real ones.** The two that survive —
TRASHCOIN (92.4%) and bCOOK (38.0%) — each have exactly two markets above the floor.

## Views

**Markets** — all 169, sorted by liquidity, with venue type (COOKIESWAP CPAMM,
COOKIEBOX DAMM, METEORA DAMM, …), base price and a tradeable badge.

**Tokens** — all 6,541, sorted by liquidity, with price, 24h change, market cap, holder
count and a `thin` flag.

**Price comparison** — the cross-market view described above.

The header polls the Cookie Chain RPC every 10 seconds for the current slot, so the
chain's liveness is visible rather than asserted. On the screenshot run the slot was
26,388,532 and COOK traded at $7.81e-5.

## Screenshots

- Markets view: https://github.com/AFAP/cookiechain-lens/blob/main/docs/screenshots/markets.png
- Price comparison view: https://github.com/AFAP/cookiechain-lens/blob/main/docs/screenshots/spreads.png

## How it uses Cookie Chain

| Source | Used for |
| --- | --- |
| `https://api.cookiescan.io/api/tokens` | 6,541 tokens — price, market cap, liquidity, holder count |
| `https://api.cookiescan.io/api/markets` | 169 markets — both legs, liquidity, USD prices |
| `https://rpc.cookiescan.io` | current slot via `getSlot` |

The browser talks to Cookie Chain directly — no proxy, no backend, no API key. Everything
the app shows is public chain data, which is why it can be a static bundle and why it
needs no COOK to run.

## Build

```bash
npm install
npm run build      # -> dist/
npm run dev        # local development
```

`VITE_BASE` sets the asset base path (defaults to `/cookiechain-lens/`).

## Design notes

**The derivation is the product.** `deriveMarketViews` and `deriveSpreads` in
`src/lib/cookiechain.ts` contain all the judgement — the liquidity floor, the
`actionable` rule, the `thin` flag. The React components only render. That is where a
reviewer should look.

**Retries, not error pages.** The public endpoint occasionally resets a connection, so
every request retries up to four times with backoff. A transient reset should not leave
the user staring at a dead page.

**No wallet, no key, no token.** The app is useful to someone who is only researching the
chain — which, given the current liquidity, is most of its potential audience.

## What I would do next

- **Historical liquidity.** The API exposes only current state, so the app cannot show
  whether the 2 actionable spreads persist or are themselves transient. A snapshot job
  writing hourly would answer that, and would also give the chain its first liquidity
  time series.
- **Holder concentration.** `holderCount` exists but no distribution; concentration is the
  metric that would let the `thin` flag become a real risk score.
- **New-market watch.** Most of the 6,541 tokens have no market at all. Surfacing the
  moment one appears is the most obviously useful alert this chain could have.

## License

MIT
