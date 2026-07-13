import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchTranscript(videoId: string): Promise<string> {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await pageRes.text();
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) throw new Error("이 영상에는 자막이 없어서 자동 요약을 할 수 없습니다.");

  const tracks = JSON.parse(match[1]);
  const track = tracks.find((t: any) => t.languageCode === "ko") ?? tracks[0];
  const xmlRes = await fetch(track.baseUrl);
  const xml = await xmlRes.text();

  return [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => decodeHtmlEntities(m[1]))
    .join(" ");
}

async function summarizeWithGemini(transcript: string) {
  const prompt = `다음은 파스타 요리 유튜브 영상의 자막입니다. 이 내용에서 재료 목록과 조리 순서를 추출해주세요.
반드시 아래 JSON 형식으로만 답변하세요 (다른 설명 붙이지 마세요):
{"ingredients": "재료1 · 재료2 · 재료3", "recipe": "1. 첫번째 단계\\n2. 두번째 단계\\n3. 세번째 단계"}

자막:
${transcript.slice(0, 8000)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답을 해석하지 못했습니다.");
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const videoId = extractVideoId(url ?? "");
    if (!videoId) {
      return new Response(JSON.stringify({ error: "유효한 유튜브 링크가 아닙니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = await fetchTranscript(videoId);
    const summary = await summarizeWithGemini(transcript);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
