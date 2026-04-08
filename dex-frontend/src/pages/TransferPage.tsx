import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, parseAbi, type Address, isAddress } from "viem";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Token } from "@/config/tokens";
import { TOKENS } from "@/config/tokens";
import { TokenSelector } from "@/components/common/TokenSelector";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
]);

type Tab = "send" | "receive";

export function TransferPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("send");
  const [token, setToken] = useState<Token>(TOKENS[0]!);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: bal } = useBalance({
    address,
    token: token.isNative ? undefined : (token.address as Address),
    query: { enabled: !!address },
  });

  // Native transfer
  const {
    sendTransaction,
    data: nativeTxHash,
    isPending: nativePending,
    reset: nativeReset,
    error: nativeError,
  } = useSendTransaction();
  const { isLoading: nativeConfirming, isSuccess: nativeSuccess } = useWaitForTransactionReceipt({ hash: nativeTxHash });

  // ERC-20 transfer
  const {
    writeContract,
    data: erc20TxHash,
    isPending: erc20Pending,
    reset: erc20Reset,
    error: erc20Error,
  } = useWriteContract();
  const { isLoading: erc20Confirming, isSuccess: erc20Success } = useWaitForTransactionReceipt({ hash: erc20TxHash });

  const busy = nativePending || nativeConfirming || erc20Pending || erc20Confirming;

  useEffect(() => {
    if (nativeSuccess || erc20Success) {
      toast.success("Transfer confirmed!");
      setAmount("");
      setRecipient("");
      nativeReset();
      erc20Reset();
    }
  }, [nativeSuccess, erc20Success, nativeReset, erc20Reset]);

  useEffect(() => {
    const err = nativeError || erc20Error;
    if (err) {
      toast.error((err as any)?.shortMessage || err?.message || "Transaction failed");
    }
  }, [nativeError, erc20Error]);

  const handleSend = useCallback(() => {
    if (!recipient || !isAddress(recipient)) {
      toast.error("Invalid recipient address");
      return;
    }
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      toast.error("Invalid amount");
      return;
    }
    const value = parseUnits(amount, token.decimals);

    if (token.isNative) {
      sendTransaction({
        to: recipient as Address,
        value,
      });
    } else {
      writeContract({
        address: token.address as Address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as Address, value],
      });
    }
  }, [token, amount, recipient, sendTransaction, writeContract]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  }

  const balDisplay = bal
    ? parseFloat(formatUnits(bal.value, bal.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "0.00";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex rounded-xl bg-[#1e293b] p-1 ring-1 ring-white/5">
          {(["send", "receive"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-all ${tab === t ? "bg-primary text-[#0f172a] shadow" : "text-slate-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "send" && (
          <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-5 shadow-xl">
            <h1 className="mb-4 text-lg font-semibold text-white">Send</h1>
            {!isConnected ? (
              <div className="py-8 text-center [&_button]:rounded-xl">
                <p className="mb-4 text-sm text-slate-400">Connect a wallet to send tokens.</p>
                <ConnectButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-xs font-medium text-slate-400">Token</span>
                  <button type="button" onClick={() => setSelectorOpen(true)}
                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-left text-sm font-semibold text-white hover:border-white/20">
                    {token.symbol}
                  </button>
                  <p className="mt-1 text-right text-xs text-slate-500">
                    Balance:{" "}
                    <button type="button" className="hover:text-primary" onClick={() => bal && setAmount(formatUnits(bal.value, bal.decimals))}>
                      {balDisplay}
                    </button>
                  </p>
                </div>
                <div>
                  <label htmlFor="amt" className="mb-2 block text-xs font-medium text-slate-400">Amount</label>
                  <input id="amt" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.0"
                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-right text-lg font-medium text-white placeholder:text-slate-600 outline-none ring-primary/30 focus:border-primary/50 focus:ring-2" />
                </div>
                <div>
                  <label htmlFor="to" className="mb-2 block text-xs font-medium text-slate-400">Recipient</label>
                  <input id="to" value={recipient} onChange={e => setRecipient(e.target.value)}
                    placeholder="0x…"
                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600 outline-none ring-primary/30 focus:border-primary/50 focus:ring-2" />
                </div>
                <button type="button" disabled={busy} onClick={handleSend}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-[#0f172a] hover:bg-primary/90 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {busy ? "Sending..." : "Send"}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "receive" && (
          <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-5 shadow-xl">
            <h1 className="mb-4 text-lg font-semibold text-white">Receive</h1>
            {!isConnected ? (
              <div className="py-8 text-center [&_button]:rounded-xl">
                <p className="mb-4 text-sm text-slate-400">Connect a wallet to see your address.</p>
                <ConnectButton />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Send assets to this address on EnergyChain.</p>
                <div className="break-all rounded-xl border border-white/10 bg-[#0f172a] px-4 py-4 font-mono text-sm leading-relaxed text-slate-200">{address}</div>
                <button type="button" onClick={copyAddress}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy address"}
                </button>
              </div>
            )}
          </div>
        )}

        <TokenSelector isOpen={selectorOpen} onClose={() => setSelectorOpen(false)}
          selectedToken={token} onSelect={setToken} />
      </div>
    </div>
  );
}
