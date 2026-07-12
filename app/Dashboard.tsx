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
import { useState } from "react";
import { Link } from "react-router";

dayjs.extend(relativeTime);

// Terminal FireCash supply (~5.15B $firecash), used only for the "mined %" gauge.
const TOTAL_SUPPLY = 5_150_000_000;

const shortHash = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : (h ?? "—"));
const ago = (ts?: string) => (ts ? dayjs(Number(ts)).fromNow() : "—");

const Dashboard = () => {
  const [search, setSearch] = useState("");

  const { data: blockDagInfo, isLoading: isLoadingBlockDagInfo } = useBlockdagInfo();
  const { data: coinSupply, isLoading: isLoadingCoinSupply } = useCoinSupply();
  const { data: blockReward, isLoading: isLoadingBlockReward } = useBlockReward();
  const { data: halving, isLoading: isLoadingHalving } = useHalving();
  const { data: transactionsCount, isLoading: isLoadingTxCount } = useTransactionsCount();
  const { data: shielded, isLoading: isLoadingShielded } = useShieldedPool();
  const { blocks, transactions } = useIncomingBlocks();

  const sompiToFc = (v?: string) => numeral((Number(v) || 0) / 1_0000_0000).format("0,0");
  const totalTxCount = isLoadingTxCount
    ? ""
    : Math.floor((transactionsCount!.regular + transactionsCount!.coinbase) / 1_000_000).toString();

  return (
    <>
      {/* Hero — short, search-first */}
      <div className="flex flex-col rounded-4xl bg-white px-4 py-10 sm:px-8 sm:py-10 md:ps-20 md:py-14 lg:ps-24 xl:ps-36">
        <div className="flex w-full flex-col gap-y-3 justify-center">
          <span className="text-3xl lg:text-[54px]">FireCash Explorer</span>
          <span className="mb-4 text-gray-500">
            Live blocks &amp; private transactions on the shielded BlockDAG.
          </span>
          <SearchBox value={search} onChange={setSearch} className="w-full py-4" />
        </div>
      </div>

      {/* LIVE FEED — the centerpiece */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LivePanel title="Latest blocks" to="/blocks">
          {blocks.length === 0 ? (
            <FeedEmpty />
          ) : (
            blocks.slice(0, 10).map((b) => (
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
            transactions.slice(0, 10).map((t) => {
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
                    <div className="text-black">{numeral(valueSompi / 1_0000_0000).format("0,0.[00]")} $firecash</div>
                    <div className="text-xs text-primary">shielded</div>
                  </div>
                </Link>
              );
            })
          )}
        </LivePanel>
      </div>

      {/* Compact stats */}
      <div className="flex w-full flex-col rounded-4xl bg-gray-50 px-4 py-8 text-gray-900 sm:px-8 md:px-20 md:py-12 lg:px-24 xl:px-36">
        <span className="mb-5 text-black text-2xl md:text-3xl">{BRAND.name} by the numbers</span>
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardBox description="Total transactions" value={`> ${totalTxCount} M`} icon={<Swap className="w-5" />} />
          <DashboardBox
            description="Total blocks"
            value={numeral(blockDagInfo?.virtualDaaScore || 0).format("0,0")}
            icon={<Box className="w-5" />}
            loading={isLoadingBlockDagInfo}
          />
          <DashboardBox
            description="Total supply"
            value={numeral((coinSupply?.circulatingSupply || 0) / 1_0000_0000).format("0,0")}
            unit="$firecash"
            icon={<Coins className="w-5" />}
            loading={isLoadingCoinSupply}
          />
          <DashboardBox
            description="Mined"
            value={((coinSupply?.circulatingSupply || 0) / TOTAL_SUPPLY / 1000000).toFixed(2)}
            unit="%"
            icon={<Landslide className="w-5" />}
            loading={isLoadingCoinSupply}
          />
          <DashboardBox description="Average block time" value={"1"} unit="s" icon={<Time className="w-5" />} />
          <DashboardBox
            description="Shielded notes"
            value={numeral(shielded?.noteCount ?? 0).format("0,0")}
            icon={<AccountBalanceWallet className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Block reward"
            value={(blockReward?.blockreward || 0).toFixed(3)}
            unit="$firecash"
            icon={<Trophy className="w-5" />}
            loading={isLoadingBlockReward}
          />
          <DashboardBox
            description="Reward reduction"
            value={halving?.nextHalvingDate || ""}
            icon={<Swap className="w-5" />}
            loading={isLoadingHalving}
          />
        </div>
      </div>

      {/* Compact shielded pool */}
      <div className="flex w-full flex-col rounded-4xl bg-gray-50 px-4 py-8 sm:px-8 md:px-20 md:py-12 lg:px-24 xl:px-36">
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
            value={sompiToFc(shielded?.turnstileIn)}
            unit="$firecash"
            icon={<Coins className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Nullifiers (shielded spends)"
            value={numeral(shielded?.nullifierCount ?? 0).format("0,0")}
            icon={<Swap className="w-5" />}
            loading={isLoadingShielded}
          />
          <DashboardBox
            description="Emission per block"
            value={(shielded?.emissionPerBlock ?? BRAND.initialReward).toString()}
            unit="$firecash"
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
  value: string | number;
  unit?: string;
  loading?: boolean;
}

const DashboardBox = (props: DashboardBoxProps) => {
  return (
    <div className="flex flex-col gap-y-2 rounded-2xl border border-gray-200 px-6 py-4">
      <div className="flex flex-row items-center overflow-hidden text-lg">
        <div className="fill-primary mr-1 w-5">{props.icon}</div>
        <span className="text-gray-500">{props.description}</span>
      </div>
      <span className="md:text-lg xl:text-xl text-black">
        {!props.loading ? (
          props.value
        ) : (
          <span>
            <Spinner className="mr-2 inline h-5 w-5" />
          </span>
        )}
        {props.unit ? <span className="text-gray-500 md:text-md xl:text-lg"> {props.unit}</span> : ""}
      </span>
    </div>
  );
};

export default Dashboard;
