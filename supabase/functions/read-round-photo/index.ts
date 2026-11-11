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
//   { kind: "scorecard" | "shots", images: [{ media_type: "image/jpeg", data: "<base64>" }] }
// Response:
//   scorecard -> { holes: [{ hole, par, yards, score }] }
//   shots     -> { holes: [{ hole, par, yards, shots: [{ lie, dist }] }] }
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

// The lie names are the options of the app's Hole-by-Hole form.
const Lie = z.enum([
  "FAIRWAY", "GREEN", "MISSED GREEN", "GS BUNKER", "FW BUNKER",
  "LEFT ROUGH", "RIGHT ROUGH", "OB", "RECOVERY", "WATER", "HOLE",
]);

const ScorecardRound = z.object({
  holes: z.array(z.object({
    hole: z.number().int(),
    par: z.number().int(),
    yards: z.number().int(),
    score: z.number().int(),
  })),
});

const ShotsRound = z.object({
  holes: z.array(z.object({
    hole: z.number().int(),
    par: z.number().int(),
    yards: z.number().int(),
    shots: z.array(z.object({ lie: Lie, dist: z.string() })),
  })),
});

const SCORECARD_PROMPT = `These photos show a golf scorecard, possibly handwritten.
Return one entry per hole that has a score written for the player, in hole order.
- hole: the hole number.
- par: the hole's par as printed on the card (3, 4 or 5). Use 4 if it is not legible.
- yards: the hole's yardage if printed, otherwise 0. If several tees are listed, use the first row.
- score: the strokes written for that hole. If several players are on the card, use the first player's row.
Do not include Out, In or Total columns. Do not invent holes that have no score.`;

const SHOTS_PROMPT = `These photos show a golfer's shot-by-shot notes for a round, possibly handwritten.
Each hole lists the hole number, par and yardage, then one entry per shot: where that shot
finished and how far was left to the hole afterwards.
Return one entry per hole, in hole order, with one shot entry per stroke taken:
- lie: where the shot finished. Common shorthand: F fairway, G green, LR / RR left / right rough,
  FB fairway bunker, GB or B greenside bunker, MG missed green, R recovery, W water, OB out of bounds,
  H or "in" holed. A putt that did not go in finishes on the GREEN. The last shot of a finished hole is HOLE.
- dist: the distance left after the shot, digits only, as written (yards off the green, feet when the
  lie is GREEN). Use an empty string when the shot was holed or no distance is written.
- par: 3, 4 or 5. yards: the hole yardage, or 0 if not written.
Record only what is written. Do not add or remove strokes.`;

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

  let body: { kind?: string; images?: { media_type?: string; data?: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const kind = body.kind === "shots" ? "shots" : "scorecard";
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
          { type: "text" as const, text: kind === "shots" ? SHOTS_PROMPT : SCORECARD_PROMPT },
        ],
      }],
      output_config: { format: zodOutputFormat(kind === "shots" ? ShotsRound : ScorecardRound) },
    });

    if (response.stop_reason === "refusal") return json({ error: "The photo could not be read." }, 422);
    const parsed = response.parsed_output;
    if (!parsed || parsed.holes.length === 0) return json({ error: "No holes found in the photo." }, 422);

    const holes = parsed.holes
      .filter((h) => h.hole >= 1 && h.hole <= 18)
      .map((h) => ({ ...h, par: h.par >= 3 && h.par <= 5 ? h.par : 4 }));
    return json({ holes });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "Busy, try again in a minute." }, 429);
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Photo reader is not configured." }, 500);
    if (error instanceof Anthropic.APIError) return json({ error: "The photo could not be read." }, 502);
    return json({ error: "The photo could not be read." }, 500);
  }
});
