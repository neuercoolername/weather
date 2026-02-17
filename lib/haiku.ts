import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are given a JSON weather snapshot.
Your task is to write a single haiku (5-7-5 syllables).

Rules:
- You MUST incorporate at least one raw field name or value from the JSON unchanged (e.g. "is_day: 0", "-0.1", "8.9")
- No metaphors, no emotions, no pathetic fallacy
- Do not explain or comment, output only the haiku
- Plain lowercase, no punctuation except what feels necessary
- The haiku should feel found, not written`;

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
