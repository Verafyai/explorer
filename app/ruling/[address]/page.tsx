import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROGRAMS, account, certifications, decodeRuling, harnesses, nameOf, raw, short, solana } from "@/lib/chain";

export const revalidate = 30;
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  return { title: `Ruling ${short((await params).address)}` };
}

export default async function RulingPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const a = await account(address).catch(() => null);
  if (!a || a.owner !== PROGRAMS.ruling) notFound();
  const r = decodeRuling(address, raw(a));
  if (!r) notFound();
  const [all, certs] = await Promise.all([harnesses(), certifications()]);
  const cert = certs.find((c) => c.ruling === address);
  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <p className="muted" style={{ fontSize: 14 }}><a href="/#rulings">Rulings</a> / {short(address)}</p>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Jury ruling</p>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>{r.summary || `Ruling ${short(address)}`}</h1>
      </section>
      <section className="tiles">
        <div className="tile"><b style={{ color: r.status === "sealed" ? "var(--teal)" : undefined }}>{r.status}</b><span>status</span></div>
        <div className="tile"><b>{r.answer}</b><span>answer</span></div>
        <div className="tile"><b>{r.agree} / {r.seats}</b><span>jurors agree</span></div>
        <div className="tile"><b>{(r.barPpm / 10000).toFixed(0)}%</b><span>agreement bar</span></div>
      </section>
      {cert ? <p className="quiet">This ruling backs a certification: <a href={`/certification/${cert.address}`}>{nameOf(cert.program)?.name || short(cert.program)}, {cert.levelName}</a>.</p> : null}
      <section className="stack" style={{ gap: 12 }}>
        <h2>Jurors</h2>
        <p className="quiet">Each juror committed a hash of its vote first, then revealed the vote and its reasoning hash. The program checked each reveal against the commitment.</p>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Seat</th><th>Juror</th><th>Family</th><th>Model</th><th className="c">Vote</th><th className="c">State</th><th>Reasoning hash</th></tr></thead>
            <tbody>{r.jurors.map((j, i) => {
              const h = all.find((x) => x.harnessKey === j.key);
              return <tr key={j.key}><td className="mono muted">{i + 1}</td><td>{h ? <a className="mono" href={`/harness/${h.address}`}>{short(j.key)}</a> : <a className="mono" href={solana(j.key)}>{short(j.key)}</a>}</td><td>{h?.family || <span className="muted">not registered</span>}</td><td className="quiet" style={{ fontSize: 13 }}>{h?.model || ""}</td><td className="c mono">{j.answer}</td><td className="c">{j.state}</td><td className="mono muted" style={{ fontSize: 12 }}>{j.reasoningHash.slice(0, 16)}…</td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>Account</h2>
        <dl className="kv">
          <dt>Ruling account</dt><dd><a className="mono" href={solana(address)}>{address}</a></dd>
          <dt>Contract hash</dt><dd className="mono">{r.contractHash}</dd>
          <dt>Opened by</dt><dd><a className="mono" href={solana(r.opener)}>{r.opener}</a></dd>
          {r.releasableAfterSlot !== undefined ? (<><dt>Releasable after slot</dt><dd className="mono">{r.releasableAfterSlot.toLocaleString("en-US")}</dd></>) : null}
        </dl>
      </section>
    </main>
  );
}
