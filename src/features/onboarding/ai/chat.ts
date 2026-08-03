"use server";

import {
  addPinsToShortlist,
  appendChatMessage,
  ensureChatThread,
  saveShortlistDiagnosis,
} from "../actions";
import type { OnboardingDiagnosis } from "../types";

type CatalogPin = {
  id: string;
  name: string;
  problems?: string[];
  expectedClient?: string[];
  creativePack?: string[];
  column?: string;
  branch?: string;
};

export async function sendOnboardingChat(opts: {
  clientId: string;
  message: string;
  clientSummary: string;
  diagnosis: OnboardingDiagnosis;
  catalogPins: CatalogPin[];
  problems: { id: string; title: string }[];
}): Promise<{ reply: string; addPinIds: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const thread = await ensureChatThread(opts.clientId);
  await appendChatMessage(thread.id, "user", opts.message);

  const pinDigest = opts.catalogPins.slice(0, 200).map((p) => ({
    id: p.id,
    name: p.name,
    problems: (p.problems || []).slice(0, 8),
    expectedClient: (p.expectedClient || []).slice(0, 4),
    creativePack: p.creativePack || [],
    column: p.column,
    branch: p.branch,
  }));

  const system = `You are an onboarding assistant for a creative pin (marketing package) library.
Given client notes and optional diagnosis, recommend relevant pin IDs from the catalog.
Reply with a short helpful message, then a JSON block on its own line in this exact form:
{"addPinIds":["ID1","ID2"]}
Only use pin ids from the catalog. Recommend 3–15 pins when possible.
Client profile:
${opts.clientSummary}
Current diagnosis JSON:
${JSON.stringify(opts.diagnosis)}
Problems (id → title):
${opts.problems
  .slice(0, 80)
  .map((p) => `${p.id}: ${p.title}`)
  .join("\n")}
Catalog pins (compact):
${JSON.stringify(pinDigest)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: opts.message },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = json.choices?.[0]?.message?.content?.trim() || "No response.";

  const validIds = new Set(opts.catalogPins.map((p) => p.id));
  let addPinIds: string[] = [];
  const match = reply.match(/\{[\s\S]*"addPinIds"[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { addPinIds?: string[] };
      addPinIds = (parsed.addPinIds || []).filter((id) => validIds.has(id));
    } catch {
      addPinIds = [];
    }
  }

  await appendChatMessage(thread.id, "assistant", reply);

  if (addPinIds.length) {
    await addPinsToShortlist(opts.clientId, addPinIds, "ai");
    await saveShortlistDiagnosis(opts.clientId, opts.diagnosis);
  }

  return { reply, addPinIds };
}
