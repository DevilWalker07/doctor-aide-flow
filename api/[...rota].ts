import { createServerlessApp } from "../server/serverless.js";

/**
 * Ponto de entrada de toda a API na Vercel. Uma função só para `/api/**` — a
 * aplicação Express resolve o roteamento interno, como já fazia no contêiner.
 */
export default createServerlessApp();
