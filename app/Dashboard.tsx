import AccountBalanceWallet from "./assets/account_balance_wallet.svg";
import Box from "./assets/box.svg";
import Coins from "./assets/coins.svg";
import Shield from "./assets/verified_user.svg";
import Swap from "./assets/swap.svg";
import Time from "./assets/time.svg";
import Trophy from "./assets/trophy.svg";
import Landslide from "./assets/landslide.svg";
import Spinner from "./Spinner";
import SearchBox from "./header/SearchBox";
import { AreaChart } from "./components/MiniCharts";
import { BLOCKS_PER_MONTH, emissionSeries, rewardAtMonth } from "./config/emission";
import { useBlockdagInfo } from "./hooks/useBlockDagInfo";
import { useBlockReward } from "./hooks/useBlockReward";
import { useCoinSupply } from "./hooks/useCoinSupply";
import { useHalving } from "./hooks/useHalving";
import { useShieldedPool } from "./hooks/useShieldedPool";
import { useTransactionsCount } from "./hooks/useTransactionsCount";
import { useIncomingBlocks } from "./hooks/useIncomingBlocks";
import { BRAND } from "./config/brand";
import numeral from "numeral";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Block } from "./hooks/useIncomingBlocks";

// Code-split: three.js only loads for the homepage mesh, never the rest of the app.
const ShieldedMesh = lazy(() => import("./components/ShieldedMesh"));

dayjs.extend(relativeTime);

// Terminal ZKas supply (~5.15B ZKAS), used only for the "mined %" gauge.
const TOTAL_SUPPLY = 5_150_000_000;

// The deterministic emission curve (mirrors the node's coinbase constants).
const EMISSION = emissionSeries(48);

/** Where "today" sits on the emission timeline, inverted from circulating supply. */
function monthAtSupply(circ: number): number {
  let cum = 0;
  for (let m = 1; m <= 48; m++) {
    const inc = ((rewardAtMonth(m - 1) + rewardAtMonth(m)) / 2) * BLOCKS_PER_MONTH;
    if (cum + inc >= circ) return m - 1 + (circ - cum) / inc;
    cum += inc;
  }
  return 48;
}

const shortHash = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : (h ?? "—"));
const ago = (ts?: string) => (ts ? dayjs(Number(ts)).fromNow() : "—");

// --- ASMR numbers: a continuous smooth ticker. The display exponentially
// approaches the target, so a burst of +4 blocks rolls in over a few seconds
// (one digit at a time) instead of snapping — and a steadily moving target
// (supply, block count) reads as a clock, not a slot machine.
function useSmoothTicker(target: number, tau = 3): number {
  const [v, setV] = useState(target);
  const ref = useRef({ display: target, target });
  ref.current.target = target;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const { display, target: tgt } = ref.current;
      if (!Number.isFinite(tgt)) return;
      const diff = tgt - display;
      if (diff === 0) return;
      const next = Math.abs(diff) < 0.51 ? tgt : display + diff * (1 - Math.exp(-dt / tau));
      ref.current.display = next;
      setV(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return v;
}

// Session telemetry: every unique block this tab has ever seen, binned into
// 10s buckets → real sparklines for block flow and tx flow. No backend needed.
// The FIRST snapshot backfills the window (its timestamps already span the
// recent past), so the charts appear within seconds of opening the page.
const SPARK_BIN_MS = 10_000;
const SPARK_BINS = 42;
function useSessionSpark(blocks: Block[]) {
  const seen = useRef(new Map<string, { ts: number; txs: number }>());
  const startRef = useRef(Date.now());
  const backfilledRef = useRef(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let fresh = false;
    for (const b of blocks) {
      if (!seen.current.has(b.block_hash)) {
        seen.current.set(b.block_hash, { ts: Number(b.timestamp), txs: b.txCount });
        fresh = true;
      }
    }
    if (fresh && !backfilledRef.current) {
      backfilledRef.current = true;
      const oldest = Math.min(...blocks.map((b) => Number(b.timestamp)).filter((t) => t > 0));
      if (Number.isFinite(oldest)) startRef.current = Math.min(startRef.current, oldest);
    }
    if (fresh) setTick((v) => v + 1);
  }, [blocks]);
  return useMemo(() => {
    void tick;
    const now = Date.now();
    const blockSpark = new Array(SPARK_BINS).fill(0);
    const txSpark = new Array(SPARK_BINS).fill(0);
    for (const { ts, txs } of seen.current.values()) {
      const age = now - ts;
      if (age < 0 || age >= SPARK_BIN_MS * SPARK_BINS) continue;
      const bin = SPARK_BINS - 1 - Math.floor(age / SPARK_BIN_MS);
      blockSpark[bin]++;
      txSpark[bin] += txs;
    }
    // Only show bins the session actually observed (no false zero-dips).
    const liveBins = Math.min(SPARK_BINS, Math.max(2, Math.ceil((now - startRef.current) / SPARK_BIN_MS) + 1));
    let sessionTxs = 0;
    for (const { txs } of seen.current.values()) sessionTxs += txs;
    return {
      blockSpark: blockSpark.slice(-liveBins),
      txSpark: txSpark.slice(-liveBins),
      sessionBlocks: seen.current.size,
      sessionTxs,
    };
  }, [tick]);
}

