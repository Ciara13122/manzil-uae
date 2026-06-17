"use client";
/* Manzil — fractional home ownership + full DeFi on Arc (Ignyte/Circle×Arc, dapp T-T1). All UI English.
   8 tabs: Homes(RWA) · Deposit(cross-border) · Installments(escrow) · Autopay(agentic)
   + Swap · Earn · Liquidity(add/remove) · Bridge(App Kit + KIT_KEY). Bespoke code, themed ivory/emerald/gold.
   Contract = Manzil.sol (themed + AMM/earn). USDC native, EURC ERC20 6dec. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, parseUnits, formatUnits, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const EURC = (process.env.NEXT_PUBLIC_EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a") as `0x${string}`;
const ED = Number(process.env.NEXT_PUBLIC_EURC_DECIMALS || "6");
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "listHome", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "pricePerShare", type: "uint256" }, { name: "totalShares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "buyShares", type: "function", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }, { name: "qty", type: "uint256" }], outputs: [] },
  { name: "getHome", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "issuer", type: "address" }, { name: "name", type: "string" }, { name: "price", type: "uint256" }, { name: "total", type: "uint256" }, { name: "sold", type: "uint256" }] }] },
  { name: "homeCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "openPlan", type: "function", stateMutability: "payable", inputs: [{ name: "payee", type: "address" }, { name: "memo", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "releasePlan", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "refundPlan", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "getPlan", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "buyer", type: "address" }, { name: "payee", type: "address" }, { name: "memo", type: "string" }, { name: "amount", type: "uint256" }, { name: "status", type: "uint8" }] }] },
  { name: "planCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "enableAutopay", type: "function", stateMutability: "payable", inputs: [{ name: "provider", type: "address" }], outputs: [] },
  { name: "chargeInstallment", type: "function", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "string" }], outputs: [] },
  { name: "autopayBalance", type: "function", stateMutability: "view", inputs: [{ name: "provider", type: "address" }, { name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "quote", type: "function", stateMutability: "view", inputs: [{ name: "u", type: "bool" }, { name: "a", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "reserves", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "usdc", type: "uint256" }, { name: "eurc", type: "uint256" }, { name: "lp", type: "uint256" }] },
  { name: "lpOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "swapUsdcToEurc", type: "function", stateMutability: "payable", inputs: [{ name: "minOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "swapEurcToUsdc", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amountIn", type: "uint256" }, { name: "minOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "addLiquidity", type: "function", stateMutability: "payable", inputs: [{ name: "eurcAmt", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "removeLiquidity", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lp", type: "uint256" }], outputs: [] },
  { name: "earnDeposit", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "earnWithdraw", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "earnBalanceOf", type: "function", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "earnApyBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const ERC = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COR = [{ p: "AED → USDC", n: "United Arab Emirates", r: 0.2723 }, { p: "GBP → USDC", n: "United Kingdom", r: 1.27 }, { p: "INR → USDC", n: "India", r: 0.012 }, { p: "EUR → USDC", n: "Europe", r: 1.08 }];
const COV = ["🏙️", "🏡", "🏢", "🏠", "🌇", "🏘️"];
const PST = ["● in escrow", "● released", "● refunded"];
const CHAINS = ["Base Sepolia", "Ethereum Sepolia", "Avalanche Fuji"];
const CHAIN_ID: Record<string, string> = { "Base Sepolia": "Base_Sepolia", "Ethereum Sepolia": "Ethereum_Sepolia", "Avalanche Fuji": "Avalanche_Fuji" };
const DEST_PARAMS: Record<string, any> = {
  "Base Sepolia": { chainId: "0x14a34", chainName: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://sepolia.base.org"], blockExplorerUrls: ["https://sepolia.basescan.org"] },
  "Ethereum Sepolia": { chainId: "0xaa36a7", chainName: "Ethereum Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"] },
  "Avalanche Fuji": { chainId: "0xa869", chainName: "Avalanche Fuji", nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 }, rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"], blockExplorerUrls: ["https://testnet.snowtrace.io"] },
};
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const TABS: [string, string][] = [["homes", "Homes"], ["deposit", "Deposit"], ["plans", "Installments"], ["autopay", "Autopay"], ["swap", "Swap"], ["earn", "Earn"], ["pool", "Liquidity"], ["bridge", "Bridge"]];
const CSS = `
.mz{--bg:#f7f4ec;--card:#fffdf8;--bd:#e9e1cd;--bd2:#ddd3ba;--mut:#7c8a82;--ink:#1c2a24;--green:#0f3d2e;--green2:#155c44;--gold:#b8923f;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.mz *{box-sizing:border-box}.mz a{color:var(--green2);text-decoration:none}.mz .serif{font-family:Georgia,'Times New Roman',serif}
.mz header{display:flex;align-items:center;gap:14px;padding:15px 6vw;border-bottom:1px solid #eae3d0;background:var(--card);flex-wrap:wrap}
.mz .logo{display:flex;align-items:center;gap:10px;font-family:Georgia,serif;font-weight:700;font-size:18px}
.mz .mark{width:34px;height:34px;border-radius:9px;background:var(--green);color:var(--gold);display:grid;place-items:center;font-family:Georgia,serif;font-weight:700;font-size:18px}
.mz .nav{display:flex;gap:2px;flex-wrap:wrap}
.mz .nav button{border:0;background:none;color:var(--mut);font:inherit;font-weight:600;font-size:13px;padding:6px 12px;cursor:pointer;border-bottom:2px solid transparent}
.mz .nav button.on{color:var(--green);border-bottom-color:var(--green)}
.mz .btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;padding:9px 16px;transition:.15s}.mz .btn:disabled{opacity:.5;cursor:not-allowed}
.mz .pri{background:var(--green);color:var(--card)}.mz .pri:hover:not(:disabled){background:var(--green2)}.mz .gho{background:var(--card);color:var(--green);border:1px solid var(--bd2)}.mz .red{background:#b3402e;color:#fff}
.mz .wrap{max-width:1040px;margin:0 auto;padding:24px 6vw 60px}
.mz .eyebrow{font-size:12px;color:var(--gold);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.mz h1{font-family:Georgia,serif;font-size:clamp(24px,4vw,32px);font-weight:600;margin:4px 0 20px}
.mz .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.mz .home{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden}
.mz .cov{height:118px;display:grid;place-items:center;font-size:44px}
.mz .hb{padding:14px}
.mz .bar{height:7px;background:#eee6d4;border-radius:99px;overflow:hidden;margin:6px 0 10px}
.mz .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px}
.mz label{display:block;font-size:12px;color:var(--mut);font-weight:600;margin:8px 0 5px}
.mz input,.mz select{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:var(--ink);outline:none}.mz input:focus,.mz select:focus{border-color:var(--green)}
.mz .out{background:var(--green);color:var(--card);border-radius:12px;padding:14px;margin:12px 0}
.mz .row{background:var(--card);border:1px solid var(--bd);border-radius:13px;padding:13px 15px;display:flex;align-items:center;gap:12px;margin-bottom:9px}
.mz .chip{font-size:11px;color:var(--mut);border:1px solid var(--bd2);border-radius:99px;padding:3px 10px}
.mz .menu{position:absolute;right:0;top:115%;background:var(--card);border:1px solid var(--bd);border-radius:11px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(28,42,36,.16)}
.mz .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--ink);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:8px;cursor:pointer}.mz .menu button:hover{background:var(--bg)}
.mz .grid2{display:grid;grid-template-columns:1fr 330px;gap:18px;align-items:start}
.mz .swapbox{max-width:440px;margin:0 auto}.mz .tok{background:var(--bg);border:1px solid var(--bd2);border-radius:14px;padding:14px}
.mz .stat{flex:1;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px;text-align:center}
@media(max-width:780px){.mz .grid2{grid-template-columns:1fr}}
`;
function Home({ id, busy, buy }: { id: bigint; busy: boolean; buy: (id: bigint, qty: bigint, v: bigint) => void }) {
  const { data } = useReadContract({ address: C, abi: ABI, functionName: "getHome", args: [id] });
  const [qty, setQty] = useState("1"); if (!data) return null; const x = data as any;
  const left = Number(x.total) - Number(x.sold); const pct = Number(x.total) > 0 ? Math.round(Number(x.sold) / Number(x.total) * 100) : 0; const i = Number(id) % COV.length;
  return (
    <div className="home">
      <div className="cov" style={{ background: i % 2 ? "linear-gradient(135deg,#e3d2b5,#c9b48c)" : "linear-gradient(135deg,#cdd9cf,#9fb3a4)" }}>{COV[i]}</div>
      <div className="hb">
        <div style={{ fontWeight: 700 }}>{x.name || `Home #${id}`}</div>
        <div style={{ fontSize: 12.5, color: "var(--mut)", margin: "2px 0 8px" }}>Tokenized deed · {cut(x.issuer)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mut)" }}><span>${usd(x.price)} / share</span><span>{pct}% funded</span></div>
        <div className="bar"><div style={{ width: pct + "%", height: "100%", background: i % 2 ? "var(--gold)" : "var(--green)" }} /></div>
        <div style={{ display: "flex", gap: 8 }}><input value={qty} onChange={e => setQty(e.target.value)} type="number" style={{ width: 70 }} /><button className="btn pri" style={{ flex: 1 }} disabled={busy || !(Number(qty) > 0) || left <= 0} onClick={() => buy(id, BigInt(qty || "0"), x.price * BigInt(qty || "0"))}>{left <= 0 ? "Sold out" : busy ? "…" : `Buy · $${usd(x.price * BigInt(qty || "0"))}`}</button></div>
      </div>
    </div>
  );
}
function Plan({ id, me, busy, w }: { id: bigint; me?: string; busy: boolean; w: (fn: string, a: any[]) => void }) {
  const { data } = useReadContract({ address: C, abi: ABI, functionName: "getPlan", args: [id] });
  if (!data) return null; const x = data as any; const isB = me?.toLowerCase() === x.buyer.toLowerCase(); const isP = me?.toLowerCase() === x.payee.toLowerCase();
  const col = ["var(--gold)", "var(--green2)", "#9aa"][x.status] || "var(--gold)";
  return (
    <div className="row">
      <div style={{ width: 36, height: 36, borderRadius: 9, background: "#eef3ee", display: "grid", placeItems: "center" }}>📑</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{x.memo || `Plan #${id}`}</div><div style={{ fontSize: 11.5, color: "var(--mut)" }}>${usd(x.amount)} · {cut(x.buyer)} → {cut(x.payee)}</div></div>
      <span style={{ fontSize: 11, color: col, fontWeight: 600 }}>{PST[x.status]}</span>
      {x.status === 0 && isB && <button className="btn pri" style={{ padding: "6px 12px", fontSize: 12 }} disabled={busy} onClick={() => w("releasePlan", [id])}>Release</button>}
      {x.status === 0 && isP && <button className="btn gho" style={{ padding: "6px 12px", fontSize: 12 }} disabled={busy} onClick={() => w("refundPlan", [id])}>Refund</button>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState("homes");
  const [nh, setNh] = useState({ name: "", price: "", shares: "" });
  const [dep, setDep] = useState({ to: "", amount: "", cor: "AED → USDC" });
  const [pl, setPl] = useState({ payee: "", memo: "", amount: "" });
  const [ap, setAp] = useState({ provider: "", amount: "" }); const [ch, setCh] = useState({ user: "", amount: "", memo: "Monthly installment" });
  const [u2e, setU2e] = useState(true); const [samt, setSamt] = useState("");
  const [addU, setAddU] = useState(""); const [addE, setAddE] = useState(""); const [rmLp, setRmLp] = useState("");
  const [edep, setEdep] = useState("");
  const [br, setBr] = useState({ to: "", amount: "", chain: "Base Sepolia" }); const [bst, setBst] = useState("");
  const [ubBal, setUbBal] = useState<string | null>(null); const [ubDep, setUbDep] = useState(""); const [ubBusy, setUbBusy] = useState(false);
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const send = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: send.data, query: { enabled: !!send.data } });
  const busy = tx.isPending || rcpt.isLoading; const sbusy = send.isPending || srcpt.isLoading;
  const hc = useReadContract({ address: C, abi: ABI, functionName: "homeCount" });
  const pc = useReadContract({ address: C, abi: ABI, functionName: "planCount" });
  const abal = useReadContract({ address: C, abi: ABI, functionName: "autopayBalance", args: address && isAddress(ap.provider) ? [ap.provider as `0x${string}`, address] : undefined, query: { enabled: !!address && isAddress(ap.provider) } });
  const res = useReadContract({ address: C, abi: ABI, functionName: "reserves", query: { refetchInterval: 9000 } });
  const lp = useReadContract({ address: C, abi: ABI, functionName: "lpOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const apy = useReadContract({ address: C, abi: ABI, functionName: "earnApyBps" });
  const ebal = useReadContract({ address: C, abi: ABI, functionName: "earnBalanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const alw = useReadContract({ address: EURC, abi: ERC, functionName: "allowance", args: address ? [address, C] : undefined, query: { enabled: !!address } });
  const natBal = useBalance({ address, query: { enabled: !!address } });
  const eurcBal = useReadContract({ address: EURC, abi: ERC, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });
  const [wchain, setWchain] = useState<string | null>(null);
  useEffect(() => {
    const e = (window as any).ethereum; if (!e) return;
    e.request({ method: "eth_chainId" }).then((c: string) => setWchain(c)).catch(() => {});
    const h = (c: string) => setWchain(c); e.on?.("chainChanged", h); return () => e.removeListener?.("chainChanged", h);
  }, []);
  const inUnits = u2e ? (() => { try { return parseEther(samt || "0"); } catch { return 0n; } })() : (() => { try { return parseUnits(samt || "0", ED); } catch { return 0n; } })();
  const out = useReadContract({ address: C, abi: ABI, functionName: "quote", args: [u2e, inUnits], query: { enabled: inUnits > 0n } });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setNh({ name: "", price: "", shares: "" }); setPl({ payee: "", memo: "", amount: "" }); setAp({ provider: "", amount: "" }); setCh({ user: "", amount: "", memo: "Monthly installment" }); setSamt(""); setAddU(""); setAddE(""); setRmLp(""); setEdep(""); hc.refetch(); pc.refetch(); res.refetch(); lp.refetch(); ebal.refetch(); alw.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { send.reset(); setDep(d => ({ ...d, to: "", amount: "" })); setBr(b => ({ ...b, to: "", amount: "" })); setBst("✓ Bridged via Circle CCTP"); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN;
  const wrongNet = wchain !== null && wchain.toLowerCase() !== HEX.toLowerCase();
  const swapBal = u2e ? (natBal.data ? Number(formatEther(natBal.data.value)) : 0) : (eurcBal.data !== undefined ? Number(formatUnits(eurcBal.data as bigint, ED)) : 0);
  const nh2 = hc.data !== undefined ? Number(hc.data) : 0; const np = pc.data !== undefined ? Number(pc.data) : 0;
  const w = (fn: string, a: any[], v?: bigint) => tx.writeContract({ address: C, abi: ABI, functionName: fn as any, args: a, value: v });
  const cor = COR.find(c => c.p === dep.cor); const depOut = cor && Number(dep.amount) > 0 ? (Number(dep.amount) * cor.r).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";
  const r = res.data as readonly [bigint, bigint, bigint] | undefined;
  const outFmt = out.data === undefined ? "0" : u2e ? Number(formatUnits(out.data as bigint, ED)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(formatEther(out.data as bigint)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const minOut = out.data === undefined ? 0n : (out.data as bigint) * 99n / 100n;
  const swapNeedApprove = !u2e && inUnits > 0n && (alw.data === undefined || (alw.data as bigint) < inUnits);
  const addE_u = (() => { try { return parseUnits(addE || "0", ED); } catch { return 0n; } })();
  const addNeedApprove = addE_u > 0n && (alw.data === undefined || (alw.data as bigint) < addE_u);
  const apyPct = apy.data === undefined ? "—" : (Number(apy.data) / 100).toFixed(1);
  function doSwap() {
    if (swapNeedApprove) return tx.writeContract({ address: EURC, abi: ERC, functionName: "approve", args: [C, inUnits] });
    if (u2e) w("swapUsdcToEurc", [minOut], inUnits); else w("swapEurcToUsdc", [inUnits, minOut]);
  }
  function doAdd() {
    if (addNeedApprove) return tx.writeContract({ address: EURC, abi: ERC, functionName: "approve", args: [C, addE_u] });
    w("addLiquidity", [addE_u], (() => { try { return parseEther(addU || "0"); } catch { return 0n; } })());
  }
  async function loadUb() {
    if (!address) return; setUbBusy(true);
    try {
      const { createUnifiedBalanceKitContext, getBalances } = await import("@circle-fin/unified-balance-kit");
      const ctx = createUnifiedBalanceKitContext();
      const res: any = await getBalances(ctx as any, { token: "USDC", sources: { address, chains: ["Arc_Testnet"] }, includePending: true } as any);
      setUbBal(res?.totalConfirmedBalance ?? "0");
    } catch (e: any) { setBst("Balance: " + (e?.shortMessage || e?.message || "App Kit unavailable")); }
    finally { setUbBusy(false); }
  }
  async function depositUb() {
    if (!(Number(ubDep) > 0)) return; setUbBusy(true); setBst("Depositing to unified balance…");
    try {
      const p = (window as any).ethereum;
      const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { createUnifiedBalanceKitContext, deposit: ubDeposit } = await import("@circle-fin/unified-balance-kit");
      const adapter: any = await createViemAdapterFromProvider({ provider: p } as any);
      const ctx = createUnifiedBalanceKitContext();
      await ubDeposit(ctx as any, { from: { adapter, chain: "Arc_Testnet" }, token: "USDC", amount: ubDep } as any);
      setBst("✓ Deposited to unified balance"); setUbDep("");
      for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 5000)); await loadUb(); }
    } catch (e: any) { setBst("Deposit: " + (e?.shortMessage || e?.message || "failed")); }
    finally { setUbBusy(false); }
  }
  useEffect(() => { if (tab === "bridge" && address) loadUb(); }, [tab, address]); // eslint-disable-line
  async function doBridge() {
    if (!isAddress(br.to) || !(Number(br.amount) > 0)) return;
    setBst("Bridging via Circle CCTP / App Kit…");
    try {
      const p = (window as any).ethereum;
      try { await p.request({ method: "wallet_addEthereumChain", params: [DEST_PARAMS[br.chain]] }); } catch {}
      try { await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch {}
      const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { createUnifiedBalanceKitContext, spend } = await import("@circle-fin/unified-balance-kit");
      const adapter: any = await createViemAdapterFromProvider({ provider: p } as any);
      const ctx = createUnifiedBalanceKitContext();
      await spend(ctx as any, { from: { adapter }, to: { adapter, chain: CHAIN_ID[br.chain] || "Base_Sepolia", recipientAddress: br.to, useForwarder: false }, token: "USDC", amount: br.amount } as any);
      setBst(`✓ Bridged to ${br.chain} via Circle CCTP`); setBr(b => ({ ...b, to: "", amount: "" }));
    } catch (e: any) { setBst("Bridge: " + (e?.shortMessage || e?.message || "App Kit unavailable — concept")); }
  }
  return (
    <div className="mz">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">M</span>Manzil</div>
        <div className="nav">{TABS.map(([t, l]) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{l}</button>)}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {(wrong || wrongNet) && <button className="btn red" onClick={toArc}>Switch to Arc</button>}
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#b3402e" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        {tab === "homes" && <>
          <div className="eyebrow">Fractional home ownership · Arc</div><h1>Own a home in the UAE, share by share.</h1>
          <div className="grid2">
            <div className="grid">{nh2 > 0 ? Array.from({ length: nh2 }, (_, i) => BigInt(nh2 - 1 - i)).map(id => <Home key={id.toString()} id={id} busy={busy} buy={(id, q, v) => w("buyShares", [id, q], v)} />) : <div style={{ color: "var(--mut)", padding: "20px 0" }}>No homes listed yet — list one on the right.</div>}</div>
            <div className="card">
              <div className="serif" style={{ fontSize: 17, marginBottom: 4 }}>List a property</div>
              <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Tokenize a deed into shares (RWA) with a compliance whitelist. Rent distributed in USDC.</div>
              <label>Property name</label><input value={nh.name} onChange={e => setNh(s => ({ ...s, name: e.target.value }))} placeholder="Marina Heights · 2BR" />
              <label>Price per share (USDC)</label><input value={nh.price} onChange={e => setNh(s => ({ ...s, price: e.target.value }))} type="number" placeholder="120" />
              <label>Total shares</label><input value={nh.shares} onChange={e => setNh(s => ({ ...s, shares: e.target.value }))} type="number" placeholder="1000" />
              <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !nh.name || !(Number(nh.price) > 0) || !(Number(nh.shares) > 0)} onClick={() => w("listHome", [nh.name, parseEther(nh.price || "0"), BigInt(nh.shares || "0")])}>{busy ? "…" : "Tokenize property"}</button>
            </div>
          </div>
        </>}

        {tab === "deposit" && <>
          <div className="eyebrow">Cross-border · CCTP / Bridge Kit</div><h1>Fund your deposit from anywhere.</h1>
          <div className="grid2">
            <div className="card"><div className="serif" style={{ fontSize: 17, marginBottom: 8 }}>How it works</div><div style={{ fontSize: 13.5, color: "var(--mut)", lineHeight: 1.7 }}>Expats reserve a home by sending a deposit in USDC from their home country. Funds settle on Arc in real time with predictable, dollar-denominated fees. Cross-chain USDC arrives via Circle CCTP; FX is handled by StableFX.</div>
              <div style={{ marginTop: 14 }}>{COR.map(c => <div key={c.p} className="row" style={{ cursor: "pointer", borderColor: dep.cor === c.p ? "var(--green)" : "var(--bd)" }} onClick={() => setDep(d => ({ ...d, cor: c.p }))}><span style={{ flex: 1, fontWeight: 600 }}>{c.p}</span><span style={{ fontSize: 12, color: "var(--mut)" }}>{c.n}</span></div>)}</div></div>
            <div className="card">
              <div className="serif" style={{ fontSize: 17, marginBottom: 6 }}>Send deposit</div>
              <label>Corridor</label><select value={dep.cor} onChange={e => setDep(d => ({ ...d, cor: e.target.value }))}>{COR.map(c => <option key={c.p} value={c.p}>{c.p}</option>)}</select>
              <label>Developer / escrow address</label><input value={dep.to} onChange={e => setDep(d => ({ ...d, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
              <label>Amount you send</label><input value={dep.amount} onChange={e => setDep(d => ({ ...d, amount: e.target.value }))} type="number" placeholder="0.00" />
              <div className="out"><div style={{ fontSize: 11, opacity: .85 }}>Settles as (USDC)</div><div style={{ fontSize: 24, fontWeight: 800 }}>{depOut}</div><div style={{ fontSize: 11, opacity: .85 }}>fee ~$0.01 · real-time finality</div></div>
              <button className="btn pri" style={{ width: "100%" }} disabled={!isConnected || sbusy || !isAddress(dep.to) || !(Number(dep.amount) > 0)} onClick={() => send.sendTransaction({ to: dep.to as `0x${string}`, value: parseEther(dep.amount || "0") })}>{sbusy ? "Settling…" : "Send deposit"}</button>
              {srcpt.isSuccess && <div style={{ fontSize: 12, color: "var(--green2)", textAlign: "center", marginTop: 8 }}>✓ Settled on Arc</div>}
            </div>
          </div>
        </>}

        {tab === "plans" && <>
          <div className="eyebrow">Milestone escrow · USDC</div><h1>Pay your home in installments.</h1>
          <div className="grid2">
            <div><div style={{ fontWeight: 700, marginBottom: 8 }}>Active plans <span className="chip">{np}</span></div>{np > 0 ? Array.from({ length: np }, (_, i) => BigInt(np - 1 - i)).map(id => <Plan key={id.toString()} id={id} me={address} busy={busy} w={w} />) : <div style={{ color: "var(--mut)", padding: "20px 0" }}>No installment plans yet.</div>}</div>
            <div className="card">
              <div className="serif" style={{ fontSize: 17, marginBottom: 4 }}>Open an installment</div>
              <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Funds held in escrow and released to the developer on each milestone. Idle balance can earn yield via USYC.</div>
              <label>Developer (payee)</label><input value={pl.payee} onChange={e => setPl(s => ({ ...s, payee: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
              <label>Memo</label><input value={pl.memo} onChange={e => setPl(s => ({ ...s, memo: e.target.value }))} placeholder="Installment 3 / 12 — Marina Heights" />
              <label>Amount (USDC)</label><input value={pl.amount} onChange={e => setPl(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" />
              <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !isAddress(pl.payee) || !(Number(pl.amount) > 0)} onClick={() => w("openPlan", [pl.payee as `0x${string}`, pl.memo], parseEther(pl.amount || "0"))}>{busy ? "…" : "Fund installment"}</button>
            </div>
          </div>
        </>}

        {tab === "autopay" && <>
          <div className="eyebrow">Agentic · Nanopayments</div><h1>Let an agent pay your installments.</h1>
          <div className="grid2">
            <div className="card"><div className="serif" style={{ fontSize: 17, marginBottom: 6 }}>Enable autopay</div><div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Fund an agent that auto-pays each monthly installment within your budget — gas-free sub-cent settlement via Circle Nanopayments (x402).</div>
              <label>Agent / provider</label><input value={ap.provider} onChange={e => setAp(s => ({ ...s, provider: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
              {isAddress(ap.provider) && abal.data !== undefined && <div style={{ fontSize: 12.5, color: "var(--mut)", margin: "6px 0" }}>Funded budget: <b style={{ color: "var(--green2)" }}>${usd(abal.data as bigint)}</b></div>}
              <label>Budget (USDC)</label><input value={ap.amount} onChange={e => setAp(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" />
              <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !isAddress(ap.provider) || !(Number(ap.amount) > 0)} onClick={() => w("enableAutopay", [ap.provider as `0x${string}`], parseEther(ap.amount || "0"))}>{busy ? "…" : "Enable autopay 🤖"}</button></div>
            <div className="card"><div className="serif" style={{ fontSize: 17, marginBottom: 6 }}>Agent · charge installment</div>
              <label>Homeowner</label><input value={ch.user} onChange={e => setCh(s => ({ ...s, user: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
              <label>Amount (USDC)</label><input value={ch.amount} onChange={e => setCh(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" />
              <label>Memo</label><input value={ch.memo} onChange={e => setCh(s => ({ ...s, memo: e.target.value }))} />
              <button className="btn gho" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !isAddress(ch.user) || !(Number(ch.amount) > 0)} onClick={() => w("chargeInstallment", [ch.user as `0x${string}`, parseEther(ch.amount || "0"), ch.memo])}>{busy ? "…" : "Charge installment"}</button></div>
          </div>
        </>}

        {tab === "swap" && <>
          <div className="eyebrow">DeFi · USDC ⇄ EURC AMM</div><h1>Swap stablecoins on Arc.</h1>
          <div className="swapbox card">
            <div className="tok"><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mut)" }}><span>You pay · {u2e ? "USDC" : "EURC"}</span><span>Balance {swapBal.toLocaleString(undefined, { maximumFractionDigits: 4 })} <button onClick={() => setSamt(String(swapBal))} style={{ border: 0, background: "none", color: "var(--green2)", fontWeight: 700, cursor: "pointer", padding: 0 }}>MAX</button></span></div><input value={samt} onChange={e => setSamt(e.target.value)} type="number" placeholder="0" style={{ border: 0, background: "transparent", fontSize: 24, fontWeight: 800, padding: "4px 0", width: "100%" }} /></div>
            <div style={{ textAlign: "center", margin: "-6px 0" }}><button className="btn gho" style={{ borderRadius: 99, padding: "6px 12px" }} onClick={() => { setU2e(v => !v); setSamt(""); }}>↑↓</button></div>
            <div className="tok"><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mut)" }}><span>You receive</span><span>{u2e ? "EURC" : "USDC"}</span></div><div style={{ fontSize: 24, fontWeight: 800, padding: "4px 0", color: Number(outFmt) ? "var(--ink)" : "var(--mut)" }}>{outFmt}</div></div>
            <div style={{ fontSize: 12, color: "var(--mut)", margin: "10px 0" }}>1% max slippage · 0.3% pool fee</div>
            <button className="btn pri" style={{ width: "100%" }} disabled={!isConnected || busy || !(inUnits > 0n)} onClick={doSwap}>{!isConnected ? "Connect wallet" : busy ? "…" : !(inUnits > 0n) ? "Enter an amount" : swapNeedApprove ? "Approve EURC" : `Swap ${u2e ? "USDC → EURC" : "EURC → USDC"}`}</button>
          </div>
        </>}

        {tab === "earn" && <>
          <div className="eyebrow">DeFi · Yield vault</div><h1>Earn yield on idle USDC.</h1>
          <div className="swapbox card">
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}><div className="stat"><div style={{ fontSize: 12, color: "var(--mut)" }}>APY</div><div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>{apyPct}%</div></div><div className="stat"><div style={{ fontSize: 12, color: "var(--mut)" }}>Your balance</div><div style={{ fontSize: 24, fontWeight: 800 }}>${usd(ebal.data as bigint)}</div></div></div>
            <label>Deposit (USDC)</label><input value={edep} onChange={e => setEdep(e.target.value)} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
            <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !(Number(edep) > 0)} onClick={() => w("earnDeposit", [], (() => { try { return parseEther(edep || "0"); } catch { return 0n; } })())}>{busy ? "…" : `Deposit & earn ${apyPct}%`}</button>
            {ebal.data !== undefined && (ebal.data as bigint) > 0n && <button className="btn gho" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => w("earnWithdraw", [])}>{busy ? "…" : "Withdraw all + interest"}</button>}
            <div style={{ fontSize: 11.5, color: "var(--mut)", textAlign: "center", marginTop: 10 }}>Idle treasury can also route to USYC for institutional yield (concept).</div>
          </div>
        </>}

        {tab === "pool" && <>
          <div className="eyebrow">DeFi · Liquidity</div><h1>Provide liquidity, earn fees.</h1>
          <div className="grid2">
            <div className="card">
              <div className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Add liquidity</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}><div className="stat"><div style={{ fontSize: 11, color: "var(--mut)" }}>Pool USDC</div><div style={{ fontWeight: 800 }}>${r ? Number(formatEther(r[0])).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}</div></div><div className="stat"><div style={{ fontSize: 11, color: "var(--mut)" }}>Pool EURC</div><div style={{ fontWeight: 800 }}>€{r ? Number(formatUnits(r[1], ED)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}</div></div><div className="stat"><div style={{ fontSize: 11, color: "var(--mut)" }}>Your LP</div><div style={{ fontWeight: 800, color: "var(--green)" }}>{lp.data ? Number(formatEther(lp.data as bigint)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}</div></div></div>
              <label>USDC amount</label><input value={addU} onChange={e => setAddU(e.target.value)} type="number" placeholder="0.00" />
              <label>EURC amount</label><input value={addE} onChange={e => setAddE(e.target.value)} type="number" placeholder="0.00" />
              <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !(Number(addU) > 0) || !(addE_u > 0n)} onClick={doAdd}>{busy ? "…" : addNeedApprove ? "Approve EURC" : "Add liquidity"}</button>
            </div>
            <div className="card">
              <div className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Remove liquidity</div>
              <label>LP amount</label><div style={{ display: "flex", gap: 8 }}><input value={rmLp} onChange={e => setRmLp(e.target.value)} type="number" placeholder="0.00" /><button className="btn gho" onClick={() => lp.data && setRmLp(formatEther(lp.data as bigint))}>MAX</button></div>
              <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || busy || !(Number(rmLp) > 0)} onClick={() => w("removeLiquidity", [(() => { try { return parseEther(rmLp || "0"); } catch { return 0n; } })()])}>{busy ? "…" : "Remove liquidity"}</button>
            </div>
          </div>
        </>}

        {tab === "bridge" && <>
          <div className="eyebrow">Cross-chain · Circle CCTP / App Kit</div><h1>Bridge USDC across chains.</h1>
          <div className="swapbox card">
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 10 }}>Move USDC from Arc to another chain via Circle CCTP (burn &amp; mint, no wrapped tokens), powered by Arc App Kit. Deposit into your unified balance first, then bridge.</div>
            <div className="out" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 11, opacity: .85 }}>Unified USDC balance</div><div style={{ fontSize: 22, fontWeight: 800 }}>{ubBal !== null ? `$${ubBal}` : "—"}</div></div><button className="btn gho" style={{ padding: "7px 12px" }} disabled={ubBusy} onClick={loadUb}>{ubBusy ? "…" : "Refresh"}</button></div>
            <label>Deposit to unified balance (USDC)</label>
            <div style={{ display: "flex", gap: 8 }}><input value={ubDep} onChange={e => setUbDep(e.target.value)} type="number" placeholder="0.00" /><button className="btn pri" disabled={!isConnected || ubBusy || !(Number(ubDep) > 0)} onClick={depositUb}>{ubBusy ? "…" : "Deposit"}</button></div>
            <div style={{ borderTop: "1px solid var(--bd)", margin: "14px 0 4px" }} />
            <label>Destination chain</label><select value={br.chain} onChange={e => setBr(b => ({ ...b, chain: e.target.value }))}>{CHAINS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <label>Recipient address</label><input value={br.to} onChange={e => setBr(b => ({ ...b, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
            <label>Amount (USDC)</label><input value={br.amount} onChange={e => setBr(b => ({ ...b, amount: e.target.value }))} type="number" placeholder="0.00" />
            <button className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!isConnected || !isAddress(br.to) || !(Number(br.amount) > 0)} onClick={doBridge}>{`Bridge to ${br.chain} →`}</button>
            {bst && <div style={{ fontSize: 12, color: "var(--green2)", textAlign: "center", marginTop: 8 }}>{bst}</div>}
          </div>
        </>}

        <div style={{ textAlign: "center", color: "#a99", fontSize: 12, marginTop: 28 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc</a> · USDC · Powered by Circle Wallets, CCTP &amp; Gateway</div>
      </div>
    </div>
  );
}
