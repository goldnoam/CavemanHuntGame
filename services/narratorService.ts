import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateNarration = async (event: string): Promise<string> => {
  if (!ai) return "הרוחות שותקות... (הגדר מפתח API)";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an ancient tribal shaman narrator. 
      Describe the following game event in Hebrew. 
      Keep it short (max 2 sentences), dramatic, primal, and funny.
      Use caveman-style speech (simple grammar).
      
      Event: ${event}`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Narrator error:", error);
    return "הרוחות מבולבלות...";
  }
};
