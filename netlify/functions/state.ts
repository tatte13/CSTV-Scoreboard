import type { Config } from "@netlify/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { boards } from "../../db/schema.js";

const MAX_BYTES = 2_000_000; // stato + loghi (dataURL) ampiamente sotto questa soglia

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = (url.searchParams.get("board") || "main").slice(0, 64);

  if (req.method === "GET") {
    const since = Number(url.searchParams.get("since") || 0);
    const [row] = await db
      .select({ version: boards.version })
      .from(boards)
      .where(eq(boards.id, id));
    if (!row) return json({ version: 0, now: Date.now() });
    if (since && row.version === since) return json({ version: row.version, now: Date.now() });
    const [full] = await db.select().from(boards).where(eq(boards.id, id));
    return json({ version: full.version, state: full.state, now: Date.now() });
  }

  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "Stato troppo grande" }, 413);
    let body: { state?: any; clientNow?: number };
    try { body = JSON.parse(text); } catch { return json({ error: "JSON non valido" }, 400); }
    const state = body.state;
    if (!state || typeof state !== "object") return json({ error: "Stato mancante" }, 400);

    /* Riporta il timestamp del cronometro all'orologio del server (dispositivi con orari diversi) */
    if (state.timer && typeof state.timer.ts === "number" && typeof body.clientNow === "number") {
      state.timer.ts += Date.now() - body.clientNow;
    }

    const [row] = await db
      .insert(boards)
      .values({ id, state, version: 1 })
      .onConflictDoUpdate({
        target: boards.id,
        set: { state, version: sql`${boards.version} + 1`, updatedAt: sql`now()` },
      })
      .returning({ version: boards.version });
    return json({ version: row.version, now: Date.now() });
  }

  return json({ error: "Metodo non consentito" }, 405);
};

export const config: Config = { path: "/api/state" };
