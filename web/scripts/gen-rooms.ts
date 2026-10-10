// Room imagery for briefs and the sign-in page. Run once: npx tsx --env-file=../.env scripts/gen-rooms.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const OUT = new URL("../public/rooms/", import.meta.url);
const STYLE = "Editorial interior photograph, warm natural light, limewash and teak, terracotta accents, calm and minimal, modern Indian design in Pune, architectural digest style, no people, no text, no logos";

const ROOMS: Record<string, string> = {
  apartment: "a finished 3BHK apartment living and dining area with a jaali screen",
  villa: "a double-height living room in a modern villa with a courtyard view",
  house: "an independent house with a sunlit verandah opening into a living room",
  office: "a calm small design-led office with oak workstations, a glass cabin and plants",
  bedroom: "a serene master bedroom with a cane headboard and linen bedding",
  kitchen: "a modular kitchen with an island opening into a living room",
  signin: "a wide view of a sunlit courtyard home at golden hour, arches, terrazzo floor, potted plants",
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [name, subject] of Object.entries(ROOMS)) {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
      contents: `${STYLE}. Subject: ${subject}.`,
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: name === "signin" ? "3:4" : "16:9" } },
    });
    const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!data) { console.log(name, "no image"); continue; }
    writeFileSync(new URL(`${name}.jpg`, OUT), Buffer.from(data, "base64"));
    console.log(name, "saved");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
