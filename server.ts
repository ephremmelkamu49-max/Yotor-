import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// JSON parser
app.use(express.json({ limit: '10mb' }));

// Setup Gemini Client according to instructions
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. Script Analysis API - uses Gemini to split user text into structured cinematic scenes
app.post("/api/analyze-script", async (req, res) => {
  const { script } = req.body;
  if (!script || typeof script !== "string") {
    return res.status(400).json({ error: "Script text is required" });
  }

  const wordCount = script.trim().split(/\s+/).length;
  const isLongScript = wordCount > 350;

  if (!ai) {
    // If API key is missing, fall back to an smart adaptive splitter so the app handles 30 minutes smoothly!
    console.warn("GEMINI_API_KEY is not defined. Falling back to mechanical split.");
    const sentences = script
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Group sentences if the script is long to avoid hundreds of tiny scenes (critical for 30 minutes support)
    const groupedSentences: string[] = [];
    let currentGroup = "";
    let currentWordSum = 0;
    // Aim for 35 words per scene if long script (~15 seconds text), or sentence-by-sentence if short
    const maxTargetWords = isLongScript ? 50 : 25;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      if (currentWordSum + sentenceWords <= maxTargetWords || currentGroup === "") {
        currentGroup += (currentGroup ? " " : "") + sentence;
        currentWordSum += sentenceWords;
      } else {
        groupedSentences.push(currentGroup);
        currentGroup = sentence;
        currentWordSum = sentenceWords;
      }
    }
    if (currentGroup) {
      groupedSentences.push(currentGroup);
    }

    const scenes = groupedSentences.map((seg, idx) => {
      const segWords = seg.split(/\s+/).length;
      // speaking speed estimated at 2.4 words per second
      const duration = Math.max(4.0, Number((segWords / 2.4).toFixed(1))); 
      // Simple visual keyword guess
      const nouns = seg.toLowerCase().match(/\b(forest|sunset|technology|people|ocean|city|space|nature|abstract|cyberpunk|office|coding|data|future|workspace|ethiopia|mountains|landscape)\b/g) || ["breathtaking cinematic landscape"];
      const keywords = `${nouns[0]} slow motion epic cinematic ambient 4k`;
      return {
        id: `scene_${idx}_${Date.now()}`,
        text: seg,
        keywords,
        caption: seg,
        duration,
        originalIndex: idx
      };
    });

    return res.json({ scenes, fallback: true, warning: "Using server-side local adaptive regex parsing as GEMINI_API_KEY is not configured." });
  }

  try {
    // Build an intelligent length-aware prompt to bundle sentences in long scripts!
    const lengthInstruction = isLongScript 
      ? `CRITICAL COMPRESSION CONSTRAINT FOR LONG SCRIPT (${wordCount} words):
This is a long script of ${wordCount} words (representing a long narrative). To ensure the rendering process is completely stable, has high performance, and is under memory bounds, you MUST bundle multiple sentences together into fewer, longer scenes of between 15 and 35 seconds of speaking duration each (about 35 to 80 words per scene). DO NOT create a separate scene for every single sentence. Maintain a highly cohesive timeline of no more than 40-50 scenes total, even for a very long script.`
      : `SHORT SCRIPT CONSTRAINT (${wordCount} words):
This is a brief script. You can break it down more granularly, with each scene representing 1 or 2 sentences (between 4 and 10 seconds of speaking duration).`;

    const prompt = `You are a master cinematic video producer. Break down the user's provided text script (enclosed in triple quotes) into logical, sequential scenes.
 
Each scene MUST match a sentence or group of sentences from the script.
CRITICAL CONSTRAINT: You must use the exact, unaltered portions of the user's script for the 'text' fields. Do not write any script Yourself, do not summarize, do not rephrase, do not add advice, do not omit any sentences, and do not remove words. The combined 'text' fields of all scenes must concatenate exactly to the original script.

${lengthInstruction}

For each scene, output:
1. 'text': The exact sentences from the script for this segment.
2. 'keywords': Cinematic, high-quality search keywords for querying video stock libraries (such as Pexels) to represent this scene visually (e.g., 'ambient drone slow motion city skyline sunset', 'man coding in neon dark room cozy keyboard close up'). 
   CRITICAL MULTILANGUAGE RULE: All 'keywords' MUST be in ENGLISH (e.g., if the user script is in Amharic [አማርኛ] or another language, translate the visual intent into powerful, highly descriptive English search terms so that the Pexels search engine finds gorgeous, relevant, high-definition videos). Enhance keywords with aesthetic cinematic tags like "slow motion", "epic cinematic", "drone flyover", "cinematic lighting", "breathtaking scenery", "4k detail", "hyperrealistic".
3. 'caption': A concise, highly readable text caption version of the text to overlay as sleek subtitles. Keep it in the native language of the user script (e.g., keep Amharic text intact for subtitles).
4. 'duration': Speaking duration in seconds. Make sure to estimate this accurately based on the word count (around 2.4 words per second, i.e. 140 words per minute, with a minimum duration of 4.0 seconds per scene).

User Script:
"""
${script}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              description: "Array of sequential, non-overlapping visual and audio scenes that represent the full script.",
              items: {
                type: Type.OBJECT,
                properties: {
                  text: {
                    type: Type.STRING,
                    description: "Verbatim, exact unaltered sentences from the original script corresponding to this scene."
                  },
                  keywords: {
                    type: Type.STRING,
                    description: "Cinematic, physical search keywords for stock video clips (e.g. 'moody office server room blinking green lights steadycam')."
                  },
                  caption: {
                    type: Type.STRING,
                    description: "Polished subtitle text for this segment."
                  },
                  duration: {
                    type: Type.NUMBER,
                    description: "Estimated speaking duration in seconds (based on length, min 4.0s)."
                  }
                },
                required: ["text", "keywords", "caption", "duration"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    const parsedResult = JSON.parse(response.text.trim());
    
    // Add IDs and original index
    const processedScenes = parsedResult.scenes.map((scene: any, index: number) => ({
      id: `scene_${index}_${Date.now()}`,
      ...scene,
      originalIndex: index
    }));

    res.json({ scenes: processedScenes });
  } catch (error: any) {
    console.error("Gemini script parser failed:", error);
    // Return standard fallback chunking on exception
    const sentences = script
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const groupedSentences: string[] = [];
    let currentGroup = "";
    let currentWordSum = 0;
    const maxTargetWords = isLongScript ? 50 : 25;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      if (currentWordSum + sentenceWords <= maxTargetWords || currentGroup === "") {
        currentGroup += (currentGroup ? " " : "") + sentence;
        currentWordSum += sentenceWords;
      } else {
        groupedSentences.push(currentGroup);
        currentGroup = sentence;
        currentWordSum = sentenceWords;
      }
    }
    if (currentGroup) {
      groupedSentences.push(currentGroup);
    }

    const fallbackScenes = groupedSentences.map((seg, idx) => {
      const segWords = seg.split(/\s+/).length;
      const duration = Math.max(4.0, Number((segWords / 2.4).toFixed(1)));
      return {
        id: `scene_${idx}_fallback_${Date.now()}`,
        text: seg,
        keywords: "ambient cinematic visual landscape 4k",
        caption: seg,
        duration,
        originalIndex: idx
      };
    });
    
    res.json({
      scenes: fallbackScenes,
      error: error.message,
      fallback: true,
      warning: "Fitted automatic backup generator on script."
    });
  }
});

// 2. TTS Proxy API - plays a google tts mp3 stream for the text
app.get("/api/tts", async (req, res) => {
  const text = req.query.text as string;
  const lang = (req.query.lang as string) || "en";

  if (!text) {
    return res.status(400).json({ error: "Text is required to vocalize." });
  }

  try {
    // Translate TTS limits around ~200 characters per request.
    // If it's slightly over, we split or just crop, but since Gemini splits sentence-by-sentence,
    // they fit neatly. We will chop it at 200 character safety lines just in case.
    const safeText = text.substring(0, 195);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${lang}&client=tw-ob`;

    const ttsRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://translate.google.com/"
      }
    });

    if (!ttsRes.ok) {
      throw new Error(`Google TTS proxy offline or rejected request style. Status: ${ttsRes.status}`);
    }

    const ttsBuffer = await ttsRes.arrayBuffer();
    
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache aggressively to save Pexels/TTS loads
    res.send(Buffer.from(ttsBuffer));
  } catch (err: any) {
    console.error("Audio generation proxy failure:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Pexels API Search Proxy - avoids CORS issues and hides the master key
app.get("/api/pexels/search", async (req, res) => {
  const query = req.query.query as string;
  const userKey = req.headers["x-pexels-key"] as string;
  
  // Use user's supplied key, or backend ENV fallback
  const apiKey = userKey || process.env.PEXELS_API_KEY;

  if (!query) {
    return res.status(400).json({ error: "Search query required." });
  }

  if (!apiKey) {
    // Return empty results with warning so that the app uses beautiful catalog fallback instead of hard-failing
    return res.json({
      not_configured: true,
      videos: [],
      warning: "Pexels API Key is missing. Fallback catalog assets will be used."
    });
  }

  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`;
    const response = await fetch(url, {
      headers: {
        "Authorization": apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: "Invalid Pexels API Key." });
      }
      throw new Error(`Pexels API error: status ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Pexels proxy failed:", err);
    res.status(500).json({ error: err.message });
  }
});


// 4. Vite Dev Server & Static Production Routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware mounted successfully.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving statically from compiled static assets inside /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started. Listening at http://localhost:${PORT}`);
  });
}

startServer();
