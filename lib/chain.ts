/** Read Verafy's programs on Solana devnet. Server only. No dependencies. */
import { createHash } from "node:crypto";
import names from "@/data/names.json";

export const RPC = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAMS = {
  certification: "1dcJPW3aGMCWDkNV6do6sEUwSxLdf8NtSuQb1teCdXt",
  ruling: "A6iZhDZASfQGCmzxXWW8JdnEhtz7EZE3gS4N1hkiJNNN",
  registry: "Bn6jV1CGK4WFibJcCVsEzHeVVhtph2xPsNkemWfgqn9R",
  judiciary: "6fUWUTA7qni3p1pWWdd58icC7cxKGmVv1vonawg1QnnJ",
  covenant: "D4ftcrUiGehwCAd6ndkttxyydPhkuis63HkiQeFQ5k4s",
} as const;

const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58(bytes: Uint8Array): string {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let s = "";
  while (n > 0n) { s = ALPHA[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}
export const isAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

type Name = { name: string; category: string; fuzzy?: boolean; verafy?: boolean };
export const nameOf = (a: string): Name | undefined => (names as Record<string, Name>)[a];

async function rpc<T>(method: string, params: unknown[], revalidate = 30): Promise<T> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), next: { revalidate } });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

type Acct = { pubkey: string; account: { data: [string, string]; lamports: number; owner: string; executable: boolean } };
const programAccounts = (program: string, size?: number) =>
  rpc<Acct[]>("getProgramAccounts", [program, { encoding: "base64", ...(size ? { filters: [{ dataSize: size }] } : {}) }]);

export const slot = () => rpc<number>("getSlot", [], 10);
export async function account(address: string) {
  const r = await rpc<{ value: Acct["account"] | null }>("getAccountInfo", [address, { encoding: "base64" }], 15);
  return r.value;
}
export const raw = (a: { data: [string, string] }) => Buffer.from(a.data[0], "base64");

/* ---------- certifications ---------- */
export const LEVELS = ["Not certified", "Sniffed", "Fuzzed", "Hardened"];
export type Certification = {
  address: string; level: number; levelName: string; score: number; seats: number; families: number;
  program: string; bytecodeHash: string; reportHash: string; ruling: string; certifier: string;
  releasableAfterSlot: number; certifiedSlot: number;
  /** On the certification account: how many verdict records this build has. On a record: its own number. */
  records: number;
};
function fields(address: string, b: Buffer): Certification {
  return {
    address, level: b[8], levelName: LEVELS[b[8]] ?? `Level ${b[8]}`, score: b[9], seats: b[10], families: b[11],
    program: b58(b.subarray(16, 48)), bytecodeHash: b.subarray(48, 80).toString("hex"), reportHash: b.subarray(80, 112).toString("hex"),
    ruling: b58(b.subarray(112, 144)), certifier: b58(b.subarray(144, 176)),
    releasableAfterSlot: Number(b.readBigUInt64LE(176)), certifiedSlot: Number(b.readBigUInt64LE(184)),
    records: b.readUInt32LE(12),
  };
}
/** The latest verdict for one build, at ["cert", program, bytecode hash]. */
export function decodeCertification(address: string, b: Buffer): Certification | null {
  if (b.length < 192 || b.subarray(0, 8).toString() !== "VRFYCRT1") return null;
  return fields(address, b);
}

/** One verdict kept for good, at ["verdict", program, bytecode hash, n]. A replaced one names its replacement. */
export type VerdictRecord = Certification & { seq: number; supersedes: string | null; supersededBy: string | null };
const ZERO = Buffer.alloc(32);
export function decodeRecord(address: string, b: Buffer): VerdictRecord | null {
  if (b.length < 256 || b.subarray(0, 8).toString() !== "VRFYVRD1") return null;
  const link = (o: number) => (b.subarray(o, o + 32).equals(ZERO) ? null : b58(b.subarray(o, o + 32)));
  const f = fields(address, b);
  return { ...f, seq: f.records, supersedes: link(192), supersededBy: link(224) };
}
/** Every verdict record for one build, oldest first. */
export async function recordsFor(program: string, bytecodeHash: string) {
  const accts = await rpc<Acct[]>("getProgramAccounts", [PROGRAMS.certification, { encoding: "base64", filters: [{ dataSize: 256 }, { memcmp: { offset: 16, bytes: program } }, { memcmp: { offset: 48, bytes: b58(Buffer.from(bytecodeHash, "hex")) } }] }]);
  return accts.map((a) => decodeRecord(a.pubkey, raw(a.account))).filter(Boolean).sort((x, y) => x!.seq - y!.seq) as VerdictRecord[];
}
/** The certification account a record belongs to: the one for the same program and build. */
export async function certificationFor(program: string, bytecodeHash: string) {
  const accts = await rpc<Acct[]>("getProgramAccounts", [PROGRAMS.certification, { encoding: "base64", filters: [{ dataSize: 192 }, { memcmp: { offset: 16, bytes: program } }, { memcmp: { offset: 48, bytes: b58(Buffer.from(bytecodeHash, "hex")) } }] }]);
  return accts[0]?.pubkey ?? null;
}
export async function certifications() {
  const accts = await programAccounts(PROGRAMS.certification, 192);
  return accts.map((a) => decodeCertification(a.pubkey, raw(a.account))).filter(Boolean).sort((x, y) => y!.certifiedSlot - x!.certifiedSlot) as Certification[];
}

