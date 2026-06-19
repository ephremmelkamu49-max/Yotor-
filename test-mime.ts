import { GoogleGenAI, Modality } from "@google/genai";
import fs from 'fs';
import dotenv from "dotenv";
dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: "Hello world!",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } }
        }
      }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  console.log("Mime type:", data?.mimeType);
  if (data?.data) {
     const pcmStr = data.data.substring(0, 50);
     console.log("Base64 preview:", pcmStr);
     // Let's write the RAW base64 decoded data to a file without wav wrapper
     fs.writeFileSync('raw.bin', Buffer.from(data.data, 'base64'));
  }
}
run();