// API numbers refresh slowly; the chain doesn't. Tick a displayed total live
// off the block feed (baseline + Δ·perUnit), resnapping whenever the API
// serves a fresh value — so it moves every second and never double-counts.
function useLiveTotal(apiValue: number, unitsSeen: number, perUnit: number): number {
  const baseRef = useRef<{ api: number; units: number } | null>(null);
  if (apiValue > 0 && (baseRef.current === null || baseRef.current.api !== apiValue)) {
    baseRef.current = { api: apiValue, units: unitsSeen };
  }
  if (!baseRef.current) return apiValue;
  return baseRef.current.api + (unitsSeen - baseRef.current.units) * perUnit;
}

// Tiny stat-tile sparkline: one 2px primary line, soft fill, breathing tip dot.
const Spark = ({ data, label }: { data: number[]; label: string }) => {
  const gid = useId().replace(/:/g, "");
  // Hold space until the session has a real shape (a lone fresh bin renders as
  // a misleading flat-line-then-spike).
  if (data.length < 3 || data.every((d) => d === 0)) return <div className="mt-2 h-[30px]" />;
  const W = 120;
  const H = 30;
  const max = Math.max(...data, 1);
  const px = (i: number) => (i / (data.length - 1)) * W;
  const py = (d: number) => H - 3 - (d / max) * (H - 9);
  const line = data.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(d).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-[30px] w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${gid})`} />
      <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r={2.5} fill="var(--color-primary)" className="spark-tip" />
    </svg>
  );
};

// Small single-value ring (mined %, epoch progress). value ∈ [0,1].
const MiniRing = ({ value }: { value: number }) => {
  const r = 15.5;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0.015, Math.min(1, value)) * circ;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-gray-100)" strokeWidth={5} />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dasharray 0.9s ease" }}
      />
    </svg>
  );
};

const Dashboard = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: blockDagInfo, isLoading: isLoadingBlockDagInfo } = useBlockdagInfo();
  const { data: coinSupply, isLoading: isLoadingCoinSupply } = useCoinSupply();
  const { data: blockReward, isLoading: isLoadingBlockReward } = useBlockReward();
  const { data: halving, isLoading: isLoadingHalving } = useHalving();
  const { data: transactionsCount, isLoading: isLoadingTxCount } = useTransactionsCount();
  const { data: shielded, isLoading: isLoadingShielded } = useShieldedPool();
  const { blocks, transactions, avgBlockTime } = useIncomingBlocks();
  const { blockSpark, txSpark, sessionBlocks, sessionTxs } = useSessionSpark(blocks);

  // Live-ticking totals: supply +60/block, tx count +1/coinbase-tx, blocks +1.
  const liveSupply = useLiveTotal(
    (Number(coinSupply?.circulatingSupply) || 0) / 1_0000_0000,
    sessionBlocks,
    BRAND.initialReward,
  );
  const liveBlocks = useLiveTotal(Number(blockDagInfo?.virtualDaaScore) || 0, sessionBlocks, 1);
  const liveTxs = useLiveTotal(
    isLoadingTxCount ? 0 : transactionsCount!.regular + transactionsCount!.coinbase,
    sessionTxs,
    1,
  );

  // "+N this session" deltas: remember the first value this tab saw.
  const firstNotesRef = useRef<number | null>(null);
  if (shielded && firstNotesRef.current === null) firstNotesRef.current = shielded.noteCount;
  const notesDelta = shielded && firstNotesRef.current !== null ? shielded.noteCount - firstNotesRef.current : 0;

  const liveBlockTime = avgBlockTime > 0 ? 1 / avgBlockTime : 1;

  // Chart data: session block flow as (secondsAgo, blocks) points, and where
  // today's supply places us on the emission timeline.
  const pulseData = useMemo(
    () => blockSpark.map((y, i) => ({ x: -(blockSpark.length - 1 - i) * (SPARK_BIN_MS / 1000), y })),
    [blockSpark],
  );
  const emissionMonth = useMemo(() => monthAtSupply(liveSupply), [liveSupply]);

  const txIds = useMemo(() => transactions.map((t) => t.txId), [transactions]);
  const meshBlocks = useMemo(
    () => blocks.map((b) => ({ hash: b.block_hash, blue: Number(b.blueScore) || 0, txs: b.txCount ?? 0 })),
    [blocks],
  );

  return (
    <>
      {/* Hero — the shielded mesh. Every flash is a real transaction from the
          live feed; every cage flash a real block. On mobile the mesh gets its
          own compact band ABOVE the copy (smaller model, nothing overlaps the
          text); on desktop it gets the right half, drag-to-spin. */}
      <div className="flex flex-col overflow-hidden rounded-4xl bg-white lg:flex-row">
        <div className="relative h-[200px] w-full max-w-full cursor-grab touch-pan-y overflow-hidden sm:h-[250px] lg:order-2 lg:h-[420px] lg:w-1/2">
          <Suspense fallback={null}>
            <ShieldedMesh txIds={txIds} blocks={meshBlocks} onNavigate={navigate} />
          </Suspense>
        </div>
        <div className="flex w-full flex-col justify-center gap-y-1 px-4 pt-1 pb-8 sm:px-8 lg:w-1/2 lg:py-12 lg:ps-16 xl:ps-24">
          <span className="text-2xl lg:text-4xl">ZKas Explorer</span>
          <span className="mb-2 text-gray-500">Live blocks &amp; private transactions on the shielded BlockDAG.</span>
          <SearchBox value={search} onChange={setSearch} className="w-full py-3" />
          <div className="mt-3 flex items-center gap-x-2 text-xs text-gray-500">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
            </span>
            <span>
              Live chain data — every hash is a real transaction, every ⬢ a real block. Tap one.{" "}
              <span className="text-primary">All you'll ever see: that it happened. Never who, or how much</span>.
            </span>
          </div>
        </div>
      </div>

      {/* LIVE FEED — the centerpiece */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LivePanel title="Latest blocks" to="/blocks">
          {blocks.length === 0 ? (
            <FeedEmpty />
          ) : (
            blocks.slice(0, 3).map((b) => (
              <Link
                key={b.block_hash}
                to={`/blocks/${b.block_hash}`}
                className="flex items-center gap-x-3 rounded-xl px-3 py-2.5 hover:bg-gray-50"
              >
                <Box className="fill-primary w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-black">{numeral(b.blueScore).format("0,0")}</div>
                  <div className="truncate font-mono text-xs text-gray-500">{shortHash(b.block_hash)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-black">{b.txCount} tx</div>
                  <div className="text-xs text-gray-500">{ago(b.timestamp)}</div>
                </div>
              </Link>
            ))
          )}
        </LivePanel>

        <LivePanel title="Latest transactions" to="/transactions">
          {transactions.length === 0 ? (
            <FeedEmpty />
          ) : (
            transactions.slice(0, 3).map((t) => {
              const valueSompi = t.outputs.reduce((acc, o) => acc + Number(o[0]), 0);
              return (
                <Link
                  key={t.txId}
                  to={`/transactions/${t.txId}`}
                  className="flex items-center gap-x-3 rounded-xl px-3 py-2.5 hover:bg-gray-50"
                >
                  <Swap className="fill-primary w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-black">{shortHash(t.txId)}</div>
                    <div className="text-xs text-gray-500">{ago(t.timestamp)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-black">{numeral(valueSompi / 1_0000_0000).format("0,0.[00]")} ZKAS</div>
                    <div className="text-xs text-primary">shielded</div>
                  </div>
                </Link>
              );
            })
          )}
        </LivePanel>
      </div>

      {/* Live stats — every number glides, the sparklines are this session's
          real block/tx flow, and the rings show progress. */}
      <div className="flex w-full flex-col rounded-4xl bg-gray-50 px-4 py-6 text-gray-900 sm:px-8 md:px-20 md:py-8 lg:px-24 xl:px-36">
        <div className="mb-5 flex items-baseline justify-between">
          <span className="text-black text-2xl md:text-3xl">{BRAND.name} by the numbers</span>
          <span className="hidden text-xs text-gray-500 sm:block">
            live · {sessionBlocks > 0 ? `${numeral(sessionBlocks).format("0,0")} blocks watched this session` : "listening…"}
          </span>
        </div>

        {/* The graphs: a live pulse straight off the feed, and the chain's
            deterministic emission curve with "you are here". */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-4 transition-all duration-300 hover:border-primary/40 sm:p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Box className="fill-primary w-5" />
                <span className="text-black text-lg">Network pulse</span>
              </div>
              <span className="flex items-center gap-x-2 text-xs text-gray-500">
                <span className="relative flex h-2 w-2">
                  <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
                </span>
                {liveBlockTime.toFixed(2)}s / block
              </span>
            </div>
            {pulseData.length >= 3 ? (
              <AreaChart
                data={pulseData}
                height={220}
                yTicks={3}
                formatX={(x) => (x >= -8 ? "now" : `−${Math.round(-x / 60)}m`)}
                formatY={(y) => String(Math.round(y))}
                ariaLabel="Blocks per 15 seconds while this page has been open"
              />
            ) : (
              <div className="flex h-[220px] animate-pulse items-center justify-center text-sm text-gray-500">
                listening to the chain…
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Blocks per 15s while this page is open — drawn from the live feed, updating every second.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 transition-all duration-300 hover:border-primary/40 sm:p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Trophy className="fill-primary w-5" />
                <span className="text-black text-lg">Emission curve</span>
              </div>
              <span className="text-xs text-gray-500">60 → 3 ZKAS, forever</span>
            </div>
            <AreaChart
              data={EMISSION}
              height={220}
              yMax={64}
              yTicks={4}
              xTicks={[0, 12, 24, 36, 48]}
              formatX={(x) => (x === 0 ? "launch" : `yr ${x / 12}`)}
              formatY={(y) => y.toFixed(0)}
              annotations={[
                { x: 10, y: 6, text: "6 tail", align: "middle", dy: -12 },
                { x: 26, y: 3, text: "3 forever", align: "start", dy: -12 },
              ]}
              marker={{ x: emissionMonth, y: rewardAtMonth(emissionMonth), label: "you are here" }}
              ariaLabel="Per-block reward in ZKAS over the first four years, with today's position marked"
            />
            <p className="mt-1 text-xs text-gray-500">
              The reward schedule is deterministic — a 3-month half-life down to a perpetual tail. Hover any month.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardBox
            description="Total transactions"
            numeric={liveTxs}
            icon={<Swap className="w-5" />}
            loading={isLoadingTxCount}
            spark={txSpark}
            sparkLabel="Transactions per 15s, this session"
          />
          <DashboardBox
            description="Total blocks"
            numeric={liveBlocks}
            icon={<Box className="w-5" />}
            loading={isLoadingBlockDagInfo}
            spark={blockSpark}
            sparkLabel="Blocks per 15s, this session"
          />
          <DashboardBox
            description="Total supply"
            numeric={liveSupply}
            unit="ZKAS"
            icon={<Coins className="w-5" />}
            loading={isLoadingCoinSupply}
            delta="+60 ZKAS with every block — watch it climb"
          />
          <DashboardBox
            description="Mined"
            numeric={(liveSupply / TOTAL_SUPPLY) * 100}
            format={(n) => n.toFixed(2)}
            unit="%"
            icon={<Landslide className="w-5" />}
            loading={isLoadingCoinSupply}
            ring={liveSupply / TOTAL_SUPPLY}
          />
          <DashboardBox
            description="Average block time"
            numeric={liveBlockTime}
            format={(n) => n.toFixed(2)}
            unit="s"
            icon={<Time className="w-5" />}
            delta="measured live from the block feed"
          />
          <DashboardBox
            description="Shielded notes"
            numeric={shielded?.noteCount ?? 0}
            icon={<AccountBalanceWallet className="w-5" />}
            loading={isLoadingShielded}
            delta={notesDelta > 0 ? `+${numeral(notesDelta).format("0,0")} while you watched` : "every payment adds encrypted notes"}
          />
          <DashboardBox
            description="Block reward"
            value={(blockReward?.blockreward || 0).toFixed(0)}
            unit="ZKAS"
            icon={<Trophy className="w-5" />}
            loading={isLoadingBlockReward}
            delta="freshly minted, straight into the shielded pool"
          />
          <DashboardBox
            description="Reward reduction"
            value={halving?.nextHalvingDate || ""}
            icon={<Swap className="w-5" />}
            loading={isLoadingHalving}
            delta="emission steps down on schedule"
          />
        </div>
      </div>

      {/* Compact shielded pool */}
      <div className="flex w-full flex-col rounded-4xl bg-gray-50 px-4 py-6 sm:px-8 md:px-20 md:py-8 lg:px-24 xl:px-36">
        <div className="mb-5 flex items-center gap-x-3">
          <Shield className="fill-primary w-6" />
          <span className="text-black text-2xl md:text-3xl">The shielded pool</span>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardBox
            description="Current anchor (note-tree root)"
            value={shortHash(shielded?.anchor)}
            icon={<Shield className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Value shielded (turnstile in)"
            numeric={(Number(shielded?.turnstileIn) || 0) / 1_0000_0000}
            unit="ZKAS"
            icon={<Coins className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Nullifiers (shielded spends)"
            numeric={shielded?.nullifierCount ?? 0}
            icon={<Swap className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Emission per block"
            value={(shielded?.emissionPerBlock ?? BRAND.initialReward).toString()}
            unit="ZKAS"
            icon={<Trophy className="w-5" />}
            loading={isLoadingShielded}
          />
        </div>
      </div>
    </>
  );
};

// A live-updating feed panel with a pulsing "live" dot and a "view all" link.
const LivePanel = ({ title, to, children }: { title: string; to: string; children: React.ReactNode }) => (
  <div className="flex w-full flex-col rounded-4xl bg-white px-4 py-6 sm:px-6">
    <div className="mb-3 flex items-center justify-between px-2">
      <div className="flex items-center gap-x-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span className="text-black text-lg">{title}</span>
      </div>
      <Link to={to} className="text-sm text-primary hover:underline">
        View all →
      </Link>
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
);

const FeedEmpty = () => (
  <div className="flex items-center gap-x-2 px-3 py-6 text-gray-500">
    <Spinner className="h-4 w-4" /> waiting for the next block…
  </div>
);

interface DashboardBoxProps {
  icon: React.ReactNode;
  description: string;
  value?: string | number;
  /** Animated alternative to `value`: glides to each new number (ASMR). */
  numeric?: number;
  format?: (n: number) => string;
  unit?: string;
  loading?: boolean;
  /** Live session sparkline under the value. */
  spark?: number[];
  sparkLabel?: string;
  /** Small progress ring beside the value, ∈ [0,1]. */
  ring?: number;
  /** Muted one-liner under the value ("+12 this session"). */
  delta?: string;
}

const AnimatedNumber = ({ value, format }: { value: number; format: (n: number) => string }) => {
  const v = useSmoothTicker(value);
  return <>{format(v)}</>;
};

const DashboardBox = (props: DashboardBoxProps) => {
  return (
    <div className="hover:border-primary/40 flex flex-col gap-y-2 rounded-2xl border border-gray-200 px-6 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(23,214,190,0.07)]">
      <div className="flex flex-row items-center overflow-hidden text-lg">
        <div className="fill-primary mr-1 w-5">{props.icon}</div>
        <span className="text-gray-500">{props.description}</span>
      </div>
      <div className="flex items-center gap-x-3">
        {props.ring !== undefined && !props.loading && <MiniRing value={props.ring} />}
        <span className="md:text-lg xl:text-xl text-black">
          {props.loading ? (
            <span>
              <Spinner className="mr-2 inline h-5 w-5" />
            </span>
          ) : props.numeric !== undefined ? (
            <AnimatedNumber value={props.numeric} format={props.format ?? ((n) => numeral(n).format("0,0"))} />
          ) : (
            props.value
          )}
          {props.unit ? <span className="text-gray-500 md:text-md xl:text-lg"> {props.unit}</span> : ""}
        </span>
      </div>
      {props.delta && !props.loading && <span className="text-xs text-gray-500">{props.delta}</span>}
      {props.spark && <Spark data={props.spark} label={props.sparkLabel ?? props.description} />}
    </div>
  );
};

export default Dashboard;
