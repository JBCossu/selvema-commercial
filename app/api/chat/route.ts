import { NextResponse } from "next/server";
import { getDb, getClient, clientReady } from "@/lib/db";
import type { Client, ChatMessage, Lead } from "@/lib/db";
import { runChat, type ToolCall } from "@/lib/anthropic";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { prospectEmail, callbackEmail } from "@/lib/emails";

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
  let body: { clientId?: string; conversationId?: string; message?: string };
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

  // Appel au modèle
  let reply: string;
  let toolCalls: ToolCall[] = [];
  try {
    const result = await runChat(client, history, message);
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
      insert into conversations (client_id, messages, qualified, callback_requested)
      values (${clientId}, ${JSON.stringify(updated)}::jsonb, ${qualified}, ${callback})
      returning id
    `) as { id: string }[];
    convId = rows[0].id;
  }

  // Traitement des outils : création du lead + email au dirigeant
  for (const call of toolCalls) {
    try {
      await handleToolCall(sql, client, convId, call);
    } catch (err) {
      console.error("tool handling error", call.name, err);
    }
  }

  return NextResponse.json({ conversationId: convId, reply });
}

async function handleToolCall(
  sql: ReturnType<typeof getDb>,
  client: Client,
  conversationId: string,
  call: ToolCall
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

    const { subject, html } = prospectEmail(client, rows[0]);
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      replyTo: rows[0].email ?? undefined,
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
