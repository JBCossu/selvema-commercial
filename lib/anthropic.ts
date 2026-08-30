import Anthropic from "@anthropic-ai/sdk";
import type { AgencyConfig, ChatMessage } from "./db";
import { buildSystemPrompt, TOOLS } from "./knowledge";

// Modèle demandé pour le chatbot.
export const CHAT_MODEL = "claude-sonnet-4-6";

export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export type ToolCall = {
  name: "enregistrer_prospect" | "demander_rappel";
  input: Record<string, unknown>;
};

export type ChatResult = {
  reply: string;
  toolCalls: ToolCall[];
};

const MAX_TURNS = 4;

// Fait tourner la boucle conversationnelle (avec appels d'outils) et renvoie
// le message final destiné au visiteur + les outils déclenchés.
export async function runChat(
  config: AgencyConfig,
  history: ChatMessage[],
  userMessage: string
): Promise<ChatResult> {
  const client = getAnthropic();
  const system = buildSystemPrompt(config);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const toolCalls: ToolCall[] = [];
  let reply = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system,
      tools: TOOLS as Anthropic.Tool[],
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) reply = text;

    if (response.stop_reason !== "tool_use") break;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.name === "enregistrer_prospect" || block.name === "demander_rappel") {
        toolCalls.push({
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content:
          "Information bien transmise au conseiller de l'agence. Confirme-le au visiteur avec un message court et chaleureux, puis reste disponible.",
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (!reply) {
    reply =
      "Merci ! Un conseiller de l'agence revient vers vous très rapidement. Puis-je vous aider sur autre chose ?";
  }

  return { reply, toolCalls };
}
