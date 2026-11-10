import { Stamp } from "@/components/stamp";
import { Search } from "@/components/search";
import { ago, certifications, harnesses, nameOf, rulings, short, slot } from "@/lib/chain";

export const revalidate = 30;

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [now, certs, rules, jurors] = await Promise.all([slot(), certifications(), rulings(), harnesses()]);
  const sealed = rules.filter((r) => r.status === "sealed");
  const active = jurors.filter((h) => h.status === "active");
  const families = new Set(active.map((h) => h.family)).size;
  const certRulings = new Set(certs.map((c) => c.ruling));
  const shown = [...rules].sort((a, b) => Number(certRulings.has(b.address)) - Number(certRulings.has(a.address))).slice(0, 40);

  return (
    <main className="page stack" style={{ gap: 40 }}>
      <section className="stack" style={{ gap: 14, maxWidth: 860 }}>
        <p className="row mono" style={{ gap: 10, color: "var(--teal)", fontSize: 14 }}><span>Verafy Explorer</span><span className="tag tag-warn">Devnet prototype</span></p>
        <h1>See what the juries decided, on chain.</h1>
        <p className="quiet" style={{ fontSize: 17 }}>
          Block explorers show transfers and balances. Verafy writes something different to Solana: rulings by juries of AI models, the vote each juror revealed, the harnesses registered to sit on juries, and the certifications those rulings back. Verafy Explorer reads them straight from Verafy&apos;s programs on devnet, so anyone, or any agent, can check a certification back to the jury that wrote it.
        </p>
        <Search />
        {error ? <p style={{ color: "var(--medium)", fontSize: 14 }}>{error}</p> : null}
      </section>

      <section className="tiles" aria-label="Totals">
        <div className="tile"><b>{certs.filter((c) => c.level > 0).length}</b><span>certified builds, of {certs.length} certification records</span></div>
        <div className="tile"><b>{sealed.length}</b><span>sealed rulings of {rules.length}</span></div>
        <div className="tile"><b>{active.length}</b><span>active harnesses, {families} model {families === 1 ? "family" : "families"}</span></div>
        <div className="tile"><b>{now.toLocaleString("en-US")}</b><span>devnet slot</span></div>
      </section>

      <section id="certifications" className="stack" style={{ gap: 12 }}>
        <h2>Certifications</h2>
        <p className="quiet">A Verafy Certification is a grade written for one exact build of a program, only from a sealed jury ruling: A Hardened, B Fuzzed, C Sniffed, I too shallow to grade, F exploit proven. Today all of them are devnet certifications with jurors voting by script, not full certifications.</p>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Program</th><th className="c">Grade</th><th className="c">Fuzzy Score</th><th className="c">Jury</th><th>Certified</th><th>Account</th></tr></thead>
            <tbody>
              {certs.map((c) => {
                const n = nameOf(c.program);
                return (
                  <tr key={c.address}>
                    <td><a href={`/program/${c.program}`} style={{ color: "var(--text)" }}>{n?.name || short(c.program, 6)}</a><div className="mono muted" style={{ fontSize: 12 }}>{short(c.program)}</div></td>
                    <td className="c"><Stamp cert={c} name="" size="tag" /></td>
                    <td className="c mono">{c.score}</td>
                    <td className="c mono">{c.seats} · {c.families}f</td>
                    <td className="muted">{ago(c.certifiedSlot, now)}</td>
                    <td><a className="mono" href={`/certification/${c.address}`}>{short(c.address)}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="rulings" className="stack" style={{ gap: 12 }}>
        <h2>Rulings</h2>
        <p className="quiet">Each ruling is one jury question. Jurors commit to a vote, then reveal it; the program checks every reveal against its commitment and the agreement against the bar, then seals the result. Showing {shown.length} of {rules.length}, certification rulings first.</p>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Ruling</th><th className="c">Status</th><th className="c">Agree</th><th className="c">Bar</th><th>Summary</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.address}>
                  <td><a className="mono" href={`/ruling/${r.address}`}>{short(r.address)}</a></td>
                  <td className="c"><span className={r.status === "sealed" ? "tag tag-ok" : "tag"}>{r.status}</span></td>
                  <td className="c mono">{r.agree} / {r.seats}</td>
                  <td className="c mono">{(r.barPpm / 10000).toFixed(0)}%</td>
                  <td className="quiet" style={{ fontSize: 13 }}>{r.summary || <span className="muted">No summary</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="harnesses" className="stack" style={{ gap: 12 }}>
        <h2>Harnesses</h2>
        <p className="quiet">Harnesses registered with verafy_registry. Only active registered harnesses can sit on a certification jury.</p>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Harness</th><th>Family</th><th>Model</th><th className="c">Status</th><th>Registered</th></tr></thead>
            <tbody>
              {jurors.map((h) => (
                <tr key={h.address}>
                  <td><a className="mono" href={`/harness/${h.address}`}>{short(h.harnessKey)}</a></td>
                  <td>{h.family}</td>
                  <td className="quiet" style={{ fontSize: 13 }}>{h.model}</td>
                  <td className="c"><span className={h.status === "active" ? "tag tag-ok" : "tag"}>{h.status}</span></td>
                  <td className="muted">{ago(h.registeredSlot, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
