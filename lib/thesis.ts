import { RPC } from "@/lib/chain";

/** Verafy Thesis stamps: one Memo transaction per jury run, carrying the run's Merkle root. Devnet only. */
export const THESIS_SITE = "https://www.verafy.ai";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const MEMO_RE = /verafy-thesis\/(\d+) merkle:([0-9a-f]{64}) run:([0-9a-f-]{36})/;

export type ThesisRun = {
  runId: string;
  finalizedAt: string;
  merkleRoot: string;
  stampStatus: string;
  stampTx: string | null;
  stampCluster: string | null;
  claims: number;
};

/** The runs the website has finalized, newest first, as its public report endpoint lists them. */
export async function thesisRuns(): Promise<ThesisRun[]> {
  const res = await fetch(`${THESIS_SITE}/api/thesis/report`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const body = (await res.json()) as { runs?: ThesisRun[] };
  return body.runs ?? [];
}

export type ThesisStamp = {
  signature: string;
  slot: number;
  blockTime: number | null;
  signer: string;
  feeLamports: number;
  version: string;
  merkleRoot: string;
  runId: string;
  memo: string;
};

type ParsedTx = {
  slot: number;
  blockTime: number | null;
  meta: { fee: number; err: unknown } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { programId: string; parsed?: unknown }[];
    };
  };
};

/** Reads one transaction from devnet and returns the thesis stamp in it, or null if it is not one. */
export async function readStamp(signature: string): Promise<ThesisStamp | null> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) return null;
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }),
    next: { revalidate: 300 },
  });
  const j = (await res.json()) as { result?: ParsedTx | null };
  const tx = j.result;
  if (!tx || tx.meta?.err) return null;
  const memoIx = tx.transaction.message.instructions.find((i) => i.programId === MEMO_PROGRAM);
  const memo = typeof memoIx?.parsed === "string" ? memoIx.parsed : "";
  const m = MEMO_RE.exec(memo);
  if (!m) return null;
  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    signer: tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey ?? "",
    feeLamports: tx.meta?.fee ?? 0,
    version: m[1]!,
    merkleRoot: m[2]!,
    runId: m[3]!,
    memo,
  };
}

export const when = (iso: string | number) =>
  new Date(typeof iso === "number" ? iso * 1000 : iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";
