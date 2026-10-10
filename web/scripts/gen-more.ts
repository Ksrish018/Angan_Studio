// Material swatches and extra room images. Run once: npx tsx --env-file=../.env scripts/gen-more.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const ROOM_STYLE = "Editorial interior photograph, warm natural light, calm and minimal, modern Indian design in Pune, architectural digest style, no people, no text, no logos";
const MAT_STYLE = "Close-up macro product photograph of a material sample, soft daylight, shallow depth of field, fills the frame, no text, no logos";

const JOBS: [string, string, string][] = [
  ["materials/terrazzo", `${MAT_STYLE}. Subject: polished terrazzo with ochre, teal and white chips`, "1:1"],
  ["materials/teak", `${MAT_STYLE}. Subject: oiled teak wood grain`, "1:1"],
  ["materials/limewash", `${MAT_STYLE}. Subject: warm limewash plaster wall texture in linen beige`, "1:1"],
  ["materials/brass", `${MAT_STYLE}. Subject: brushed brass sheet with soft reflections`, "1:1"],
  ["materials/cane", `${MAT_STYLE}. Subject: natural woven cane webbing`, "1:1"],
  ["materials/kota", `${MAT_STYLE}. Subject: honed blue-grey Kota stone floor tile`, "1:1"],
  ["materials/marble", `${MAT_STYLE}. Subject: white marble with soft grey veins`, "1:1"],
  ["materials/terracotta", `${MAT_STYLE}. Subject: handmade terracotta tiles`, "1:1"],
  ["rooms/living", `${ROOM_STYLE}. Subject: a living room with a low teak sofa, terracotta vases and a jaali screen`, "16:9"],
  ["rooms/dining", `${ROOM_STYLE}. Subject: a dining room with a solid wood table, cane chairs and a brass pendant`, "16:9"],
  ["rooms/clinic", `${ROOM_STYLE}. Subject: a calm, design-led clinic reception with oak and sage tones`, "16:9"],
  ["rooms/studio", `${ROOM_STYLE}. Subject: an interior design studio with material samples on a large table and pinned mood boards`, "16:9"],
  ["rooms/consultation", `${ROOM_STYLE}. Subject: a designer's table with floor plans, fabric swatches, a tablet and a cup of chai`, "16:9"],
  ["rooms/phone", `${ROOM_STYLE}. Subject: a smartphone resting on a teak side table beside a ceramic cup, evening lamplight`, "16:9"],
];

async function main() {
  for (const [name, prompt, aspectRatio] of JOBS) {
    const file = new URL(`../public/${name}.jpg`, import.meta.url);
    if (existsSync(file)) { console.log(name, "exists"); continue; }
    mkdirSync(new URL(".", file), { recursive: true });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
      contents: prompt,
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    });
    const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!data) { console.log(name, "no image"); continue; }
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log(name, "saved");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
