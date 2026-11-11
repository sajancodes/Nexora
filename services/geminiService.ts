import { Stock } from "../types";

export interface AIChunk {
  reasoning?: string;
  content?: string;
  error?: string;
}

/**
 * Streams NEPSE market analysis from the server-side Gemini 3.8 Flash endpoint (/api/ai/analyze).
 */
export async function streamGeminiAnalysis(
  stocks: Stock[],
  onChunk: (chunk: AIChunk) => void
): Promise<void> {
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stocks }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload) as AIChunk;
          onChunk(parsed);
        } catch {
          // Ignore partial or non-JSON keep-alive lines
        }
      }
    }
  } catch (error) {
    console.error("Nexora Gemini Analysis Error:", error);
    onChunk({
      content:
        "### Analysis Stream Interrupted\nCould not reach the market analysis service. Please verify your connection or try syncing again.",
    });
  }
}