/* ---------- rulings ---------- */
const RULING_STATUS = ["empty", "open", "sealed", "below bar"];
const SEAT_STATE = ["seated", "committed", "revealed"];
export type Ruling = {
  address: string; status: string; seats: number; answer: number; agree: number; barPpm: number;
  contractHash: string; opener: string; summary: string; jurors: { key: string; answer: number; state: string; reasoningHash: string }[];
  releasableAfterSlot?: number;
};
export function decodeRuling(address: string, b: Buffer): Ruling | null {
  if (b.subarray(0, 8).toString("latin1") !== "VRFYRUL1") return null;
  const n = b[9];
  const jurors = [];
  for (let i = 0; i < n; i++) {
    const at = 80 + 104 * i;
    jurors.push({ key: b58(b.subarray(at, at + 32)), reasoningHash: b.subarray(at + 64, at + 96).toString("hex"), answer: b[at + 96], state: SEAT_STATE[b[at + 97]] ?? "unknown" });
  }
  const len = b.readUInt16LE(912);
  const dl = 80 + 8 * 104 + 2 + 512;
  return {
    address, status: RULING_STATUS[b[8]] ?? "unknown", seats: n, answer: b[10], agree: b[11], barPpm: b.readUInt32LE(12),
    contractHash: b.subarray(16, 48).toString("hex"), opener: b58(b.subarray(48, 80)), jurors,
    summary: b.subarray(914, 914 + len).toString("utf8"),
    ...(b.length >= dl + 24 ? { releasableAfterSlot: Number(b.readBigUInt64LE(dl + 8)) } : {}),
  };
}
export async function rulings() {
  const accts = await programAccounts(PROGRAMS.ruling);
  return accts.map((a) => decodeRuling(a.pubkey, raw(a.account))).filter(Boolean) as Ruling[];
}

/* ---------- harnesses ---------- */
export type Harness = { address: string; status: string; harnessKey: string; operator: string; family: string; model: string; endpoint: string; price: number; registeredSlot: number; retiredSlot: number; lamports: number };
const text = (b: Buffer) => b.toString("utf8").replace(/\0+$/, "");
export function decodeHarness(address: string, b: Buffer, lamports = 0): Harness | null {
  if (b.subarray(0, 8).toString() !== "VRFYHRN1") return null;
  return {
    address, status: ["empty", "active", "retired"][b[8]] ?? "unknown", harnessKey: b58(b.subarray(16, 48)), operator: b58(b.subarray(48, 80)),
    family: text(b.subarray(80, 112)), model: text(b.subarray(112, 176)), endpoint: text(b.subarray(208, 336)),
    price: Number(b.readBigUInt64LE(336)), registeredSlot: Number(b.readBigUInt64LE(376)), retiredSlot: Number(b.readBigUInt64LE(384)), lamports,
  };
}
export async function harnesses() {
  const accts = await programAccounts(PROGRAMS.registry, 392);
  return accts.map((a) => decodeHarness(a.pubkey, raw(a.account), a.account.lamports)).filter(Boolean).sort((x, y) => y!.registeredSlot - x!.registeredSlot) as Harness[];
}

/** The harness registry account for a harness key: PDA ["harness", key]. */
export function harnessAccountFor(key: string, all: Harness[]) {
  return all.find((h) => h.harnessKey === key);
}

export const certificationContractHash = (c: Certification) =>
  createHash("sha256").update(Buffer.concat([Buffer.from("verafy-certification/1"), Buffer.from(b58decode(c.program)), Buffer.from(c.bytecodeHash, "hex"), Buffer.from(c.reportHash, "hex"), Buffer.from([c.score])])).digest("hex");

export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) { const i = ALPHA.indexOf(ch); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  const body = n === 0n ? [] : [...Buffer.from(hex, "hex")];
  const zeros = [...s].findIndex((c) => c !== "1");
  return Uint8Array.from([...new Array(zeros < 0 ? s.length : zeros).fill(0), ...body]);
}

export const solana = (a: string, tx = false) => `https://explorer.solana.com/${tx ? "tx" : "address"}/${a}?cluster=devnet`;
export const short = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;
export const ago = (fromSlot: number, now: number) => {
  const s = Math.max(0, Math.round((now - fromSlot) * 0.4));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** Proven findings for a program, from the Fuzzy registry. A level-0 certification grades F with proven findings, I without. */
export async function provenFor(program: string): Promise<number> {
  try {
    const r = await fetch(`https://fuzzy.verafy.ai/api/registry?program=${program}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.proven) || 0;
  } catch {
    return 0;
  }
}
