import os
import uuid
import json
import asyncio
import tempfile
import io
import traceback
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

import uvicorn
from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageOps
import pillow_heif
import mammoth
import pypdfium2 as pdfium
from openai import AsyncOpenAI
from supabase import create_client
try:
    from supabase import Client
except ImportError:
    from supabase.client import Client

# Conditional import for docling as it's a heavy dependency
try:
    from docling.document_converter import DocumentConverter
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False
    print("Warning: docling not installed. Falling back to other extraction methods.")

app = FastAPI(title="Doutor Ajuda - Async Clinical Agents")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Job Storage
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase: {e}")

jobs_memory = {}  # fallback se Supabase não estiver configurado

# Use OPENAI_API_KEY or VITE_OPENAI_API_KEY
openai_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("VITE_OPENAI_API_KEY")
client = AsyncOpenAI(api_key=openai_key)

# Add heif/heic support
pillow_heif.register_heif_opener()

# PDF page cap for image fallback — protects context window and timeout
MAX_PDF_PAGES = int(os.environ.get("MAX_PDF_PAGES", "15"))

def save_job(job_id: str, data: dict):
    if supabase_client:
        try:
            # Check if exists
            existing = supabase_client.table("extraction_jobs") \
                .select("id").eq("job_id", job_id).execute()
            if existing.data:
                supabase_client.table("extraction_jobs") \
                    .update(data).eq("job_id", job_id).execute()
            else:
                supabase_client.table("extraction_jobs") \
                    .insert({"job_id": job_id, **data}).execute()
            return
        except Exception as e:
            print(f"Supabase save_job error: {e}")
    jobs_memory[job_id] = data

def get_job(job_id: str) -> Optional[dict]:
    if supabase_client:
        try:
            result = supabase_client.table("extraction_jobs") \
                .select("*").eq("job_id", job_id).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            print(f"Supabase get_job error: {e}")
    return jobs_memory.get(job_id)

def update_job(job_id: str, status: str, stage: str,
               result: dict = None, error: str = None):
    data = {"status": status, "stage": stage}
    if result is not None:
        data["result"] = result
    if error is not None:
        data["error"] = error
    save_job(job_id, data)

