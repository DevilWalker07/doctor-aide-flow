import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, hasSupabase } from "../lib/supabaseAdmin.js";
import type { ClinicalExtractionResult } from "./documentExtractor.service.js";

export type JobStatus = "queued" | "processing" | "done" | "error";

export interface JobRecord {
  job_id: string;
  user_id: string | null;
  status: JobStatus;
  stage: string;
  file_name: string | null;
  result: ClinicalExtractionResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export type JobPatch = Partial<Pick<JobRecord, "status" | "stage" | "result" | "error">>;
export type PublicJob = Pick<JobRecord, "job_id" | "status" | "stage" | "result" | "error">;

export interface JobStore {
  readonly kind: "supabase" | "memory";
  create(input: { job_id: string; user_id: string | null; file_name: string }): Promise<JobRecord>;
  update(jobId: string, patch: JobPatch): Promise<void>;
  get(jobId: string, userId?: string | null): Promise<JobRecord | null>;
}

export const toPublicJob = (j: JobRecord): PublicJob => ({
  job_id: j.job_id,
  status: j.status,
  stage: j.stage,
  result: j.result,
  error: j.error,
});

const TABLE = "extraction_jobs";

export function createSupabaseJobStore(client: SupabaseClient): JobStore {
  return {
    kind: "supabase",
    async create({ job_id, user_id, file_name }) {
      const now = new Date().toISOString();
      const row = {
        job_id,
        user_id,
        status: "queued" as const,
        stage: "Arquivo recebido",
        file_name,
        result: null,
        error: null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await client
        .from(TABLE)
        .upsert(row, { onConflict: "job_id" })
        .select()
        .single();
      if (error) throw new Error(`jobStore.create: ${error.message}`);
      return data as JobRecord;
    },
    async update(jobId, patch) {
      const { error } = await client
        .from(TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("job_id", jobId);
      if (error) console.error(`[jobStore] update ${jobId} falhou:`, error.message);
    },
    async get(jobId, userId) {
      let query = client.from(TABLE).select("*").eq("job_id", jobId);
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error(`[jobStore] get ${jobId} falhou:`, error.message);
        return null;
      }
      return (data as JobRecord | null) ?? null;
    },
  };
}

export function createMemoryJobStore(opts: { ttlMs?: number; sweepMs?: number } = {}): JobStore {
  const { ttlMs = 60 * 60 * 1000, sweepMs = 10 * 60 * 1000 } = opts;
  const jobs = new Map<string, JobRecord>();

  const timer = setInterval(() => {
    const cutoff = Date.now() - ttlMs;
    for (const [id, job] of jobs) {
      if (new Date(job.created_at).getTime() < cutoff) jobs.delete(id);
    }
  }, sweepMs);
  timer.unref();

  return {
    kind: "memory",
    async create({ job_id, user_id, file_name }) {
      const now = new Date().toISOString();
      const rec: JobRecord = {
        job_id,
        user_id,
        status: "queued",
        stage: "Arquivo recebido",
        file_name,
        result: null,
        error: null,
        created_at: now,
        updated_at: now,
      };
      jobs.set(job_id, rec);
      return rec;
    },
    async update(jobId, patch) {
      const job = jobs.get(jobId);
      if (job) jobs.set(jobId, { ...job, ...patch, updated_at: new Date().toISOString() });
    },
    async get(jobId, userId) {
      const job = jobs.get(jobId) ?? null;
      if (job && userId && job.user_id && job.user_id !== userId) return null;
      return job;
    },
  };
}

let singleton: JobStore | null = null;

export function getJobStore(): JobStore {
  if (singleton) return singleton;
  const admin = hasSupabase() ? getSupabaseAdmin() : null;
  if (admin) {
    singleton = createSupabaseJobStore(admin);
  } else {
    console.warn(
      "[jobStore] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — jobs em memória (perdidos no restart).",
    );
    singleton = createMemoryJobStore();
  }
  return singleton;
}
