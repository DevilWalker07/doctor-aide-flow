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
MAX_PDF_PAGES = int(os.environ.get("MAX_PDF_PAGES", "8"))

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
            max_size = 1500
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                image = image.resize((int(image.size[0] * ratio), int(image.size[1] * ratio)), Image.LANCZOS)
            
            output = io.BytesIO()
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            image.save(output, format="JPEG", quality=85)
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
                update_job(job_id, "processing", "Processando páginas...")
                pdf = pdfium.PdfDocument(file_bytes)
                total_pages = len(pdf)
                pages_to_render = min(total_pages, MAX_PDF_PAGES)
                for i in range(pages_to_render):
                    page = pdf[i]
                    bitmap = page.render(scale=2)
                    pil_image = bitmap.to_pil()
                    if pil_image.mode in ("RGBA", "P"):
                        pil_image = pil_image.convert("RGB")
                    max_size = 1500
                    if max(pil_image.size) > max_size:
                        ratio = max_size / max(pil_image.size)
                        pil_image = pil_image.resize((int(pil_image.size[0] * ratio), int(pil_image.size[1] * ratio)), Image.LANCZOS)

                    output = io.BytesIO()
                    pil_image.save(output, format="JPEG", quality=85)
                    image_base64_list.append(base64.b64encode(output.getvalue()).decode("utf-8"))
                extracted_text = ""
                if total_pages > pages_to_render:
                    print(f"PDF truncado: enviando {pages_to_render} de {total_pages} páginas para a IA.")

        else:
            raise Exception(f"Formato não suportado: {ext}")

        update_job(job_id, "processing", "Organizando dados clínicos...")

        prompt = """Extraia os dados clínicos do documento e retorne ESTRITAMENTE um JSON com as seguintes chaves (sem formatação markdown ```json, apenas o JSON puramente):
{
  "nome": null ou string,
  "idade": null ou string,
  "sexo": null ou "M" / "F",
  "leito": null ou string,
  "setor": null ou string,
  "data_admissao": null ou "DD/MM/YYYY",
  "hda": null ou string,
  "lista_de_problemas": ["string"],
  "antibioticos": [
    {
      "nome": "string",
      "dose": "string",
      "via": "string",
      "frequencia": "string",
      "data_inicio": "DD/MM/YYYY"
    }
  ],
  "medicacoes": ["string"],
  "laboratorios": [
    {
      "data": "DD/MM/YYYY",
      "texto_compacto": "string",
      "valores": {}
    }
  ],
  "exame_fisico": {
    "geral": "string ou null",
    "acv": "string ou null",
    "ar": "string ou null",
    "abdome": "string ou null",
    "neuro": "string ou null",
    "extremidades": "string ou null",
    "pele": "string ou null"
  },
  "condutas": ["string"],
  "pendencias": ["string"],
  "alertas": ["string"]
}"""

        messages = [
            {"role": "system", "content": "Você é um assistente médico especialista em extração de dados estruturados. Retorne apenas JSON válido."}
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

        response = None
        for tentativa in range(3):
            try:
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    temperature=0,
                    max_tokens=8000,
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
        "version": "async-extract-v2"
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
