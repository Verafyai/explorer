import type { Metadata } from "next";
import { short, solana } from "@/lib/chain";
import { THESIS_SITE, thesisRuns, when } from "@/lib/thesis";

export const revalidate = 30;
export const metadata: Metadata = { title: "Verafy Thesis stamps" };

export default async function ThesisStamps() {
  const runs = await thesisRuns().catch(() => []);
  const stamped = runs.filter((r) => r.stampTx);
  return (
    <main className="page stack" style={{ gap: 28, maxWidth: 980 }}>
      <section className="stack" style={{ gap: 10 }}>
        <p className="mono" style={{ color: "var(--teal)", fontSize: 14 }}>Verafy Thesis</p>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Jury certifications of Verafy&apos;s own claims</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Each time an AI jury checks the <a href={`${THESIS_SITE}/thesis/claims`}>Verafy Thesis</a>, the site hashes every claim report, builds one Merkle
          root over them, and writes that root to Solana in a Memo transaction. Anyone can rebuild the root from the published reports and compare it with the
          one on chain.
        </p>
        <div className="notice">Devnet only. These stamps are on Solana devnet, not mainnet.</div>
      </section>
      <section className="tiles" aria-label="Totals">
        <div className="tile"><b>{stamped.length}</b><span>runs stamped on chain</span></div>
        <div className="tile"><b>{runs.length - stamped.length}</b><span>runs waiting for a stamp</span></div>
        <div className="tile"><b>{runs[0] ? runs[0].claims : 0}</b><span>reports in the latest run</span></div>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h2>Runs</h2>
        {runs.length ? (
          <div className="tablewrap"><table className="data">
            <thead>
              <tr><th>Finalized</th><th>Reports</th><th>Merkle root</th><th>On chain</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId}>
                  <td>{when(r.finalizedAt)}</td>
                  <td className="mono">{r.claims}</td>
                  <td className="mono">{short(r.merkleRoot, 10)}</td>
                  <td>
                    {r.stampTx ? (
                      <><a className="mono" href={`/thesis/${r.stampTx}`}>{short(r.stampTx, 8)}</a> · <a href={solana(r.stampTx, true)}>Solana Explorer</a></>
                    ) : (
                      <span className="muted">pending stamp</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p className="muted">No runs yet.</p>
        )}
      </section>
    </main>
  );
}
