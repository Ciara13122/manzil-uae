# Manzil — Fractional Home Ownership on Arc

Stablecoin Commerce Stack submission (Ignyte × Circle × Arc). Manzil lets UAE expats **own a home share-by-share**, fund deposits cross-border, pay in installments, and let an agent auto-pay — all settled in **USDC on Arc**.

**Live:** https://manzil-uae.netlify.app
**Contract (Arc testnet):** `0xa83EDCE49cC054E6c97510F142c810ed92Ea5ab0`

## Tracks covered (all 4)
| Tab | Track | What it does |
|-----|-------|--------------|
| Homes | RWA Tokenization + Compliance | Tokenize a property deed into fractional shares (whitelist-ready), buy shares, rent in USDC |
| Deposit | Cross-Border Payments & Remittances | Reserve a home with a USDC deposit from any corridor (AED/GBP/INR/EUR), real-time settlement |
| Installments | SME Trade Finance (Escrow/Settlement) | Milestone escrow released to the developer; idle float can route to USYC yield |
| Autopay | Agentic Economy | Fund an agent that auto-pays monthly installments (Nanopayments / x402, sub-cent) |

Plus a full DeFi suite: **Swap** (USDC⇄EURC AMM), **Earn** (yield vault), **Liquidity** (add/remove), **Bridge** (Circle CCTP / Arc App Kit → Base Sepolia / Ethereum Sepolia / Avalanche Fuji).

## Circle products used
USDC (native settlement) · Circle Wallets · CCTP / Bridge Kit (Arc App Kit) · Gateway (unified balance for Bridge) · Nanopayments (agent autopay, concept) · USYC & StableFX (treasury yield / FX, conceptual integration — gated).

## Stack
Next.js 16 (static export) · wagmi + viem · Solidity ^0.8.20. Arc testnet: chainId 5042002, RPC `https://rpc.testnet.arc.network`, USDC = native gas, EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`.

## Run
```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_CONTRACT_ADDRESS etc.
npm run dev
```
`contracts/Manzil.sol` — deploy on Arc (constructor arg = EURC address), then set `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Circle Product Feedback
- **Why these products:** USDC native gas on Arc makes dollar-denominated UX trivial; App Kit Bridge abstracts CCTP burn/mint cleanly; Gateway unified balance simplifies cross-chain spend.
- **Worked well:** Bridge Kit testnet quickstart; predictable USDC fees on Arc.
- **Could improve:** clearer testnet chain identifiers for Unified Balance (e.g. `Ethereum_Sepolia` vs `Eth_Sepolia`); auto-add destination chain on bridge; gated tools (USYC/StableFX) need a sandbox path for hackathons.

Built on Arc · USDC · Circle.
