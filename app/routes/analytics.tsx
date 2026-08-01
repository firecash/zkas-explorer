import React, { useEffect, useState } from "react";
import numeral from "numeral";
import AnalyticsIcon from "../assets/analytics.svg";
import Shield from "../assets/verified_user.svg";
import Coins from "../assets/coins.svg";
import Trophy from "../assets/trophy.svg";
import Box from "../assets/box.svg";
import Time from "../assets/time.svg";
import Landslide from "../assets/landslide.svg";
import Card from "../layout/Card";
import CardContainer from "../layout/CardContainer";
import MainBox from "../layout/MainBox";
import FooterHelper from "../layout/FooterHelper";
import { AreaChart, Donut, DualBar } from "../components/MiniCharts";
import { emissionSeries, supplySeries } from "../config/emission";
import { BRAND } from "../config/brand";
import { useBlockdagInfo } from "../hooks/useBlockDagInfo";
import { useCoinSupply } from "../hooks/useCoinSupply";
import { useBlockReward } from "../hooks/useBlockReward";
import { useHalving } from "../hooks/useHalving";
import { useShieldedPool } from "../hooks/useShieldedPool";
import { useNetworkPulse } from "../hooks/useNetworkPulse";

export function meta() {
  return [
    { title: "ZKas Analytics - Network Stats & Charts | ZKas Explorer" },
    {
      name: "description",
      content:
        "Live ZKas network analytics: block production, difficulty, the deterministic emission & supply schedule, and the shielded-pool privacy dashboard.",
    },
    {
      name: "keywords",
      content: "ZKas analytics, emission schedule, supply, difficulty, shielded pool, privacy, turnstile",
    },
  ];
}

const SOMPI = 100_000_000;
const toFc = (v?: string | number) => (Number(v) || 0) / SOMPI;

const emission = emissionSeries(60);
const supply = supplySeries(60);
const xTicks = [0, 12, 24, 36, 48, 60];
const fmtMonth = (x: number) => (x === 0 ? "launch" : `${x / 12}`);
const fmtTimeline = (x: number) => (x === 0 ? "launch" : x < 12 ? `${x} mo` : `${x / 12} yr`);

