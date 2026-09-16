export const API_BASE = (import.meta.env.VITE_CLINICAL_AGENTS_URL || "").replace(/\/$/, "");

/** @deprecated use API_BASE / apiFetch */
export const VITE_CLINICAL_AGENTS_URL = API_BASE;
export const DEFAULT_CLINICAL_AGENTS_URL = "";
