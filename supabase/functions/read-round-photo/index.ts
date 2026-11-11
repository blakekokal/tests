// Supabase Edge Function: read-round-photo
//
// Optional AI reader for the app's Photo entry. The app calls this automatically
// when it is deployed and falls back to on-device reading when it is not.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=<your key>
//   supabase functions deploy read-round-photo
//
// Request  (signed-in users only):
//   { images: [{ media_type: "image/jpeg", data: "<base64>" }] }
// Response:
//   { holes: [{ hole, par, yards, score, fairway, gir, putts, penalties }] }
//   fairway / gir: "hit" | "miss" | ""      putts: number, or null when not written
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod";

const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // about 4.5 MB per photo

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Mark = z.enum(["hit", "miss", "none"]);

const ScorecardRound = z.object({
  holes: z.array(z.object({
    hole: z.number().int(),
    par: z.number().int(),
    yards: z.number().int(),
    score: z.number().int(),
    fairway: Mark,
    gir: Mark,
    putts: z.number().int(),
    penalties: z.number().int(),
  })),
});

const SCORECARD_PROMPT = `These photos show a golf scorecard with a player's handwritten rows.
Return one entry per hole that has a score written for the player, in hole order.

Printed rows:
- hole: the hole number.
- par: the hole's par as printed (3, 4 or 5). Use 4 if it is not legible.
- yards: the hole's yardage if printed, otherwise 0. If several tees are listed, use the first row.

Handwritten rows (the player labels each row at its left edge):
- score: the strokes written for the hole. A circle or square drawn around a number is decoration, not a digit.
  If several players are on the card, use the first player's row.
- fairway: the row labelled F (or FIR, Fairway). A check mark, tick or plus means "hit". An x means "miss".
  A blank cell or a dash means "none" (par 3s have no fairway).
- gir: the row labelled G (or GIR, Green). A check mark, tick or plus means "hit". An x means "miss". Blank means "none".
- putts: the row labelled Putts: the number of putts on the hole. Use -1 if the cell is blank or the row is missing.
- penalties: the row labelled Pen (or Penalty): the number of penalty strokes. Blank means 0.

Read each cell under its own hole column; do not shift values sideways to fill blanks.
Do not include Out, In or Total columns. Do not invent holes that have no score. Record only what is written.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Only signed-in app users may spend the API key.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "Please log in to read photos." }, 401);

  let body: { images?: { media_type?: string; data?: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const images = (body.images ?? []).filter((i) => i && typeof i.data === "string");
  if (images.length === 0 || images.length > MAX_IMAGES) {
    return json({ error: `Send between 1 and ${MAX_IMAGES} photos.` }, 400);
  }
  if (images.some((i) => i.data!.length > MAX_IMAGE_BASE64_CHARS)) {
    return json({ error: "Photo is too large." }, 400);
  }

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...images.map((i) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: (i.media_type === "image/png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg",
              data: i.data!,
            },
          })),
          { type: "text" as const, text: SCORECARD_PROMPT },
        ],
      }],
      output_config: { format: zodOutputFormat(ScorecardRound) },
    });

    if (response.stop_reason === "refusal") return json({ error: "The photo could not be read." }, 422);
    const parsed = response.parsed_output;
    if (!parsed || parsed.holes.length === 0) return json({ error: "No holes found in the photo." }, 422);

    const holes = parsed.holes
      .filter((h) => h.hole >= 1 && h.hole <= 18)
      .map((h) => {
        const par = h.par >= 3 && h.par <= 5 ? h.par : 4;
        return {
          hole: h.hole,
          par,
          yards: h.yards,
          score: h.score,
          fairway: par === 3 || h.fairway === "none" ? "" : h.fairway,
          gir: h.gir === "none" ? "" : h.gir,
          putts: h.putts >= 0 ? h.putts : null,
          penalties: Math.max(0, h.penalties),
        };
      });
    return json({ holes });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "Busy, try again in a minute." }, 429);
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Photo reader is not configured." }, 500);
    if (error instanceof Anthropic.APIError) return json({ error: "The photo could not be read." }, 502);
    return json({ error: "The photo could not be read." }, 500);
  }
});
