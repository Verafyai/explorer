import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROGRAMS, account, ago, decodeHarness, raw, rulings, short, slot, solana } from "@/lib/chain";

export const revalidate = 30;
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  return { title: `Harness ${short((await params).address)}` };
}

export default async function HarnessPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const a = await account(address).catch(() => null);
  if (!a || a.owner !== PROGRAMS.registry) notFound();
  const h = decodeHarness(address, raw(a), a.lamports);
  if (!h) notFound();
  const [now, all] = await Promise.all([slot(), rulings()]);
  const sat = all.filter((r) => r.jurors.some((j) => j.key === h.harnessKey));
  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <p className="muted" style={{ fontSize: 14 }}><a href="/#harnesses">Harnesses</a> / {short(h.harnessKey)}</p>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Registered harness</p>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>{h.family} harness</h1>
        <p className="quiet">{h.model}</p>
      </section>
      <section className="tiles">
        <div className="tile"><b style={{ color: h.status === "active" ? "var(--teal)" : undefined }}>{h.status}</b><span>status</span></div>
        <div className="tile"><b>{sat.length}</b><span>juries sat on</span></div>
        <div className="tile"><b>{ago(h.registeredSlot, now)}</b><span>registered</span></div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>Registration</h2>
        <dl className="kv">
          <dt>Harness key</dt><dd><a className="mono" href={solana(h.harnessKey)}>{h.harnessKey}</a></dd>
          <dt>Registry account</dt><dd><a className="mono" href={solana(address)}>{address}</a></dd>
          <dt>Operator</dt><dd><a className="mono" href={solana(h.operator)}>{h.operator}</a></dd>
          <dt>Model family</dt><dd>{h.family}</dd>
          <dt>Model</dt><dd>{h.model}</dd>
          <dt>Endpoint</dt><dd>{h.endpoint}</dd>
          <dt>Registered at slot</dt><dd className="mono">{h.registeredSlot.toLocaleString("en-US")}</dd>
        </dl>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>Juries</h2>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Ruling</th><th className="c">Status</th><th className="c">Its vote</th><th>Summary</th></tr></thead>
            <tbody>{sat.slice(0, 50).map((r) => <tr key={r.address}><td><a className="mono" href={`/ruling/${r.address}`}>{short(r.address)}</a></td><td className="c">{r.status}</td><td className="c mono">{r.jurors.find((j) => j.key === h.harnessKey)?.answer}</td><td className="quiet" style={{ fontSize: 13 }}>{r.summary}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
