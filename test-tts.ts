import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: "hello",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } }
        }
      }
    });
    const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    console.log("Audio generated? ", !!audio);
  } catch(e) {
    console.error("error:", e);
  }
}
run();