export default function Analytics() {
  const [workWindow, setWorkWindow] = useState("15m");
  const { data: dag, isLoading: dagLoading } = useBlockdagInfo();
  const { data: coin, isLoading: coinLoading } = useCoinSupply();
  const { data: reward, isLoading: rewardLoading } = useBlockReward();
  const { data: halving } = useHalving();
  const { data: shielded, isLoading: shieldedLoading } = useShieldedPool();
  const { data: pulse, isLoading: pulseLoading } = useNetworkPulse(workWindow);

  const circulating = toFc(coin?.circulatingSupply);
  // Place the "today" marker on the supply curve at the month whose modelled
  // cumulative supply is closest to the live circulating figure.
  const curMonth = supply.reduce(
    (best, p, i) => (Math.abs(p.y * 1e9 - circulating) < Math.abs(supply[best].y * 1e9 - circulating) ? i : best),
    0,
  );
  const tIn = toFc(shielded?.turnstileIn);
  const tOut = toFc(shielded?.turnstileOut);
  const shieldedShare = circulating > 0 ? Math.min(1, (tIn - tOut) / circulating) : 1;

  return (
    <>
      {/* Hero */}
      <div className="flex flex-col rounded-4xl bg-white px-4 py-8 sm:px-8 md:py-12 md:ps-16">
        <div className="flex flex-col justify-center gap-y-2">
          <div className="flex items-center gap-x-3">
            <AnalyticsIcon className="h-8 w-8 fill-primary" />
            <span className="text-3xl lg:text-[42px]">Network analytics</span>
          </div>
          <span className="text-gray-500">
            Live state of the {BRAND.name} BlockDAG, its deterministic emission schedule, and the shielded pool that
            keeps every balance private.
          </span>
        </div>
      </div>

      {/* Network at a glance */}
      <MainBox>
        <CardContainer title="Network at a glance">
          <Card
            title="Blocks (DAA score)"
            loading={dagLoading}
            value={numeral(dag?.virtualDaaScore ?? 0).format("0,0")}
            subtext="blocks accepted into the DAG"
          />
          <Card
            title="Difficulty"
            loading={dagLoading}
            value={numeral(dag?.difficulty ?? 0).format("0,0")}
            subtext="current network difficulty"
          />
          <Card
            title="Headers"
            loading={dagLoading}
            value={numeral(dag?.headerCount ?? 0).format("0,0")}
            subtext="headers processed"
          />
          <Card
            title="Miner reward"
            loading={rewardLoading}
            value={`${numeral((reward?.blockreward ?? BRAND.initialReward) * 0.95).format("0,0.[000]")} ZKAS`}
            subtext="95% of gross reward; 5% goes to development"
          />
        </CardContainer>
      </MainBox>

      {/* Live work chart */}
      <MainBox>
        <div className="mb-1 flex items-center gap-x-3">
          <AnalyticsIcon className="w-6 fill-primary" />
          <span className="text-2xl">Network work</span>
        </div>
        <p className="mb-5 max-w-3xl text-gray-500">
          Difficulty and estimated network hashrate over the selected window, sampled from
          accepted blocks. Hashrate is derived from consensus difficulty, not pool-reported miner claims.
        </p>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Chart time range">
          {[['15m', '15 min'], ['1h', '1 hour'], ['12h', '12 hours'], ['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setWorkWindow(value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${workWindow === value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'}`}>
              {label}
            </button>
          ))}
        </div>
        {pulseLoading && !pulse ? (
          <div className="h-72 animate-pulse rounded-2xl bg-gray-50" aria-label="Loading network work chart" />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-gray-500">Estimated hashrate</span>
                <span className="font-medium text-black">
                  {numeral(lastPositive(pulse?.workHashrateBins, (dag?.difficulty ?? 0) * 2) / 1e12).format("0.00")} TH/s
                </span>
              </div>
              <AreaChart
                data={series(pulse?.workHashrateBins, (dag?.difficulty ?? 0) * 2).map((y, x) => ({ x, y: y / 1e12 }))}
                ariaLabel="Estimated network hashrate over the last 15 minutes"
                formatX={(x) => formatAgo(x, pulse?.workBinSeconds ?? 15, pulse?.workHashrateBins?.length ?? 60)}
                formatY={(y) => `${numeral(y).format("0.0")}T`}
              />
            </div>
            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-gray-500">Network difficulty</span>
                <span className="font-medium text-black">
                  {numeral(lastPositive(pulse?.workDifficultyBins, dag?.difficulty ?? 0)).format("0.00a")}
                </span>
              </div>
              <AreaChart
                data={series(pulse?.workDifficultyBins, dag?.difficulty ?? 0).map((y, x) => ({ x, y }))}
                ariaLabel="Network difficulty over the last 15 minutes"
                formatX={(x) => formatAgo(x, pulse?.workBinSeconds ?? 15, pulse?.workDifficultyBins?.length ?? 60)}
                formatY={(y) => numeral(y).format("0.0a")}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-sm text-gray-500">Newest point at right. Longer windows become coarser automatically.</p>
      </MainBox>

      {/* Emission schedule */}
      <MainBox>
        <div className="mb-1 flex items-center gap-x-3">
          <Trophy className="w-6 fill-primary" />
          <span className="text-2xl">Emission schedule</span>
        </div>
        <p className="mb-4 max-w-3xl text-gray-500">
          Gross per-block issuance starts at 60 ZKAS (57 ZKAS to the miner after the 5% development allocation)
          and decays with a 3-month half-life. Once it falls to the tail
          floor (~month 10) a perpetual tail of <b className="text-black">6 ZKAS</b> is paid, stepping down once to
          a permanent <b className="text-black">0.6 ZKAS</b> at month 24 — funding proof-of-work security forever.
          There is no fixed supply cap.
        </p>
        <AreaChart
          data={emission}
          ariaLabel="Per-block reward in ZKAS over the first four years"
          yMax={64}
          yTicks={4}
          xTicks={xTicks}
          formatX={() => ""}
          formatY={(y) => y.toFixed(0)}
          annotations={[
            { x: 0, y: 60, text: "60 at launch", align: "start", dy: -10 },
            { x: 10, y: 6, text: "6 tail", align: "middle", dy: -12 },
            { x: 30, y: 0.6, text: "0.6 forever", align: "start", dy: -10 },
          ]}
        />
        <p className="mt-2 text-sm text-gray-500">Per-block reward (ZKAS), first 4 years. Hover for any month.</p>
      </MainBox>

      {/* Supply growth */}
      <MainBox>
        <div className="mb-1 flex items-center gap-x-3">
          <Coins className="w-6 fill-primary" />
          <span className="text-2xl">Coins in circulation</span>
        </div>
        <p className="mb-4 max-w-3xl text-gray-500">
          Cumulative ZKAS minted into the shielded pool as the schedule plays out — steeply disinflationary early
          (~0.65B by year 1, ~0.83B by year 2), then a low, near-linear tail. Today{" "}
          <b className="text-black">{numeral(circulating).format("0,0")} ZKAS</b> is in circulation.
        </p>
        <AreaChart
          data={supply}
          ariaLabel="Cumulative coins in circulation in billions of ZKAS over the first four years"
          yTicks={4}
          xTicks={xTicks}
          formatX={fmtTimeline}
          formatY={(y) => `${y.toFixed(2)}B`}
          marker={{ x: supply[curMonth].x, y: circulating / 1e9, label: `today · ${numeral(circulating).format("0,0a")}` }}
        />
        <p className="mt-2 text-sm text-gray-500">Cumulative coins in circulation (billions of ZKAS).</p>
      </MainBox>

      {/* Privacy dashboard */}
      <MainBox>
        <div className="mb-1 flex items-center gap-x-3">
          <Shield className="w-6 fill-primary" />
          <span className="text-2xl">Shielded-pool privacy</span>
        </div>
        <p className="mb-6 max-w-3xl text-gray-500">
          {BRAND.name} is shielded by default — every coin lives in the Orchard pool. Amounts, senders and receivers are
          encrypted on-chain; only aggregate, verifiable facts are public.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center gap-y-2 rounded-2xl border border-gray-100 p-6">
            <Donut
              value={shieldedShare}
              centerTop={`${(shieldedShare * 100).toFixed(0)}%`}
              centerBottom="of supply shielded"
            />
            <span className="text-center text-sm text-gray-500">
              {numeral(tIn).format("0,0")} ZKAS entered · {numeral(tOut).format("0,0")} exited
            </span>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card
                title="Anonymity set"
                loading={shieldedLoading}
                value={numeral(shielded?.noteCount ?? 0).format("0,0")}
                subtext="shielded notes in the pool"
              />
              <Card
                title="Shielded spends"
                loading={shieldedLoading}
                value={numeral(shielded?.nullifierCount ?? 0).format("0,0")}
                subtext="nullifiers revealed"
              />
            </div>
            <div className="rounded-2xl border border-gray-100 p-4">
              <span className="text-sm text-gray-500">Turnstile flow (transparent ↔ shielded)</span>
              <div className="mt-3">
                <DualBar
                  rows={[
                    { label: "Value shielded (in)", value: tIn, display: `${numeral(tIn).format("0,0")} ZKAS` },
                    { label: "Value unshielded (out)", value: tOut, display: `${numeral(tOut).format("0,0")} ZKAS` },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </MainBox>

      {/* Halving countdown */}
      <MainBox>
        <div className="mb-4 flex items-center gap-x-3">
          <Time className="w-6 fill-primary" />
          <span className="text-2xl">Next reward reduction</span>
        </div>
        <Countdown targetSec={halving?.nextHalvingTimestamp} nextAmount={halving?.nextHalvingAmount} />
      </MainBox>

      <FooterHelper icon={Landslide}>
        The emission and supply curves are deterministic — computed from {BRAND.name}'s coinbase constants (60 ZKAS
        initial reward, 3-month half-life, 6 → 0.6 ZKAS perpetual tail). All other figures are live from a
        {" "}{BRAND.name} node. 1 ZKAS = 100,000,000 sompi.
      </FooterHelper>
    </>
  );
}

function series(values: number[] | undefined, fallback: number) {
  const out = values?.length ? values : Array.from({ length: 60 }, () => fallback);
  let previous = fallback;
  return out.map((v) => {
    if (Number.isFinite(v) && v > 0) previous = v;
    return previous;
  });
}

function lastPositive(values: number[] | undefined, fallback: number) {
  return values?.slice().reverse().find((value) => Number.isFinite(value) && value > 0) ?? fallback;
}

function formatAgo(x: number, binSeconds = 15, pointCount = 60) {
  const seconds = Math.max(0, (pointCount - 1 - x) * binSeconds);
  if (seconds === 0) return "now";
  if (seconds >= 3600) return `-${Math.round(seconds / 3600)}h`;
  return `-${Math.max(1, Math.round(seconds / 60))}m`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Countdown({ targetSec, nextAmount }: { targetSec?: number; nextAmount?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!targetSec) {
    return <span className="text-gray-500">Schedule loading…</span>;
  }
  const remaining = Math.max(0, targetSec * 1000 - now);
  const s = Math.floor(remaining / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const Unit = ({ v, label }: { v: number; label: string }) => (
    <div className="flex min-w-16 flex-col items-center rounded-2xl border border-gray-100 px-4 py-3">
      <span className="text-3xl tabular-nums text-black">{label === "days" ? v : pad(v)}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-wrap gap-3">
        <Unit v={days} label="days" />
        <Unit v={hours} label="hours" />
        <Unit v={mins} label="mins" />
        <Unit v={secs} label="secs" />
      </div>
      <span className="text-gray-500">
        Gross issuance halves to <b className="text-black">{nextAmount ?? "—"} ZKAS</b> at the next 3-month interval.
      </span>
    </div>
  );
}
