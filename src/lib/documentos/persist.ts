import { createOutpatientDocument, getOutpatientDocumentsByPatient } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { OutpatientDocument, StoredOutpatientDocument } from "./types";

const MAX_LOCAL = 200;

function localId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function saveLocal(doc: OutpatientDocument): StoredOutpatientDocument {
  const stored: StoredOutpatientDocument = {
    id: localId(),
    type: doc.type,
    title: doc.title,
    patient_id: doc.patientId,
    content: doc.content,
    created_at: new Date().toISOString(),
    origem: "local",
  };
  const all = storage.getDocumentos() as StoredOutpatientDocument[];
  storage.setDocumentos([stored, ...all].slice(0, MAX_LOCAL));
  return stored;
}

export interface SaveResult {
  doc: StoredOutpatientDocument;
  origem: "supabase" | "local";
  erro?: string;
}

export async function saveOutpatientDocument(
  doc: OutpatientDocument,
  userId: string | null,
): Promise<SaveResult> {
  const podeUsarBanco = Boolean(userId) && !(doc.patientId && doc.patientId.startsWith("temp_"));
  if (podeUsarBanco) {
    try {
      const row = await createOutpatientDocument(
        {
          type: doc.type,
          title: doc.title,
          patient_id: doc.patientId,
          content: doc.content as unknown as Record<string, unknown>,
        },
        userId!,
      );
      return {
        doc: {
          id: row.id,
          type: doc.type,
          title: doc.title,
          patient_id: doc.patientId,
          content: doc.content,
          created_at: row.created_at,
          origem: "supabase",
        },
        origem: "supabase",
      };
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      return { doc: saveLocal(doc), origem: "local", erro };
    }
  }
  return { doc: saveLocal(doc), origem: "local" };
}

export async function listOutpatientDocuments(
  patientId: string | null,
  userId: string | null,
): Promise<StoredOutpatientDocument[]> {
  const local = (storage.getDocumentos() as StoredOutpatientDocument[]).filter(
    (d) => !patientId || d.patient_id === patientId,
  );
  if (!userId || !patientId || patientId.startsWith("temp_")) return local;
  try {
    const rows = await getOutpatientDocumentsByPatient(patientId, userId);
    const remote: StoredOutpatientDocument[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      patient_id: r.patient_id,
      content: r.content as unknown as StoredOutpatientDocument["content"],
      created_at: r.created_at,
      origem: "supabase",
    }));
    return [...remote, ...local].sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return local;
  }
}
