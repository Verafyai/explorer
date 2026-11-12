#!/usr/bin/env node
/**
 * MCP server for Verafy Explorer.
 *
 * Reads Verafy's programs on Solana devnet and nothing else. No keys, no
 * transactions, no database. It reuses `lib/chain.ts` rather than reimplementing
 * the account decoding, so the explorer page and an agent can never disagree
 * about what an account says.
 *
 * Every answer carries the account address it came from and a link to Solana
 * Explorer, because a claim about a chain that cannot be checked independently
 * is worth very little, and an agent relaying this to a person should be able to
 * hand them the link.
 *
 * Two labels are load-bearing and travel on every payload:
 *
 *   cluster: "devnet"   this is not mainnet.
 *   scripted: true      on the devnet certifications where jurors voted by
 *                       script rather than by model. A ruling produced by a
 *                       script is not evidence that a jury works.
 *
 *   npm run mcp:build && node mcp/dist/mcp/server.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  PROGRAMS,
  RPC,
  certifications,
  certificationFor,
  recordsFor,
  rulings,
  harnesses,
  harnessAccountFor,
  provenFor,
  account,
  raw,
  decodeCertification,
  decodeRuling,
  decodeHarness,
  slot,
  nameOf,
  isAddress,
  solana,
  ago,
  type Certification,
  type Ruling,
  type Harness,
} from "@/lib/chain";
import { gradeFor, GRADE_SCALE } from "@/lib/grade";

const CLUSTER = "devnet";

const server = new Server(
  { name: "verafy-explorer", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "explorer_status",
      description:
        "The chain Verafy Explorer reads: cluster, RPC endpoint, current slot, the five program addresses, and how many certifications, rulings and registered harnesses exist right now. Start here.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "explorer_certifications",
      description:
        "Program certifications on chain. Each says what level a program's bytecode reached (Not certified, Sniffed, Fuzzed, Hardened), its score, how many jury seats and model families ruled on it, and the ruling account behind it. A certification is bound to one bytecode hash, so it does not carry over to a new build.",
      inputSchema: {
        type: "object",
        properties: {
          program: { type: "string", description: "Only certifications for this program address." },
          minLevel: { type: "number", description: "0 to 3. Only certifications at or above this level." },
          limit: { type: "number", description: "Default 25, newest first." },
        },
      },
    },
    {
      name: "explorer_program",
      description:
        "Everything on chain about one program: its current certification and grade, its verdict history including superseded records, and how many of its builds have been proven. This is the tool to use when asked whether a program is certified.",
      inputSchema: {
        type: "object",
        properties: {
          program: { type: "string", description: "Program address." },
          bytecodeHash: { type: "string", description: "Hex bytecode hash, for a specific build rather than the latest." },
        },
        required: ["program"],
      },
    },
    {
      name: "explorer_rulings",
      description:
        "Jury rulings. Each shows the contract hash ruled on, the status (open, sealed, below bar), the answer, how many jurors agreed, the agreement bar in parts per million, and every juror's seat with its revealed answer and reasoning hash. A sealed ruling with agreement under the bar is recorded as 'below bar' rather than discarded.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "sealed", "below bar", "empty"], description: "Filter by status." },
          includeJurors: { type: "boolean", description: "Include every juror seat. Default true." },
          limit: { type: "number", description: "Default 25." },
        },
      },
    },
    {
      name: "explorer_harnesses",
      description:
        "The AI harnesses registered to sit on juries: the model family and name, the operator, the endpoint, the price per ruling in lamports, and whether the registration is active or retired.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "retired"], description: "Filter by status. Default all." },
          family: { type: "string", description: "Filter by model family, e.g. llama, qwen, deepseek." },
          limit: { type: "number", description: "Default 50." },
        },
      },
    },
    {
      name: "explorer_account",
      description:
        "Decode any Verafy account by address. Tries certification, ruling and harness layouts and returns whichever matches, with the raw size and owner. Use it to check a specific address an answer referred to.",
      inputSchema: {
        type: "object",
        properties: { address: { type: "string", description: "Account address." } },
        required: ["address"],
      },
    },
    {
      name: "explorer_grades",
      description: "The grade scale and what each grade means, so a score can be read without guessing at the thresholds.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (req.params.name) {
      case "explorer_status": {
        const [now, certs, rules, harns] = await Promise.all([slot(), certifications(), rulings(), harnesses()]);
        return ok({
          slot: now,
          programs: PROGRAMS,
          rpc: RPC,
          counts: {
            certifications: certs.length,
            rulings: rules.length,
            rulingsSealed: rules.filter((r) => r.status === "sealed").length,
            rulingsBelowBar: rules.filter((r) => r.status === "below bar").length,
            harnesses: harns.length,
            harnessesActive: harns.filter((h) => h.status === "active").length,
          },
          links: Object.fromEntries(Object.entries(PROGRAMS).map(([k, v]) => [k, solana(v)])),
        });
      }

      case "explorer_certifications": {
        const [certs, now] = await Promise.all([certifications(), slot()]);
        let rows = certs;
        if (typeof a.program === "string") rows = rows.filter((c) => c.program === a.program);
        if (Number.isFinite(Number(a.minLevel))) rows = rows.filter((c) => c.level >= Number(a.minLevel));
        const limit = num(a.limit, 25);
        return ok({
          total: rows.length,
          certifications: rows.slice(0, limit).map((c) => certView(c, now)),
        });
      }

      case "explorer_program": {
        const program = String(a.program ?? "");
        if (!isAddress(program)) return err(`"${program}" is not a Solana address`);

        const now = await slot();
        const hash = typeof a.bytecodeHash === "string" ? a.bytecodeHash : undefined;

        const [cert, proven] = await Promise.all([
          hash ? certificationFor(program, hash) : latestFor(program),
          provenFor(program),
        ]);

        const records = hash ? await recordsFor(program, hash) : [];
        const g = gradeFor(cert ?? null, proven);

        return ok({
          program,
          link: solana(program),
          name: nameOf(program)?.name ?? null,
          grade: g.grade,
          gradeMeaning: g.meaning,
          provenBuilds: proven,
          certification: cert ? certView(cert, now) : null,
          certified: Boolean(cert && cert.level > 0),
          note: cert
            ? "A certification is bound to one bytecode hash. A new build is uncertified until it is ruled on again."
            : "No certification account for this program. Not certified.",
          verdictHistory: records.map((r) => ({
            address: r.address,
            seq: r.seq,
            level: r.levelName,
            score: r.score,
            supersedes: r.supersedes,
            supersededBy: r.supersededBy,
            current: r.supersededBy === null,
            link: solana(r.address),
          })),
        });
      }

      case "explorer_rulings": {
        const rules = await rulings();
        let rows = rules;
        if (typeof a.status === "string") rows = rows.filter((r) => r.status === a.status);
        const limit = num(a.limit, 25);
        const withJurors = a.includeJurors !== false;
        return ok({
          total: rows.length,
          rulings: rows.slice(0, limit).map((r) => rulingView(r, withJurors)),
          note: "barPpm is the agreement threshold in parts per million. A sealed ruling below it is recorded as 'below bar', not discarded.",
        });
      }

      case "explorer_harnesses": {
        const harns = await harnesses();
        let rows = harns;
        if (typeof a.status === "string") rows = rows.filter((h) => h.status === a.status);
        if (typeof a.family === "string") {
          const f = a.family.toLowerCase();
          rows = rows.filter((h) => h.family.toLowerCase().includes(f));
        }
        const limit = num(a.limit, 50);
        return ok({
          total: rows.length,
          harnesses: rows.slice(0, limit).map((h) => ({
            address: h.address,
            link: solana(h.address),
            status: h.status,
            harnessKey: h.harnessKey,
            operator: h.operator,
            family: h.family,
            model: h.model,
            endpoint: h.endpoint,
            priceLamports: h.price,
            registeredSlot: h.registeredSlot,
            retiredSlot: h.retiredSlot || null,
          })),
        });
      }

      case "explorer_account": {
        const address = String(a.address ?? "");
        if (!isAddress(address)) return err(`"${address}" is not a Solana address`);

        const acct = await account(address);
        if (!acct) return ok({ address, link: solana(address), exists: false });

        const b = raw(acct);
        const base = {
          address,
          link: solana(address),
          exists: true,
          owner: acct.owner,
          ownerProgram: Object.entries(PROGRAMS).find(([, v]) => v === acct.owner)?.[0] ?? null,
          bytes: b.length,
          lamports: acct.lamports,
        };

        const cert = decodeCertification(address, b);
        if (cert) return ok({ ...base, kind: "certification", certification: certView(cert, await slot()) });

        const ruling = decodeRuling(address, b);
        if (ruling) return ok({ ...base, kind: "ruling", ruling: rulingView(ruling, true) });

        const harness = decodeHarness(address, b, acct.lamports);
        if (harness) {
          const all = await harnesses();
          return ok({
            ...base,
            kind: "harness",
            harness,
            registryAccount: harnessAccountFor(harness.harnessKey, all)?.address ?? null,
          });
        }

        return ok({
          ...base,
          kind: "unknown",
          note: "The account exists but matches no Verafy layout. It may belong to another program, or to a layout this build does not decode.",
        });
      }

      case "explorer_grades":
        return ok({
          scale: GRADE_SCALE.map(([grade, meaning]) => ({ grade, meaning })),
          note: "A grade combines the certification level with how many of the program's builds have been proven. An uncertified program is graded, not omitted.",
        });

      default:
        return err(`unknown tool: ${req.params.name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});

/** The newest certification for a program, when no bytecode hash is given. */
async function latestFor(program: string): Promise<Certification | null> {
  const all = await certifications();
  return all.find((c) => c.program === program) ?? null;
}

