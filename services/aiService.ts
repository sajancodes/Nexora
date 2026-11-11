import { Stock } from "../types";
import { streamGeminiAnalysis, AIChunk } from "./geminiService";

export type { AIChunk };

export async function streamAnalysis(
  stocks: Stock[],
  onChunk: (chunk: AIChunk) => void
): Promise<void> {
  return streamGeminiAnalysis(stocks, onChunk);
}
