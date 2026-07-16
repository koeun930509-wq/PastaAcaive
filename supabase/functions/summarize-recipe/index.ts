import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isYoutubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

async function summarizeWithGemini(youtubeUrl: string) {
  const prompt = `이 유튜브 파스타 요리 영상을 보고 재료 목록과 조리 순서를 추출해주세요.
반드시 아래 JSON 형식으로만 답변하세요 (다른 설명 붙이지 마세요):
{"ingredients": "재료1 · 재료2 · 재료3", "recipe": "1. 첫번째 단계\\n2. 두번째 단계\\n3. 세번째 단계"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ file_data: { file_uri: youtubeUrl } }, { text: prompt }],
          },
        ],
      }),
    },
  );

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const errMsg = data?.error?.message;
    throw new Error(errMsg || "AI 응답을 해석하지 못했습니다.");
  }
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || !isYoutubeUrl(url)) {
      return new Response(JSON.stringify({ error: "유효한 유튜브 링크가 아닙니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = await summarizeWithGemini(url);

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
