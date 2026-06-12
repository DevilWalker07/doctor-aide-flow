/**
 * Feature flags lidas das env vars no boot do app.
 *
 * Pra ativar uma flag em produção: ir no painel da Vercel,
 * Environment Variables, adicionar VITE_<NOME>=true e redeployar.
 */

// Google OAuth: depende de configuração no Supabase Dashboard + Google
// Cloud Console. Enquanto não configurado, o botão "Continuar com Google"
// dá erro "Unsupported provider: provider is not enabled". Por isso fica
// escondido por padrão. Setar VITE_GOOGLE_OAUTH=true pra mostrar.
export const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH === "true";
