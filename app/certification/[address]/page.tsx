import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROGRAMS, account, ago, certificationContractHash, decodeCertification, decodeRuling, harnesses, nameOf, raw, short, slot, solana } from "@/lib/chain";

export const revalidate = 30;
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  return { title: `Certification ${short((await params).address)}` };
}

export default async function CertificationPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const a = await account(address).catch(() => null);
  if (!a || a.owner !== PROGRAMS.certification) notFound();
  const c = decodeCertification(address, raw(a));
  if (!c) notFound();
  const [now, r, all] = await Promise.all([slot(), account(c.ruling), harnesses()]);
  const ruling = r ? decodeRuling(c.ruling, raw(r)) : null;
  const n = nameOf(c.program);
  const expected = certificationContractHash(c);
  const bound = ruling?.contractHash === expected;
  const seats = (ruling?.jurors || []).map((j) => ({ ...j, harness: all.find((h) => h.harnessKey === j.key) }));

  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <p className="muted" style={{ fontSize: 14 }}><a href="/#certifications">Certifications</a> / {short(address)}</p>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Verafy Certification</p>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{n?.name || short(c.program, 8)}: {c.levelName}</h1>
        <div className="notice">Devnet certification only. The jurors behind it voted by script, and it was issued from a Sniff run, so Sniffed is the highest level it could reach. It is not a full certification.</div>
      </section>
      <section className="tiles">
        <div className="tile"><b style={{ color: c.level ? "var(--teal)" : undefined }}>{c.levelName}</b><span>level {c.level} of 3</span></div>
        <div className="tile"><b>{c.score}</b><span>Fuzzy Score</span></div>
        <div className="tile"><b>{c.seats}</b><span>jurors, {c.families} model families</span></div>
        <div className="tile"><b>{ago(c.certifiedSlot, now)}</b><span>slot {c.certifiedSlot.toLocaleString("en-US")}</span></div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>What it certifies</h2>
        <dl className="kv">
          <dt>Program</dt><dd><a className="mono" href={`/program/${c.program}`}>{c.program}</a>{n?.fuzzy ? <> · <a href={`https://fuzzy.verafy.ai/programs/${c.program}`}>Fuzzy report card</a></> : null}</dd>
          <dt>Bytecode hash</dt><dd className="mono">{c.bytecodeHash}</dd>
          <dt>Report hash</dt><dd className="mono">{c.reportHash}</dd>
          <dt>Certification account</dt><dd><a className="mono" href={solana(address)}>{address}</a></dd>
          <dt>Certifier</dt><dd><a className="mono" href={solana(c.certifier)}>{c.certifier}</a></dd>
          <dt>Releasable after slot</dt><dd className="mono">{c.releasableAfterSlot.toLocaleString("en-US")} {now >= c.releasableAfterSlot ? "(passed)" : "(challenge window open)"}</dd>
        </dl>
        <p className="quiet" style={{ fontSize: 14 }}>The bytecode hash covers one exact build. If the program is upgraded, its hash changes and this certification no longer applies to it.</p>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>The ruling behind it</h2>
        {ruling ? (
          <>
            <dl className="kv">
              <dt>Ruling</dt><dd><a className="mono" href={`/ruling/${c.ruling}`}>{c.ruling}</a></dd>
              <dt>Status</dt><dd>{ruling.status}, {ruling.agree} of {ruling.seats} agree, bar {(ruling.barPpm / 10000).toFixed(0)}%</dd>
              <dt>Summary</dt><dd>{ruling.summary}</dd>
              <dt>Bound to this build</dt><dd>{bound ? <span className="tag tag-ok">Yes</span> : <span className="tag tag-warn">No</span>} The ruling&apos;s contract hash {bound ? "equals" : "does not equal"} sha256(&quot;verafy-certification/1&quot;, program, bytecode hash, report hash, score), recomputed here.</dd>
            </dl>
            <div className="tablewrap">
              <table className="data">
                <thead><tr><th>Seat</th><th>Juror</th><th>Family</th><th className="c">Vote</th><th className="c">State</th></tr></thead>
                <tbody>{seats.map((j, i) => (
                  <tr key={j.key}><td className="mono muted">{i + 1}</td><td>{j.harness ? <a className="mono" href={`/harness/${j.harness.address}`}>{short(j.key)}</a> : <span className="mono">{short(j.key)}</span>}</td><td>{j.harness?.family || <span className="muted">not registered</span>}</td><td className="c mono">{j.answer}</td><td className="c">{j.state}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>Votes are answer indexes: 0 Not certified, 1 Sniffed, 2 Fuzzed, 3 Hardened.</p>
          </>
        ) : <p className="quiet">The ruling account could not be read.</p>}
      </section>
    </main>
  );
}