async def process_document_background(job_id: str, file_bytes: bytes, filename: str, content_type: str):
    ext = os.path.splitext(filename)[1].lower()
    try:
        update_job(job_id, "processing", "Identificando tipo de arquivo...")
        
        extracted_text = ""
        image_base64_list = []

        if ext in [".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"]:
            update_job(job_id, "processing", "Preparando imagem...")
            image = Image.open(io.BytesIO(file_bytes))
            # Rotate per EXIF so phone photos arrive upright at the OpenAI Vision call.
            image = ImageOps.exif_transpose(image)
            # Resize if too large
            max_size = 1800
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                image = image.resize((int(image.size[0] * ratio), int(image.size[1] * ratio)), Image.LANCZOS)
            
            output = io.BytesIO()
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            image.save(output, format="JPEG", quality=88)
            image_base64_list.append(base64.b64encode(output.getvalue()).decode("utf-8"))

        elif ext in [".txt", ".md"]:
            update_job(job_id, "processing", "Lendo texto...")
            extracted_text = file_bytes.decode("utf-8", errors="replace")

        elif ext == ".docx":
            update_job(job_id, "processing", "Lendo documento...")
            # Tentar docling primeiro
            try:
                if HAS_DOCLING:
                    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
                        tmp.write(file_bytes)
                        tmp_path = tmp.name
                    
                    converter = DocumentConverter()
                    doc = converter.convert(tmp_path)
                    extracted_text = doc.document.export_to_markdown()
                    os.remove(tmp_path)
                else:
                    raise ImportError("docling not available")
            except Exception as e:
                # Fallback to mammoth se docling falhar
                print("Docling falhou para DOCX, usando mammoth:", e)
                result = mammoth.extract_raw_text(io.BytesIO(file_bytes))
                extracted_text = result.value
                
            if not extracted_text.strip():
                raise ValueError("Não foi possível extrair texto do DOCX.")

        elif ext == ".pdf":
            update_job(job_id, "processing", "Lendo PDF...")
            try:
                if HAS_DOCLING:
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        tmp.write(file_bytes)
                        tmp_path = tmp.name

                    converter = DocumentConverter()
                    doc = converter.convert(tmp_path)
                    extracted_text = doc.document.export_to_markdown()
                    os.remove(tmp_path)
                else:
                    extracted_text = ""
            except Exception as e:
                print("Docling falhou para PDF:", e)
                extracted_text = ""

            # If docling produced no usable text, try pypdfium2 text extraction
            # before falling back to vision (which is slow + token-heavy).
            if len(extracted_text.strip()) < 100:
                update_job(job_id, "processing", "Extraindo texto do PDF...")
                try:
                    pdf = pdfium.PdfDocument(file_bytes)
                    text_parts = []
                    for i in range(len(pdf)):
                        textpage = pdf[i].get_textpage()
                        text_parts.append(textpage.get_text_range())
                    extracted_text = "\n\n".join(t for t in text_parts if t).strip()
                except Exception as e:
                    print("pypdfium2 text extraction falhou:", e)
                    extracted_text = ""

            # Still no text? Render pages to images for OpenAI Vision — but cap
            # at MAX_PDF_PAGES to protect context window and request timeout.
            if len(extracted_text.strip()) < 100:
                update_job(job_id, "processing", "Processando páginas (OCR)...")
                pdf = pdfium.PdfDocument(file_bytes)
                total_pages = len(pdf)
                pages_to_render = min(total_pages, MAX_PDF_PAGES)
                for i in range(pages_to_render):
                    page = pdf[i]
                    bitmap = page.render(scale=2.5) # Aumentando escala para melhor leitura
                    pil_image = bitmap.to_pil()
                    if pil_image.mode in ("RGBA", "P"):
                        pil_image = pil_image.convert("RGB")
                    
                    max_size = 1800
                    if max(pil_image.size) > max_size:
                        ratio = max_size / max(pil_image.size)
                        pil_image = pil_image.resize((int(pil_image.size[0] * ratio), int(pil_image.size[1] * ratio)), Image.LANCZOS)

                    output = io.BytesIO()
                    pil_image.save(output, format="JPEG", quality=88)
                    image_base64_list.append(base64.b64encode(output.getvalue()).decode("utf-8"))
                
                extracted_text = ""
                if total_pages > pages_to_render:
                    print(f"PDF truncado: enviando {pages_to_render} de {total_pages} páginas para a IA.")

        else:
            raise Exception(f"Formato não suportado: {ext}")

        update_job(job_id, "processing", "Organizando dados clínicos com IA...")

        # ETAPA 3 — JSON CLÍNICO PADRONIZADO alignment
        prompt = f"""
Você é um assistente médico sênior especialista em extração de dados clínicos.
Seu objetivo é extrair o máximo de informações estruturadas do documento médico abaixo.

CONTEXTO ADICIONAL:
- Nome do arquivo: {filename}
- Data atual: {datetime.now().strftime("%Y-%m-%d")}

CONTEÚDO DO DOCUMENTO:
{extracted_text}

INSTRUÇÕES DE SAÍDA:
Retorne ESTRITAMENTE um objeto JSON puro com as seguintes chaves:
- nome, idade, sexo (M/F/NI), leito, setor
- data_admissao (YYYY-MM-DD), data_documento (YYYY-MM-DD), motivo_admissao, hda
- lista_de_problemas (array de strings)
- antibioticos (array de objetos com: nome, dose, via, frequencia, data_inicio)
- medicacoes (array de strings)
- laboratorios (array de objetos com: data, texto_compacto, valores)
- exame_fisico (objeto detalhado com: geral, acv, ar, abdome, neuro, extremidades, pele)
- condutas (array de strings)
- pendencias (array de strings)
- alertas (array de strings: riscos, alergias, dados críticos)
- campos_incertos (array de strings com campos que você não localizou com clareza)

REGRAS CLÍNICAS:
1. Se o nome não estiver no texto, tente inferir do nome do arquivo (ex: "L01-JOAO-SILVA.pdf" -> JOAO SILVA).
2. Não invente dados. Use null se não encontrar.
3. Priorize clareza e precisão médica.
"""

        messages = [
            {"role": "system", "content": "Você é um médico especialista em transcrição de dados estruturados. Retorne apenas JSON válido e preciso."}
        ]

        if image_base64_list:
            content = [{"type": "text", "text": prompt}]
            for b64 in image_base64_list:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
            messages.append({"role": "user", "content": content})
        else:
            messages.append({
                "role": "user",
                "content": f"{prompt}\n\nDocumento:\n{extracted_text}"
            })

        # ETAPA 2 — PERFORMANCE: Use gpt-4o-mini for speed as requested
        model_name = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        
        response = None
        for tentativa in range(3):
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.1,
                    max_tokens=4000,
                    response_format={ "type": "json_object" }
                )
                break
            except Exception as e:
                if tentativa == 2:
                    raise e
                print(f"Erro na OpenAI (tentativa {tentativa+1}/3): {e}")
                await asyncio.sleep(2)

        result_content = response.choices[0].message.content
        
        try:
            clinical_json = json.loads(result_content)
        except Exception:
            clinical_json = {"error": "Falha ao parsear JSON", "raw": result_content}

        clinical_json["fileName"] = filename
        clinical_json["engine"] = "openai-vision" if image_base64_list else "openai-text"
        
        update_job(job_id, "done", "Pronto para revisão", result=clinical_json)

    except Exception as e:
        print(traceback.format_exc())
        update_job(job_id, "error", "Erro na extração", error=str(e))