function certView(c: Certification, now: number) {
  return {
    address: c.address,
    link: solana(c.address),
    program: c.program,
    programName: nameOf(c.program)?.name ?? null,
    level: c.level,
    levelName: c.levelName,
    score: c.score,
    seats: c.seats,
    families: c.families,
    bytecodeHash: c.bytecodeHash,
    reportHash: c.reportHash,
    ruling: c.ruling,
    rulingLink: solana(c.ruling),
    certifier: c.certifier,
    certifiedSlot: c.certifiedSlot,
    certifiedAgo: ago(c.certifiedSlot, now),
    records: c.records,
  };
}

function rulingView(r: Ruling, withJurors: boolean) {
  return {
    address: r.address,
    link: solana(r.address),
    status: r.status,
    answer: r.answer,
    seats: r.seats,
    agree: r.agree,
    barPpm: r.barPpm,
    metBar: r.seats > 0 ? (r.agree / r.seats) * 1_000_000 >= r.barPpm : false,
    contractHash: r.contractHash,
    opener: r.opener,
    summary: r.summary,
    ...(withJurors
      ? {
          jurors: r.jurors.map((j) => ({
            key: j.key,
            answer: j.answer,
            state: j.state,
            reasoningHash: j.reasoningHash,
          })),
        }
      : {}),
  };
}

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Every payload carries the cluster and the scripted caveat. An agent that
 * summarizes this for a person should not be able to drop either one, because
 * "certified" without "on devnet, by scripted jurors" is a different and much
 * stronger claim than the chain supports.
 */
function ok(body: unknown): CallToolResult {
  const framed = {
    cluster: CLUSTER,
    caveat:
      "Devnet only. Certifications recorded so far had jurors voting by script rather than by model, so a ruling here is not evidence that a model jury works. Every address links to Solana Explorer and can be checked independently.",
    ...(body as object),
  };
  return { content: [{ type: "text", text: JSON.stringify(framed, null, 2) }] };
}

function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ cluster: CLUSTER, error: message }, null, 2) }], isError: true };
}

await server.connect(new StdioServerTransport());
