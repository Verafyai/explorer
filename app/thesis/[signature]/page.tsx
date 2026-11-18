import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { short, solana } from "@/lib/chain";
import { readStamp, THESIS_SITE, thesisRuns, when } from "@/lib/thesis";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ signature: string }> }): Promise<Metadata> {
  return { title: `Thesis stamp ${short((await params).signature)}` };
}

export default async function ThesisStamp({ params }: { params: Promise<{ signature: string }> }) {
  const { signature } = await params;
  const stamp = await readStamp(signature).catch(() => null);
  if (!stamp) notFound();
  const runs = await thesisRuns().catch(() => []);
  const run = runs.find((r) => r.runId === stamp.runId) ?? null;
  const matches = run ? run.merkleRoot === stamp.merkleRoot : null;
  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <p className="muted" style={{ fontSize: 14 }}><a href="/thesis">Verafy Thesis</a> / {short(signature)}</p>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Verafy Thesis certification</p>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>An AI jury&apos;s check of Verafy&apos;s claims, stamped on chain</h1>
        <div className="notice">Devnet only. This stamp is a Memo transaction on Solana devnet.</div>
        {matches === true ? (
          <div className="notice">The Merkle root on chain matches the root the website stores for this run.</div>
        ) : matches === false ? (
          <div className="notice">The Merkle root on chain does not match the root the website stores for this run.</div>
        ) : (
          <div className="notice">The website does not list this run among its recent runs, so its root could not be compared here.</div>
        )}
      </section>
      <section className="tiles">
        <div className="tile"><b>{run ? run.claims : "?"}</b><span>claim reports in the run</span></div>
        <div className="tile"><b>{stamp.blockTime ? when(stamp.blockTime) : "unknown"}</b><span>block time</span></div>
        <div className="tile"><b>{stamp.slot.toLocaleString("en-US")}</b><span>slot</span></div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>What it certifies</h2>
        <dl className="kv">
          <dt>Merkle root</dt><dd className="mono">{stamp.merkleRoot}</dd>
          <dt>Run</dt><dd className="mono">{stamp.runId}</dd>
          <dt>Format</dt><dd className="mono">verafy-thesis/{stamp.version}</dd>
          <dt>Transaction</dt><dd><a className="mono" href={solana(signature, true)}>{signature}</a></dd>
          <dt>Signer</dt><dd><a className="mono" href={solana(stamp.signer)}>{stamp.signer}</a></dd>
          <dt>Fee</dt><dd className="mono">{stamp.feeLamports.toLocaleString("en-US")} lamports</dd>
          <dt>Memo</dt><dd className="mono">{stamp.memo}</dd>
        </dl>
        <p className="quiet" style={{ fontSize: 14 }}>
          Each leaf is the SHA-256 of one claim report in canonical JSON. The reports, their hashes and their Merkle proofs are public in the{" "}
          <a href={`${THESIS_SITE}/thesis/claims`}>claims ledger</a> and at <a className="mono" href={`${THESIS_SITE}/api/thesis/report`}>/api/thesis/report</a>.
        </p>
      </section>
    </main>
  );
}