# --- AI ENDPOINTS FOR EVOLUTION / PRESCRIPTION ---

class EvolutionRequest(BaseModel):
    patient: Dict[str, Any]
    tipo_unidade: str
    template: str
    data_plantao: str
    preferences: Optional[Dict[str, Any]] = None

@app.post("/api/ai/gerar-evolucao")
async def gerar_evolucao(req: EvolutionRequest):
    if not openai_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key não configurada.")
    
    try:
        # Prompt build
        prompt = f"""
Você é um médico assistente sênior. Sua tarefa é gerar uma EVOLUÇÃO MÉDICA impecável baseada nos dados do paciente e no template fornecido.

DADOS DO PACIENTE:
{json.dumps(req.patient, indent=2, ensure_ascii=False)}

DATA DO PLANTÃO: {req.data_plantao}
TIPO DE UNIDADE: {req.tipo_unidade}

TEMPLATE OBRIGATÓRIO:
{req.template}

REGRAS:
1. Siga EXATAMENTE o template. Substitua os campos entre [colchetes] pelos dados reais.
2. Se não houver dado para um campo, use "SEM ALTERAÇÕES", "NADA A DECLARAR" ou remova o campo conforme o bom senso médico.
3. Use terminologia médica técnica e precisa.
4. Mantenha o texto em CAIXA ALTA se solicitado nas preferências.
5. Seja conciso e focado em dados relevantes.
"""
        
        pref = req.preferences or {}
        system_msg = "Você é um gerador de evoluções médicas técnicas. Retorne apenas o texto da evolução."
        if pref.get("uppercase"):
            system_msg += " SEMPRE EM CAIXA ALTA."

        response = await client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        text = response.choices[0].message.content
        return {"evolution_text": text}

    except Exception as e:
        print(f"Erro ao gerar evolução: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract-async")
@app.post("/api/extract/extract-async")
async def extract_async(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    file_bytes = await file.read()
    
    save_job(job_id, {
        "status": "queued",
        "stage": "Arquivo recebido",
        "file_name": file.filename,
        "result": None,
        "error": None
    })
    
    background_tasks.add_task(process_document_background, job_id, file_bytes, file.filename, file.content_type)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "stage": "Arquivo recebido"
    }

@app.get("/job/{job_id}")
@app.get("/api/extract/job/{job_id}")
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return job

@app.delete("/cleanup-jobs")
@app.delete("/api/extract/cleanup-jobs")
async def cleanup_jobs():
    if supabase_client:
        try:
            # Delete jobs older than 24h
            threshold = (datetime.now() - timedelta(hours=24)).isoformat()
            supabase_client.table("extraction_jobs") \
                .delete() \
                .lt("created_at", threshold) \
                .execute()
            return {"message": "Jobs antigos removidos do Supabase"}
        except Exception as e:
            return {"message": f"Erro na limpeza do Supabase: {e}"}
    
    jobs_memory.clear()
    return {"message": "Memória local limpa"}

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok", 
        "service": "clinical-agents",
        "version": "async-extract-v3-e2e",
        "checks": {
            "supabase_service_key": bool(os.environ.get("SUPABASE_SERVICE_KEY")),
            "supabase_key": bool(os.environ.get("SUPABASE_KEY")),
            "supabase_url": bool(os.environ.get("SUPABASE_URL")),
            "openai_key": bool(openai_key),
            "openai_model_env": os.environ.get("OPENAI_MODEL")
        }
    }

if __name__ == "__main__":
    port_str = os.environ.get("PORT", "8000")
    try:
        # Tenta converter para int, removendo possíveis espaços ou caracteres extras
        if port_str.startswith('$'):
            print(f"Warning: Literal variable string detected in PORT: {port_str}")
            port = 8000
        else:
            port = int(port_str)
    except ValueError:
        print(f"Warning: Invalid PORT '{port_str}', defaulting to 8000")
        port = 8000
    
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
