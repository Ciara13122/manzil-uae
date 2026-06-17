# Ignyte Submission — Manzil

**Title:** Manzil — Fractional Home Ownership on Arc
**Short description:** UAE expats own a home share-by-share, fund the deposit cross-border, pay in milestone installments, and let an AI agent auto-pay — all settled in USDC on Arc, with a built-in DeFi suite (swap, earn, liquidity, bridge).

**Track(s) submitted for:** All four — (1) Cross-Border Payments & Remittances, (2) SME Trade Finance & Working Capital, (3) Real-World Asset Tokenization with Embedded Compliance, (4) Agentic Economy.

**Circle Developer Account email:** parkerespinal61131@gmail.com

**Circle products used on Arc:**
- [x] USDC — native settlement, escrow, payouts
- [x] Wallets — connect / embedded wallet (App ID `576745b9-…`)
- [x] Gateway — unified USDC balance for the Bridge tab
- [x] CCTP / Bridge Kit — cross-chain USDC (Arc → Base/Eth Sepolia, Avax Fuji) via Arc App Kit
- [x] Nanopayments — agent autopay (x402, sub-cent) — conceptual
- [x] USYC — idle-treasury yield (Installments/Earn) — conceptual (gated)
- [x] StableFX — corridor FX in Deposit — conceptual (gated)

**Functional MVP:** Frontend (Next.js + wagmi) + backend = on-chain `Manzil.sol` smart contract on Arc testnet (`0xa83EDCE49cC054E6c97510F142c810ed92Ea5ab0`). Architecture diagram: `architecture.svg`.

**Demo app URL:** https://manzil-uae.netlify.app
**GitHub:** https://github.com/Ciara13122/manzil-uae (README has setup + Circle integration details)
**Video demo + slides:** (to be recorded)

## Circle Product Feedback
**Why these products:** USDC as native gas on Arc makes a dollar-denominated property UX trivial (predictable ~$0.01 fees). App Kit Bridge abstracts CCTP burn/mint so cross-border deposits feel instant. Gateway's unified balance removes per-chain balance juggling for the bridge step. Nanopayments fits the agent that auto-pays monthly installments.
**What worked well:** Bridge Kit testnet quickstart; deterministic finality on Arc; viem/wagmi compatibility.
**What could improve:** unified-balance testnet chain identifiers are easy to get wrong (`Ethereum_Sepolia` vs `Eth_Sepolia`); the bridge should auto-add the destination chain to the wallet (we patch this manually); gated tools (USYC/StableFX) need a self-serve sandbox so hackathon teams can integrate beyond concept.
**Recommendations:** ship typed chain-id enums in the SDK; a one-call "deposit + bridge" helper; clearer faucet links for destination-chain gas.
