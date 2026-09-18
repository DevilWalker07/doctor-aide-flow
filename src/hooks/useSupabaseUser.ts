import { useAuth } from "@/lib/auth/AuthContext";

const LOCAL_USER_ID_KEY = "da_local_user_id";

// Sem sessão o app roda em modo local: mantém um id estável por dispositivo.
function getLocalUserId(): string {
  try {
    let id = localStorage.getItem(LOCAL_USER_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      localStorage.setItem(LOCAL_USER_ID_KEY, id);
    }
    return id;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

export function useSupabaseUser() {
  const { user, loading, configured } = useAuth();

  // Sem login, o id é local. Isso vale tanto para "Supabase não configurado"
  // quanto para "configurado, mas ninguém entrou" — e o segundo caso é o que
  // acontece agora que a trava de login saiu.
  //
  // Devolver `null` aqui parecia inofensivo, mas era o que apagava o app: as
  // telas começam com `if (!userId) return;`, e o fallback de localStorage
  // delas mora DENTRO do try/catch que vem depois desse return. Resultado:
  // dashboard, evolução e prescrição abriam em branco, sem erro, sem
  // explicação. Com um id local os guardas passam, a chamada ao Supabase
  // falha no RLS como qualquer chamada anônima, o catch pega, e o plantão
  // roda em cima do localStorage — o mesmo caminho offline que já existia.
  //
  // `loading` é esperado de propósito: entrar em modo local durante a
  // restauração da sessão faria quem TEM login trabalhar no id errado por um
  // instante, e gravar no lugar errado.
  const semSessao = !configured || (!loading && !user);

  if (semSessao) {
    return {
      userId: getLocalUserId(),
      userEmail: null as string | null,
      userName: "Doutor",
      isLoaded: true,
      localMode: true,
    };
  }

  const meta = (user?.user_metadata ?? {}) as { name?: string };
  return {
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    userName: meta.name || user?.email?.split("@")[0] || "Doutor",
    isLoaded: !loading,
    localMode: false,
  };
}
