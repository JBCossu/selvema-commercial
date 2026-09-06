import { NextResponse } from "next/server";
import { getDb, getClient, clientReady } from "@/lib/db";
import type { Client, ChatMessage, Lead } from "@/lib/db";
import { runChat, type ToolCall } from "@/lib/anthropic";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { prospectEmail, callbackEmail } from "@/lib/emails";
import { scoreConversation } from "@/lib/scoring";
import { isVisitorId, getVisitorMemory, visitorMemoryPrompt } from "@/lib/visitor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HISTORY = 20;
const MAX_MESSAGE_LEN = 2000;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export async function POST(request: Request) {
  let body: {
    clientId?: string;
    conversationId?: string;
    message?: string;
    visitorId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const clientId =
    typeof body.clientId === "string" && body.clientId ? body.clientId : null;
  if (!clientId) {
    return NextResponse.json({ error: "clientId manquant." }, { status: 400 });
  }

  const message = (body.message ?? "").toString().slice(0, MAX_MESSAGE_LEN).trim();
  if (!message) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId
      ? body.conversationId
      : null;

  // Identifiant visiteur anonyme (mémoire). Ignoré s'il n'a pas la forme d'un UUID.
  const visitorId = isVisitorId(body.visitorId) ? body.visitorId : null;

  let client: Client | null;
  try {
    client = await getClient(clientId);
  } catch (err) {
    console.error("getClient error", err);
    return NextResponse.json(
      { error: "Service momentanément indisponible." },
      { status: 502 }
    );
  }

  if (!clientReady(client)) {
    return NextResponse.json({
      conversationId,
      reply:
        "L'assistant en ligne n'est pas disponible pour le moment. Merci de revenir un peu plus tard.",
    });
  }

  const sql = getDb();

  // Historique (scopé au client)
  let history: ChatMessage[] = [];
  if (conversationId) {
    const rows = (await sql`
      select messages from conversations
      where id = ${conversationId} and client_id = ${clientId}
    `) as { messages: ChatMessage[] }[];
    if (rows[0]?.messages) history = rows[0].messages.slice(-MAX_HISTORY);
  }

  // Mémoire visiteur : pour une NOUVELLE conversation, si ce visiteur a déjà
  // échangé avec ce client, on rappelle sa précédente visite au modèle.
  let visitorMemory: string | undefined;
  if (!conversationId && visitorId) {
    try {
      const mem = await getVisitorMemory(clientId, visitorId);
      if (mem) visitorMemory = visitorMemoryPrompt(mem);
    } catch (err) {
      console.error("getVisitorMemory error", err);
    }
  }

  // Appel au modèle
  let reply: string;
  let toolCalls: ToolCall[] = [];
  try {
    const result = await runChat(client, history, message, { visitorMemory });
    reply = result.reply;
    toolCalls = result.toolCalls;
  } catch (err) {
    console.error("runChat error", err);
    return NextResponse.json(
      { error: "L'assistant est momentanément indisponible." },
      { status: 502 }
    );
  }

  const updated: ChatMessage[] = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ];

  const qualified = toolCalls.some((t) => t.name === "enregistrer_prospect");
  const callback = toolCalls.some((t) => t.name === "demander_rappel");

  // Persistance de la conversation
  let convId = conversationId;
  if (convId) {
    await sql`
      update conversations
      set messages = ${JSON.stringify(updated)}::jsonb,
          updated_at = now(),
          qualified = qualified or ${qualified},
          callback_requested = callback_requested or ${callback}
      where id = ${convId} and client_id = ${clientId}
    `;
  } else {
    const rows = (await sql`
      insert into conversations
        (client_id, visitor_id, messages, qualified, callback_requested)
      values
        (${clientId}, ${visitorId}, ${JSON.stringify(updated)}::jsonb,
         ${qualified}, ${callback})
      returning id
    `) as { id: string }[];
    convId = rows[0].id;
  }

  // Traitement des outils : création du lead + email au dirigeant
  for (const call of toolCalls) {
    try {
      await handleToolCall(sql, client, convId, call, updated);
    } catch (err) {
      console.error("tool handling error", call.name, err);
    }
  }

  // Scoring : recalculé à CHAQUE message. Si un lead qualifié existe déjà pour
  // cette conversation et qu'aucun n'a été créé à ce tour (déjà scoré dans
  // handleToolCall), on met son score à jour à partir de la conversation
  // complète. Best-effort : une erreur de scoring ne casse jamais le chat.
  if (!qualified) {
    try {
      await rescoreConversationLead(sql, client, convId, updated);
    } catch (err) {
      console.error("rescore error", err);
    }
  }

  return NextResponse.json({ conversationId: convId, reply });
}

/** Calcule le score et l'enregistre sur un lead donné. */
async function applyScore(
  sql: ReturnType<typeof getDb>,
  client: Client,
  leadId: string,
  messages: ChatMessage[]
): Promise<Partial<Lead>> {
  const { score, category, breakdown } = await scoreConversation(client, messages);
  await sql`
    update leads
    set score = ${score},
        score_category = ${category},
        score_breakdown = ${JSON.stringify(breakdown)}::jsonb,
        score_updated_at = now()
    where id = ${leadId}
  `;
  return {
    score,
    score_category: category,
    score_breakdown: breakdown,
    score_updated_at: new Date().toISOString(),
  };
}

/** Re-score le lead qualifié rattaché à la conversation (s'il existe). */
async function rescoreConversationLead(
  sql: ReturnType<typeof getDb>,
  client: Client,
  conversationId: string,
  messages: ChatMessage[]
) {
  const rows = (await sql`
    select id from leads
    where conversation_id = ${conversationId}
      and client_id = ${client.id}
      and kind = 'qualifie'
    order by created_at asc
    limit 1
  `) as { id: string }[];
  if (rows[0]) await applyScore(sql, client, rows[0].id, messages);
}

async function handleToolCall(
  sql: ReturnType<typeof getDb>,
  client: Client,
  conversationId: string,
  call: ToolCall,
  messages: ChatMessage[]
) {
  const i = call.input;

  if (call.name === "enregistrer_prospect") {
    const rows = (await sql`
      insert into leads
        (client_id, conversation_id, name, email, phone, project_type, budget,
         property_type, location, timeline, situation, summary, kind, status)
      values
        (${client.id}, ${conversationId}, ${str(i.name)}, ${str(i.email)},
         ${str(i.phone)}, ${str(i.project_type)}, ${str(i.budget)},
         ${str(i.property_type)}, ${str(i.location)}, ${str(i.timeline)},
         ${str(i.situation)}, ${str(i.summary)}, 'qualifie', 'nouveau')
      returning *
    `) as Lead[];

    let lead = rows[0];
    // Score à la création de la fiche, pour qu'il figure dans l'email dirigeant.
    try {
      lead = { ...lead, ...(await applyScore(sql, client, lead.id, messages)) };
    } catch (err) {
      console.error("scoring at creation error", err);
    }

    const { subject, html } = prospectEmail(client, lead);
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      replyTo: lead.email ?? undefined,
      subject,
      html,
    });
    return;
  }

  if (call.name === "demander_rappel") {
    const rows = (await sql`
      insert into leads
        (client_id, conversation_id, name, email, phone, summary, kind, status)
      values
        (${client.id}, ${conversationId}, ${str(i.name)}, ${str(i.email)},
         ${str(i.phone)}, ${str(i.question)}, 'rappel', 'nouveau')
      returning *
    `) as Lead[];

    const { subject, html } = callbackEmail(client, rows[0]);
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      replyTo: rows[0].email ?? undefined,
      subject,
      html,
    });
  }
}
