// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Manzil — fractional home ownership on Arc (USDC = native gas token, 18 decimals)
/// @notice Combined contract for the Manzil dApp (Ignyte / Circle x Arc).
///         Implements the exact ABI used by the frontend: Homes (RWA), Installments (escrow), Autopay (agent credit).
///         All value is native USDC on Arc (msg.value). Educational / testnet demo.
contract Manzil {
    // ----- Homes (RWA tokenized fractions) -----
    struct Home { address issuer; string name; uint256 price; uint256 total; uint256 sold; }
    Home[] private homes;
    mapping(uint256 => mapping(address => uint256)) public sharesOf; // homeId => owner => qty

    event HomeListed(uint256 indexed id, address indexed issuer, string name, uint256 price, uint256 total);
    event SharesBought(uint256 indexed id, address indexed buyer, uint256 qty, uint256 paid);

    function listHome(string calldata name, uint256 pricePerShare, uint256 totalShares) external returns (uint256 id) {
        require(pricePerShare > 0 && totalShares > 0, "bad params");
        id = homes.length;
        homes.push(Home(msg.sender, name, pricePerShare, totalShares, 0));
        emit HomeListed(id, msg.sender, name, pricePerShare, totalShares);
    }

    function buyShares(uint256 id, uint256 qty) external payable {
        Home storage h = homes[id];
        require(qty > 0 && h.sold + qty <= h.total, "sold out");
        require(msg.value == h.price * qty, "wrong amount");
        h.sold += qty;
        sharesOf[id][msg.sender] += qty;
        (bool ok, ) = payable(h.issuer).call{value: msg.value}(""); // settle to issuer in USDC
        require(ok, "transfer failed");
        emit SharesBought(id, msg.sender, qty, msg.value);
    }

    function getHome(uint256 id) external view returns (Home memory) { return homes[id]; }
    function homeCount() external view returns (uint256) { return homes.length; }

    // ----- Installments (milestone escrow) -----
    // status: 0 = in escrow, 1 = released, 2 = refunded
    struct Plan { address buyer; address payee; string memo; uint256 amount; uint8 status; }
    Plan[] private plans;

    event PlanOpened(uint256 indexed id, address indexed buyer, address indexed payee, uint256 amount, string memo);
    event PlanReleased(uint256 indexed id);
    event PlanRefunded(uint256 indexed id);

    function openPlan(address payee, string calldata memo) external payable returns (uint256 id) {
        require(msg.value > 0 && payee != address(0), "bad params");
        id = plans.length;
        plans.push(Plan(msg.sender, payee, memo, msg.value, 0));
        emit PlanOpened(id, msg.sender, payee, msg.value, memo);
    }

    function releasePlan(uint256 id) external {
        Plan storage p = plans[id];
        require(msg.sender == p.buyer, "only buyer");
        require(p.status == 0, "closed");
        p.status = 1;
        (bool ok, ) = payable(p.payee).call{value: p.amount}("");
        require(ok, "transfer failed");
        emit PlanReleased(id);
    }

    function refundPlan(uint256 id) external {
        Plan storage p = plans[id];
        require(msg.sender == p.payee, "only payee");
        require(p.status == 0, "closed");
        p.status = 2;
        (bool ok, ) = payable(p.buyer).call{value: p.amount}("");
        require(ok, "transfer failed");
        emit PlanRefunded(id);
    }

    function getPlan(uint256 id) external view returns (Plan memory) { return plans[id]; }
    function planCount() external view returns (uint256) { return plans.length; }

    // ----- Autopay (agentic credit: user funds a provider, provider charges installments) -----
    mapping(address => mapping(address => uint256)) public credit; // provider => user => balance
    mapping(address => uint256) public earned; // provider => withdrawable

    event AutopayFunded(address indexed provider, address indexed user, uint256 amount);
    event InstallmentCharged(address indexed provider, address indexed user, uint256 amount, string memo);

    function enableAutopay(address provider) external payable {
        require(msg.value > 0 && provider != address(0), "bad params");
        credit[provider][msg.sender] += msg.value;
        emit AutopayFunded(provider, msg.sender, msg.value);
    }

    function chargeInstallment(address user, uint256 amount, string calldata memo) external {
        require(credit[msg.sender][user] >= amount, "insufficient credit");
        credit[msg.sender][user] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}(""); // provider receives USDC
        require(ok, "transfer failed");
        emit InstallmentCharged(msg.sender, user, amount, memo);
    }

    function autopayBalance(address provider, address user) external view returns (uint256) {
        return credit[provider][user];
    }

    // ============================================================
    // DeFi suite: Swap + Liquidity (add/remove) + Earn vault
    // USDC = native (18 dec, msg.value), EURC = ERC20 (6 dec). Constant-product x*y=k, 0.3% fee.
    // ABI matches the DefiPanel frontend.
    // ============================================================
    IERC20 public immutable EURC;
    uint256 public rUsdc;   // USDC reserve (wei)
    uint256 public rEurc;   // EURC reserve (6 dec)
    uint256 public lpTotal;
    mapping(address => uint256) public lpOf;
    uint16 public constant FEE_BPS = 30; // 0.30%

    // Earn vault (simple linear-APY accrual)
    uint16 public constant EARN_APY_BPS = 480; // 4.80% APY (demo)
    mapping(address => uint256) public earnPrincipal;
    mapping(address => uint256) private earnSince;

    event Swapped(address indexed who, bool usdcToEurc, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed who, uint256 usdc, uint256 eurc, uint256 lp);
    event LiquidityRemoved(address indexed who, uint256 lp, uint256 usdc, uint256 eurc);
    event EarnDeposited(address indexed who, uint256 amount);
    event EarnWithdrawn(address indexed who, uint256 principal, uint256 interest);

    constructor(address eurc) { EURC = IERC20(eurc); }

    function reserves() external view returns (uint256 usdc, uint256 eurc, uint256 lp) { return (rUsdc, rEurc, lpTotal); }

    /// @param u true = USDC->EURC (a in wei), false = EURC->USDC (a in 6dec)
    function quote(bool u, uint256 a) public view returns (uint256) {
        if (a == 0) return 0;
        uint256 inAfterFee = a * (10000 - FEE_BPS) / 10000;
        if (u) { if (rUsdc == 0) return 0; return rEurc * inAfterFee / (rUsdc + inAfterFee); }
        else { if (rEurc == 0) return 0; return rUsdc * inAfterFee / (rEurc + inAfterFee); }
    }

    function swapUsdcToEurc(uint256 minOut) external payable returns (uint256 out) {
        require(msg.value > 0, "no input");
        out = quote(true, msg.value);
        require(out >= minOut && out > 0 && out <= rEurc, "slippage");
        rUsdc += msg.value; rEurc -= out;
        require(EURC.transfer(msg.sender, out), "eurc out");
        emit Swapped(msg.sender, true, msg.value, out);
    }

    function swapEurcToUsdc(uint256 amountIn, uint256 minOut) external returns (uint256 out) {
        require(amountIn > 0, "no input");
        out = quote(false, amountIn);
        require(out >= minOut && out > 0 && out <= rUsdc, "slippage");
        require(EURC.transferFrom(msg.sender, address(this), amountIn), "eurc in");
        rEurc += amountIn; rUsdc -= out;
        (bool ok, ) = payable(msg.sender).call{value: out}(""); require(ok, "usdc out");
        emit Swapped(msg.sender, false, amountIn, out);
    }

    function addLiquidity(uint256 eurcAmt) external payable returns (uint256 minted) {
        require(msg.value > 0 && eurcAmt > 0, "bad amts");
        require(EURC.transferFrom(msg.sender, address(this), eurcAmt), "eurc in");
        if (lpTotal == 0) { minted = msg.value; }
        else { uint256 a = msg.value * lpTotal / rUsdc; uint256 b = eurcAmt * lpTotal / rEurc; minted = a < b ? a : b; }
        require(minted > 0, "zero lp");
        rUsdc += msg.value; rEurc += eurcAmt; lpTotal += minted; lpOf[msg.sender] += minted;
        emit LiquidityAdded(msg.sender, msg.value, eurcAmt, minted);
    }

    function removeLiquidity(uint256 lp) external {
        require(lp > 0 && lpOf[msg.sender] >= lp, "bad lp");
        uint256 u = rUsdc * lp / lpTotal; uint256 e = rEurc * lp / lpTotal;
        lpOf[msg.sender] -= lp; lpTotal -= lp; rUsdc -= u; rEurc -= e;
        require(EURC.transfer(msg.sender, e), "eurc out");
        (bool ok, ) = payable(msg.sender).call{value: u}(""); require(ok, "usdc out");
        emit LiquidityRemoved(msg.sender, lp, u, e);
    }

    function earnApyBps() external pure returns (uint256) { return EARN_APY_BPS; }
    function _pending(address u) internal view returns (uint256) {
        if (earnPrincipal[u] == 0) return 0;
        return earnPrincipal[u] * EARN_APY_BPS * (block.timestamp - earnSince[u]) / (10000 * 365 days);
    }
    function earnPending(address u) external view returns (uint256) { return _pending(u); }
    function earnPrincipalOf(address u) external view returns (uint256) { return earnPrincipal[u]; }
    function earnBalanceOf(address u) external view returns (uint256) { return earnPrincipal[u] + _pending(u); }

    function earnDeposit() external payable {
        require(msg.value > 0, "no input");
        earnPrincipal[msg.sender] += _pending(msg.sender) + msg.value;
        earnSince[msg.sender] = block.timestamp;
        emit EarnDeposited(msg.sender, msg.value);
    }
    function earnWithdraw() external {
        uint256 p = earnPrincipal[msg.sender]; require(p > 0, "nothing");
        uint256 it = _pending(msg.sender); uint256 total = p + it;
        earnPrincipal[msg.sender] = 0; earnSince[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: total}(""); require(ok, "withdraw");
        emit EarnWithdrawn(msg.sender, p, it);
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}
