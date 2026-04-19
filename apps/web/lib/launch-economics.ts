/** Fixed platform surcharge on every launch (separate `SystemProgram.transfer`). */
const DEFAULT_PLATFORM_SURCHARGE_LAMPORTS = 50_000_000; // 0.05 SOL

/**
 * Override with `LAUNCH_PLATFORM_SURCHARGE_LAMPORTS` (lamports). Default 0.05 SOL.
 */
export function getLaunchPlatformSurchargeLamports(): number {
  return readOptionalNonNegativeInt(
    process.env.LAUNCH_PLATFORM_SURCHARGE_LAMPORTS,
    DEFAULT_PLATFORM_SURCHARGE_LAMPORTS,
  );
}

function readOptionalNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Default minimum SOL the platform hot wallet must hold at rest before a launch (ops safety). */
const DEFAULT_PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS = 25_000_000; // 0.025 SOL

/**
 * Reject launches when the platform wallet balance is below this (lamports), ignoring the user’s surcharge.
 * Set `PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS=0` to disable the check.
 */
export function getPlatformLaunchMinBalanceLamports(): number | null {
  const raw = process.env.PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLATFORM_LAUNCH_MIN_BALANCE_LAMPORTS;
  if (n === 0) return null;
  return n;
}

/**
 * Conservative estimate of lamports Pump `createV2` locks into new on-chain accounts (rent) before the
 * optional first buy. The user’s surcharge is transferred to the platform in the same tx before Pump ixs,
 * so available lamports for rent are roughly `platformBalance + surcharge`.
 */
const DEFAULT_PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS = 15_000_000; // ~0.015 SOL

/** Headroom for base fee / priority fee variance when comparing balance + surcharge to overhead. */
export const PLATFORM_LAUNCH_FUNDING_FEE_BUFFER_LAMPORTS = 400_000;

/**
 * Override with `PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS` (lamports) if mainnet rent differs.
 */
export function getPlatformLaunchCreateOverheadLamports(): number {
  const raw = process.env.PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS?.trim();
  if (!raw) return DEFAULT_PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLATFORM_LAUNCH_CREATE_OVERHEAD_LAMPORTS;
  return n;
}
