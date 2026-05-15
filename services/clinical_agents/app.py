import os
import uuid
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import io
import traceback
from PIL import Image
import pillow_heif
from openai import AsyncOpenAI
import mammoth
from supabase import create_client, Client

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

supabase_client: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase: {e}")

jobs_memory = {}  # fallback se Supabase não estiver configurado

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Add heif/heic support
pillow_heif.register_heif_opener()

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

def get_job(job_id: str) -> dict | None:
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
            # Fix EXIF orientation
            image = Image.frombytes(image.mode, image.size, image.tobytes()) # Basic reset or use ExifTags
            # Resize if too large
            max_size = 1500
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                image = image.resize((int(image.size[0] * ratio), int(image.size[1] * ratio)), Image.LANCZOS)
            
            output = io.BytesIO()
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            image.save(output, format="JPEG", quality=85)
            import base64
            image_base64_list.append(base64.b64encode(output.getvalue()).decode("utf-8"))

        elif ext in [".txt", ".md"]:
            update_job(job_id, "processing", "Lendo texto...")
            extracted_text = file_bytes.decode("utf-8", errors="replace")

        elif ext == ".docx":
            update_job(job_id, "processing", "Lendo documento...")
            # Tentar docling primeiro
            try:
                from docling.document_converter import DocumentConverter
                with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                
                converter = DocumentConverter()
                doc = converter.convert(tmp_path)
                extracted_text = doc.document.export_to_markdown()
                os.remove(tmp_path)
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
                from docling.document_converter import DocumentConverter
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                
                converter = DocumentConverter()
                doc = converter.convert(tmp_path)
                extracted_text = doc.document.export_to_markdown()
                os.remove(tmp_path)
            except Exception as e:
                print("Docling falhou para PDF:", e)
                extracted_text = ""

            if len(extracted_text) < 100:
                update_job(job_id, "processing", "Processando páginas...")
                # Fallback to images page by page
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(file_bytes)
                for i in range(len(pdf)):
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
                    import base64
                    image_base64_list.append(base64.b64encode(output.getvalue()).decode("utf-8"))
                extracted_text = ""

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
                    max_tokens=2500,
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
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
