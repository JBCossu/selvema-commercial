import type Anthropic from "@anthropic-ai/sdk";
import type {
  Client,
  ChatMessage,
  LeadScoreBreakdown,
  LeadScoreCategory,
} from "./db";
import { getAnthropic, CHAT_MODEL } from "./anthropic";
import { knowledgeBasePrompt } from "./knowledge";
import { scoreCategory, SCORE_META } from "./score-meta";

export { scoreCategory, SCORE_META };

/**
 * Scoring commercial automatique d'un prospect, de 0 à 100.
 * L'API Anthropic lit la conversation complète et coche chaque critère ;
 * le total des points est calculé ici (déterministe). Recalculé à chaque
 * nouveau message de la conversation (voir app/api/chat/route.ts).
 */

// Modèle utilisé pour le scoring (réutilise celui du chatbot pour être sûr
// qu'il est disponible avec la clé du projet ; peut passer à un modèle plus
// léger si le coût devient un sujet).
const SCORE_MODEL = CHAT_MODEL;

type Crit =
  | "budget_coherent"
  | "zone_couverte"
  | "projet_clair"
  | "delai_court"
  | "intention_forte";

/** Barème : 25 + 20 + 15 + 20 + 20 = 100. */
const POINTS: Record<Crit, number> = {
  budget_coherent: 25,
  zone_couverte: 20,
  projet_clair: 15,
  delai_court: 20,
  intention_forte: 20,
};

const LABELS: Record<Crit, string> = {
  budget_coherent: "Budget cohérent avec les biens de l'agence",
  zone_couverte: "Zone géographique dans la zone de l'agence",
  projet_clair: "Type de projet clair (achat / vente / location / investissement)",
  delai_court: "Délai précis mentionné (moins de 6 mois)",
  intention_forte: "Intention forte détectée dans la conversation",
};

const SCORE_TOOL: Anthropic.Tool = {
  name: "attribuer_score",
  description:
    "Évalue le potentiel commercial du prospect à partir de la conversation complète.",
  input_schema: {
    type: "object",
    properties: {
      budget_coherent: {
        type: "boolean",
        description:
          "true UNIQUEMENT si le visiteur évoque un budget (ou un prix de vente) réaliste et cohérent avec les biens et les niveaux de prix décrits dans la base de connaissances de l'agence. false si aucun budget n'est mentionné ou s'il est manifestement hors sujet.",
      },
      zone_couverte: {
        type: "boolean",
        description:
          "true UNIQUEMENT si le secteur / la ville / le quartier recherché par le visiteur fait partie des zones couvertes par l'agence (base de connaissances). false si aucune localisation n'est donnée.",
      },
      projet_clair: {
        type: "boolean",
        description:
          "true si le type de projet est explicite : achat, vente, location ou investissement locatif.",
      },
      delai_court: {
        type: "boolean",
        description:
          "true UNIQUEMENT si le visiteur mentionne un délai précis et rapproché, à moins de 6 mois (par exemple « d'ici l'été », « dans 2 mois », « rapidement »). false si le délai est flou, lointain ou absent.",
      },
      intention_forte: {
        type: "boolean",
        description:
          "true si la conversation révèle une intention forte et concrète : urgence, financement déjà en place, visite demandée, coordonnées données spontanément, projet clairement mûr et engagé.",
      },
      hors_criteres: {
        type: "boolean",
        description:
          "true UNIQUEMENT si la section « RÈGLES DE QUALIFICATION DE L'AGENCE » est renseignée ET que le projet du visiteur enfreint clairement ces règles (budget sous le minimum, budget au-dessus du maximum, secteur hors des zones prioritaires, type de projet non accepté, délai au-delà du maximum, ou critère éliminatoire déclenché). false si aucune règle n'est fournie ou en cas de doute.",
      },
      motif_hors_criteres: {
        type: "string",
        description:
          "Si hors_criteres est true : une phrase indiquant quelle règle est enfreinte. Sinon chaîne vide.",
      },
      analyse: {
        type: "string",
        description: "1 à 2 phrases sobres justifiant l'évaluation.",
      },
    },
    required: [
      "budget_coherent",
      "zone_couverte",
      "projet_clair",
      "delai_court",
      "intention_forte",
      "hors_criteres",
      "motif_hors_criteres",
      "analyse",
    ],
    additionalProperties: false,
  },
};

// Score plafond quand le prospect est hors des critères de l'agence.
const HORS_CRITERES_CAP = 15;

function transcript(messages: ChatMessage[]): string {
  return messages
    .map(
      (m) => `${m.role === "user" ? "Visiteur" : "Assistant"} : ${m.content}`
    )
    .join("\n");
}

export type LeadScore = {
  score: number;
  category: LeadScoreCategory;
  breakdown: LeadScoreBreakdown;
};

/**
 * Analyse la conversation et renvoie le score, la catégorie et le détail.
 * Lève une erreur si le modèle ne renvoie pas d'évaluation exploitable.
 */
export async function scoreConversation(
  client: Client,
  messages: ChatMessage[]
): Promise<LeadScore> {
  const anthropic = getAnthropic();

  const system = `Tu es analyste commercial pour une agence immobilière. On te donne l'intégralité d'une conversation entre un visiteur et l'assistant en ligne de l'agence, ainsi que la base de connaissances de l'agence (dont, si elle est renseignée, la section « RÈGLES DE QUALIFICATION DE L'AGENCE »).

Évalue le potentiel commercial du visiteur en appelant l'outil \`attribuer_score\`. Sois strict et factuel : ne coche un critère que si l'information est réellement présente dans la conversation. En cas de doute, coche false. Si des règles de qualification sont fournies et que le projet les enfreint clairement, coche \`hors_criteres\`.

${knowledgeBasePrompt(client)}`;

  const response = await anthropic.messages.create({
    model: SCORE_MODEL,
    max_tokens: 512,
    system,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: "attribuer_score" },
    messages: [
      {
        role: "user",
        content: `Conversation à analyser :\n\n${transcript(messages)}`,
      },
    ],
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === "attribuer_score"
  );
  if (!block) {
    throw new Error("scoreConversation: pas d'appel d'outil dans la réponse");
  }

  const input = (block.input ?? {}) as Record<string, unknown>;
  const bool = (k: Crit) => input[k] === true;

  const crits = (Object.keys(POINTS) as Crit[]).reduce((acc, k) => {
    const ok = bool(k);
    acc[k] = { label: LABELS[k], ok, points: ok ? POINTS[k] : 0 };
    return acc;
  }, {} as Record<Crit, { label: string; ok: boolean; points: number }>);

  let score = (Object.values(crits) as { points: number }[]).reduce(
    (s, c) => s + c.points,
    0
  );

  // Hors critères de l'agence → score plafonné très bas, quelle que soit la
  // somme des points.
  const horsCriteres = input.hors_criteres === true;
  const motif =
    typeof input.motif_hors_criteres === "string"
      ? input.motif_hors_criteres.trim()
      : "";
  if (horsCriteres) score = Math.min(score, HORS_CRITERES_CAP);

  const breakdown: LeadScoreBreakdown = {
    ...crits,
    analyse: typeof input.analyse === "string" ? input.analyse.trim() : undefined,
    ...(horsCriteres
      ? { hors_criteres: true, motif_hors_criteres: motif || undefined }
      : {}),
  };

  return { score, category: scoreCategory(score), breakdown };
}
