import type { Metadata } from "next";
import { ago, certifications, isAddress, nameOf, short, slot } from "@/lib/chain";

export const revalidate = 30;
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const a = (await params).address;
  return { title: nameOf(a)?.name || `Program ${short(a)}` };
}

export default async function ProgramPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const n = nameOf(address);
  const [now, all] = await Promise.all([slot(), certifications()]);
  const certs = all.filter((c) => c.program === address);
  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <p className="muted" style={{ fontSize: 14 }}><a href="/">Explorer</a> / {short(address)}</p>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Program{n ? ` · ${n.category}` : ""}</p>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>{n?.name || (isAddress(address) ? short(address, 8) : "Not an address")}</h1>
        <p className="mono muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{address}</p>
        <div className="row" style={{ gap: 10 }}>
          <a className="btn btn-quiet" href={`https://explorer.solana.com/address/${address}`}>Solana Explorer (mainnet)</a>
          <a className="btn btn-quiet" href={`https://explorer.solana.com/address/${address}?cluster=devnet`}>Solana Explorer (devnet)</a>
          {n?.fuzzy ? <a className="btn btn-quiet" href={`https://fuzzy.verafy.ai/programs/${address}`}>Fuzzy report card</a> : null}
        </div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>Certifications</h2>
        {certs.length ? (
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th className="c">Level</th><th className="c">Score</th><th>Build (bytecode hash)</th><th>Certified</th><th>Account</th></tr></thead>
              <tbody>{certs.map((c) => <tr key={c.address}><td className="c"><span className="tag tag-ok">{c.levelName}</span></td><td className="c mono">{c.score}</td><td className="mono muted" style={{ fontSize: 12 }}>{c.bytecodeHash.slice(0, 20)}…</td><td className="muted">{ago(c.certifiedSlot, now)}</td><td><a className="mono" href={`/certification/${c.address}`}>{short(c.address)}</a></td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <p className="quiet">No Verafy Certification for any build of this program. Not certified means not vouched for, not malicious. {n?.fuzzy ? <a href={`https://fuzzy.verafy.ai/programs/${address}`}>See its Fuzzy scan</a> : <a href={`https://fuzzy.verafy.ai/?program=${address}`}>Scan it with Fuzzy</a>}.</p>
        )}
        {certs.length ? <p className="muted" style={{ fontSize: 13 }}>Devnet certifications only, with jurors voting by script. A certification covers the build whose bytecode hash it names.</p> : null}
      </section>
    </main>
  );
}
