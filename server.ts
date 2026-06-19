import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// JSON parser
app.use(express.json({ limit: '10mb' }));

function pcmToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const wavHeader = Buffer.alloc(44);
  // RIFF chunk
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + dataSize, 4);
  wavHeader.write('WAVE', 8);
  // fmt sub-chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  // data sub-chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

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
      .split(/(?<=[.!?።፧])\s+/)
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

    let responseText = response.text.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    const parsedResult = JSON.parse(responseText.trim());
    
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
      .split(/(?<=[.!?።፧])\s+/)
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
    const safeText = text.substring(0, 195);
    
    let fallbackToGoogle = false;
    let fallbackLang = lang;

    if (lang.startsWith('am-yotor') && ai) {
      let voiceName = "Charon"; // default
      if (lang === 'am-yotor-epic-male') voiceName = "Charon";
      else if (lang === 'am-yotor-warm-female') voiceName = "Aoede";
      else if (lang === 'am-yotor-bright-female') voiceName = "Kore";
      else if (lang === 'am-yotor-rugged-male') voiceName = "Fenrir";

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: safeText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const pcmBuffer = Buffer.from(base64Audio, 'base64');
          const wavBuffer = pcmToWav(pcmBuffer, 24000);
          
          res.setHeader("Content-Type", "audio/wav");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(wavBuffer);
        } else {
           fallbackToGoogle = true;
           fallbackLang = 'am';
        }
      } catch (geminiError: any) {
        console.warn("Gemini TTS failed (likely quota exceeded), falling back:", geminiError.message);
        fallbackToGoogle = true;
        fallbackLang = 'am';
      }
    } else if (lang.startsWith('am-yotor')) {
      // If am-yotor is requested but no API key is available
      fallbackLang = 'am';
    }

    // Google Translate TTS fallback
    const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${fallbackLang}&q=${encodeURIComponent(safeText)}`;

    const ttsRes = await fetch(url);

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


// 4. Thumbnail Generation API - uses Gemini to generate a YouTube-style thumbnail
app.post("/api/thumbnail", async (req, res) => {
  try {
    if (!ai) {
      throw new Error("AI features require GEMINI_API_KEY environment variable to be set.");
    }
    const { aspectRatio, scenesText } = req.body;
    
    // 1. Generate visual image prompt using text model
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: `You are an expert YouTube Thumbnail designer. Generate a highly detailed image generation prompt for an amazing, eye-catching, highly clickable video thumbnail based on this video script snippet. The thumbnail should be cinematic, vibrant, and highly dramatic. IMPORTANT: Do NOT include text or typography instructions in the image prompt, just describe the raw visual composition and lighting.

Video Script:
${scenesText.substring(0, 1000)}`
    });

    let imagePrompt = promptResponse.text?.trim() || "cinematic colorful abstract background 4k";

    // 2. Generate Image using gemini-3.1-flash-image
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [{ text: imagePrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio === '9:16' ? '9:16' : (aspectRatio === '1:1' ? '1:1' : '16:9'),
          imageSize: "1K"
        }
      }
    });

    let imageUrl = null;
    if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("No image was returned from the model.");
    }

    res.json({ imageUrl, prompt: imagePrompt });
  } catch(e: any) {
    console.error("Thumbnail generation failed:", e);
    res.status(500).json({ error: e.message });
  }
});

// 5. Vite Dev Server & Static Production Routing
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

  // 3. AI Copilot endpoint - handles user commands and modifies project config and scenes
app.post("/api/copilot", async (req, res) => {
  try {
    if (!ai) {
      throw new Error("AI features require GEMINI_API_KEY environment variable to be set.");
    }
    const { command, projectConfig, scenes } = req.body;

    // Use a robust prompt to process any action
    const prompt = `You are "Yotor AI Copilot", an AI assistant in a video generation studio. 
The user is speaking in Amharic (or English) and wants to command the studio: "${command}"

Current Project Config:
${JSON.stringify(projectConfig, null, 2)}

Current Scenes:
${JSON.stringify(scenes, null, 2)}

Instructions:
1. Figure out what the user wants to change. (E.g. change font size, change color, update duration of all scenes, alter aspect ratio, add a new scene, set transition/Zoom Blur/Crossfade effects, or just a general chat/promo request).
2. If changing config (e.g., subtitleStyle, aspectRatio, musicVolume, transitionType, transitionDuration), set "updateConfig" to true and return the WHOLE modified projectConfig object.
3. If changing scenes (e.g., duration, caption, text, adding/removing scenes), set "updateScenes" to true and return the WHOLE modified scenes array. 
4. Remember: KEEP all existing properties in scenes (like videoUrl, voiceoverUrl, id, videoThumb) exactly as they are unless instructed to change them!
5. Provide a helpful response in Amharic in "responseText". Let the user know what was done.

Return ONLY JSON matching the schema.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        responseText: { type: Type.STRING, description: "Helpful response in Amharic explaining what you did." },
        updateConfig: { type: Type.BOOLEAN },
        projectConfig: { type: Type.OBJECT, description: "The modified project configuration, only if updateConfig is true" },
        updateScenes: { type: Type.BOOLEAN },
        scenes: { type: Type.ARRAY, description: "The modified scenes array, only if updateScenes is true", items: { type: Type.OBJECT } }
      },
      required: ["responseText", "updateConfig", "updateScenes"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    });

    let responseTextRaw = response.text.trim();
    if (responseTextRaw.startsWith('```json')) {
      responseTextRaw = responseTextRaw.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (responseTextRaw.startsWith('```')) {
      responseTextRaw = responseTextRaw.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    const result = JSON.parse(responseTextRaw);
    res.json(result);
  } catch (error: any) {
    console.error("Copilot operation failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started. Listening at http://localhost:${PORT}`);
  });
}

startServer();
