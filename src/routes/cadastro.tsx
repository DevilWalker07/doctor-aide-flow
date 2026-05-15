import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({ meta: [{ title: "Criar Conta - DOUTOR AJUDA" }] }),
});

function CadastroPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "#1e293b",
            marginBottom: "8px",
          }}
        >
          DOUTOR AJUDA
        </h1>
        <p style={{ color: "#64748b", fontSize: "14px" }}>
          Crie sua conta para comecar
        </p>
      </div>

      <SignUp
        routing="path"
        path="/cadastro"
        signInUrl="/login"
        afterSignUpUrl="/"
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: "400px" },
            card: {
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            },
            headerTitle: { display: "none" },
            headerSubtitle: { display: "none" },
            socialButtonsBlockButton: { display: "none" },
            dividerRow: { display: "none" },
            formFieldInput: {
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "16px",
              padding: "12px",
            },
            formButtonPrimary: {
              backgroundColor: "#2563eb",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              padding: "12px",
              width: "100%",
            },
            footerActionLink: { color: "#2563eb" },
          },
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "8px",
            fontFamily: "inherit",
          },
        }}
      />
    </div>
  );
}
