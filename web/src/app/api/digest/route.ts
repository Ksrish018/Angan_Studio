import { digestData, digestHtml } from "@/lib/jobs";

// Preview of the Monday email, exactly as Nikhil would receive it.
export async function GET() {
  const html = digestHtml(await digestData(), process.env.APP_URL ?? "");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
