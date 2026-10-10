// Generates mood images for the theme options. Run: npx tsx --env-file=../.env scripts/gen-images.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const OUT = new URL("../../design/img/", import.meta.url);

const PROMPTS: Record<string, string> = {
  linen:
    "Editorial interior photograph of a calm Pune apartment living room, limewashed walls in warm linen, terracotta clay vases, low teak furniture, a carved wooden jaali screen casting soft morning shadows, natural light, minimal, architectural digest style, no people, no text",
  atelier:
    "Moody evening interior photograph of a luxury Indian home study, deep walnut panelling, brushed brass lamp glowing, black marble desk, charcoal velvet chair, dramatic low light and long shadows, premium, cinematic, no people, no text",
  gallery:
    "Bright minimalist interior photograph of a modern Indian apartment, white walls, pale oak floor, a single sculptural sage green armchair, large window with sheer curtain, gallery-like negative space, crisp daylight, no people, no text",
  courtyard:
    "Warm photograph of a traditional Indian courtyard (aangan) reimagined in a modern home, terrazzo floor with ochre and teal chips, potted plants, arched openings, sunlit, soft shadows, inviting, no people, no text",
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      console.log(name, "no image returned");
      continue;
    }
    const ext = part.inlineData.mimeType?.includes("jpeg") ? "jpg" : "png";
    writeFileSync(new URL(`${name}.${ext}`, OUT), Buffer.from(part.inlineData.data, "base64"));
    console.log(name, "saved");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
