import { GoogleGenAI } from "@google/genai";
const GEMINI_API_KEY = "AIzaSyBRHBpfhBnLDXFasC1fmvuSkZo0ZBHJsMc";
const GEMINI_API_KEY2 = "AIzaSyCQwgf6an2inqktrG4l-h7Yo77ZiZ2dpm4";
const GEMINI_API_KEY3 = "AIzaSyAJbkhxhW6xrRhLZQUXOKGvdZdv40YcKd4";

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY3,
});

export const model = async (prompt: string) => {
  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: prompt,
  });

  return result.text || "";
};
