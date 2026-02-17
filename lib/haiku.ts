import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are given a JSON weather snapshot.
Write a single haiku (5-7-5 syllables).

Rules:
- Incorporate at least one raw field name or value from the JSON unchanged
- The three lines must not simply be three separate readings
- Do not name or refer to specific places or landmarks
- Plain lowercase, no punctuation except what feels necessary
- Output only the haiku`;

export async function generateHaiku(rawJson: object): Promise<string> {
  
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(rawJson) }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return block.text.trim();
}
