import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export type PlannedSlide = {
  label: string;
  customPrompt: string;
  variationDirection: string;
};

const SYSTEM_PROMPT = `You are a creative director for social media slideshow content.
The user will give you:
- A content concept describing what the slideshow is about
- A reference image style (visual format to replicate)
- A list of variables that should change across slides
- The number of slides to plan

Your job is to plan each slide by filling in the variables with real, specific, coherent content.
Each slide must be distinct — no two slides should cover the same thing.

Return a JSON object with a single key "slides" containing an array with exactly the requested number of objects, each with:
- "label": short name for this slide (e.g. "Chicken Breast", "Tip #3", "Day 2")
- "customPrompt": a complete, self-contained image generation prompt. Include ALL visual/design rules from the concept AND the specific variable values for this slide. Be detailed — this prompt is sent directly to an image model with no other context.
- "variationDirection": a short instruction for how this slide should look visually distinct from the others (lighting, composition, angle, color, etc.)

Rules:
- "customPrompt" must include all design/style rules from the concept plus the slide-specific content
- Use real, accurate data where applicable (e.g. real nutritional values, real facts, real tips)
- Keep the visual format consistent with the base concept across all slides
- Make variationDirection genuinely different for each slide
- Return exactly: {"slides": [...]} — no other keys`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { concept, variables, slideCount, referenceImagePath } = body;

  if (!concept || typeof concept !== "string") {
    return NextResponse.json({ error: "concept is required" }, { status: 400 });
  }
  if (!slideCount || typeof slideCount !== "number" || slideCount < 1 || slideCount > 20) {
    return NextResponse.json({ error: "slideCount must be between 1 and 20" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured. Add it in Settings." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  const userMessage = [
    `Content concept: ${concept.trim()}`,
    variables?.trim() ? `Variables to change per slide: ${variables.trim()}` : null,
    referenceImagePath ? `The reference image defines the visual format/layout — maintain that structure across all slides.` : null,
    `Number of slides to plan: ${slideCount}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "";

    // GPT-4o with json_object wraps arrays — unwrap if needed
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Resolve array: bare array > .slides > .data > .result > first array-valued key
    let slides: unknown;
    if (Array.isArray(parsed)) {
      slides = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      slides =
        obj.slides ??
        obj.data ??
        obj.result ??
        Object.values(obj).find((v) => Array.isArray(v));
    }

    if (!Array.isArray(slides)) {
      return NextResponse.json(
        { error: `AI response was not an array of slides. Raw: ${raw.slice(0, 300)}` },
        { status: 500 }
      );
    }

    const result: PlannedSlide[] = (slides as Record<string, string>[]).map((s, i) => ({
      label: s.label ?? `Slide ${i + 1}`,
      customPrompt: s.customPrompt ?? s.prompt ?? "",
      variationDirection: s.variationDirection ?? "",
    }));

    return NextResponse.json({ slides: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
