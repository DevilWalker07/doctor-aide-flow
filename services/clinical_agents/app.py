from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Doutor Ajuda Clinical Agents")


class AgentRequest(BaseModel):
    task: str
    text: str | None = None
    payload: dict | None = None


@app.get("/health")
def health():
    return {"ok": True, "service": "clinical-agents"}


@app.post("/agents/run")
def run_agent(request: AgentRequest):
    return {
        "task": request.task,
        "status": "configured",
        "message": "Base pronta para orquestrar agentes Agno e conversao Docling.",
        "payload": request.payload,
    }
