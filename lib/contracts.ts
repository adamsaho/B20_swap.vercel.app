import type { Address } from 'viem'

// ── Token ────────────────────────────────────────────────────────────────────
export const ZEEME_ADDRESS = '0xB200000000000000000000C85708B096DD4D6fbA' as Address
export const ZEEME_DECIMALS = 18
export const ZEEME_SYMBOL = 'ZEEME'

// WETH on Base (same address on mainnet + all testnets — it's a predeploy)
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as Address
export const WETH_DECIMALS = 18

// ── Uniswap V3 on Base Sepolia ────────────────────────────────────────────────
export const UNI_FACTORY   = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as Address
export const UNI_ROUTER    = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as Address
export const UNI_NFT_PM    = '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2' as Address

// Fee tiers (bps * 100). 3000 = 0.3%, 10000 = 1%
export const FEE_TIER = 3000   // use 0.3% pool

// ── Minimal ABIs ─────────────────────────────────────────────────────────────
export const erc20Abi = [
  { type:'function', name:'balanceOf',  stateMutability:'view',        inputs:[{name:'',type:'address'}],                                   outputs:[{name:'',type:'uint256'}] },
  { type:'function', name:'decimals',   stateMutability:'view',        inputs:[],                                                           outputs:[{name:'',type:'uint8'}] },
  { type:'function', name:'symbol',     stateMutability:'view',        inputs:[],                                                           outputs:[{name:'',type:'string'}] },
  { type:'function', name:'allowance',  stateMutability:'view',        inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}],outputs:[{name:'',type:'uint256'}] },
  { type:'function', name:'approve',    stateMutability:'nonpayable',  inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{name:'',type:'bool'}] },
] as const

export const wethAbi = [
  ...erc20Abi,
  { type:'function', name:'deposit',  stateMutability:'payable',    inputs:[], outputs:[] },
  { type:'function', name:'withdraw', stateMutability:'nonpayable', inputs:[{name:'wad',type:'uint256'}], outputs:[] },
] as const

export const factoryAbi = [
  { type:'function', name:'getPool',    stateMutability:'view',       inputs:[{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'fee',type:'uint24'}], outputs:[{name:'pool',type:'address'}] },
  { type:'function', name:'createPool', stateMutability:'nonpayable', inputs:[{name:'tokenA',type:'address'},{name:'tokenB',type:'address'},{name:'fee',type:'uint24'}], outputs:[{name:'pool',type:'address'}] },
] as const

export const poolAbi = [
  { type:'function', name:'slot0',              stateMutability:'view', inputs:[], outputs:[{name:'sqrtPriceX96',type:'uint160'},{name:'tick',type:'int24'},{name:'',type:'uint16'},{name:'',type:'uint16'},{name:'',type:'uint16'},{name:'',type:'uint8'},{name:'',type:'bool'}] },
  { type:'function', name:'initialize',         stateMutability:'nonpayable', inputs:[{name:'sqrtPriceX96',type:'uint160'}], outputs:[] },
  { type:'function', name:'liquidity',          stateMutability:'view', inputs:[], outputs:[{name:'',type:'uint128'}] },
  { type:'function', name:'token0',             stateMutability:'view', inputs:[], outputs:[{name:'',type:'address'}] },
  { type:'function', name:'token1',             stateMutability:'view', inputs:[], outputs:[{name:'',type:'address'}] },
] as const

export const nftPmAbi = [
  {
    type:'function', name:'mint', stateMutability:'nonpayable',
    inputs:[{ type:'tuple', components:[
      {name:'token0',type:'address'},{name:'token1',type:'address'},{name:'fee',type:'uint24'},
      {name:'tickLower',type:'int24'},{name:'tickUpper',type:'int24'},
      {name:'amount0Desired',type:'uint256'},{name:'amount1Desired',type:'uint256'},
      {name:'amount0Min',type:'uint256'},{name:'amount1Min',type:'uint256'},
      {name:'recipient',type:'address'},{name:'deadline',type:'uint256'},
    ]}],
    outputs:[{name:'tokenId',type:'uint256'},{name:'liquidity',type:'uint128'},{name:'amount0',type:'uint256'},{name:'amount1',type:'uint256'}],
  },
] as const

export const routerAbi = [
  {
    type:'function', name:'exactInputSingle', stateMutability:'payable',
    inputs:[{ type:'tuple', components:[
      {name:'tokenIn',type:'address'},{name:'tokenOut',type:'address'},{name:'fee',type:'uint24'},
      {name:'recipient',type:'address'},{name:'amountIn',type:'uint256'},
      {name:'amountOutMinimum',type:'uint256'},{name:'sqrtPriceLimitX96',type:'uint160'},
    ]}],
    outputs:[{name:'amountOut',type:'uint256'}],
  },
] as const

// ── Math helpers ──────────────────────────────────────────────────────────────
// encodeSqrtRatioX96: given price = token1/token0, returns sqrt(price) * 2^96
// price here is "how many WETH per ZEEME" (since ZEEME < WETH in address order TBD)
export function encodeSqrtPriceX96(price: bigint, decimals0 = 18, decimals1 = 18): bigint {
  // price is in human units e.g. 0.0001 ETH per ZEEME
  // We work in 1e18-scaled integers to keep precision
  const Q96 = 2n ** 96n
  // sqrt(price) * Q96 — using integer sqrt via Newton's method
  const numerator = price * Q96 * Q96  // we'll sqrt this
  return bigintSqrt(numerator)
}

function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('negative sqrt')
  if (n === 0n) return 0n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) { x = y; y = (x + n / x) / 2n }
  return x
}

// Helper: sqrtPrice for "1 ZEEME = price ETH"
// tokenA=ZEEME (lower addr?), tokenB=WETH — order depends on actual addresses
export function sqrtPriceX96ForPrice(zeemePerEth: number): bigint {
  // price = WETH per ZEEME = 1/zeemePerEth
  // sqrtPrice = sqrt(price) * 2^96
  // We scale: price_scaled = floor(1/zeemePerEth * 1e18)
  const priceScaled = BigInt(Math.floor(1e18 / zeemePerEth))
  const Q96 = 2n ** 96n
  return bigintSqrt(priceScaled * Q96 * Q96 / (10n ** 18n))
}

// Returns ticks for full-range position (Uniswap V3 tick spacing for fee=3000 is 60)
export const TICK_SPACING = 60
export const MIN_TICK = -887220  // nearest multiple of 60 to -887272
export const MAX_TICK =  887220
