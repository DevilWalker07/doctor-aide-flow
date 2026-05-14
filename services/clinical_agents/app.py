import os
import uuid
import json
import asyncio
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

app = FastAPI(title="Doutor Ajuda - Async Clinical Agents")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage
# In production with multiple workers, use Redis.
jobs_store: Dict[str, Dict[str, Any]] = {}

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Add heif/heic support
pillow_heif.register_heif_opener()

def update_job(job_id: str, status: str, stage: str, result: dict = None, error: str = None):
    jobs_store[job_id]["status"] = status
    jobs_store[job_id]["stage"] = stage
    if result is not None:
        jobs_store[job_id]["result"] = result
    if error is not None:
        jobs_store[job_id]["error"] = error

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

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0,
            max_tokens=2500,
            response_format={ "type": "json_object" }
        )

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
    
    jobs_store[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "stage": "Arquivo recebido",
        "file_name": file.filename,
        "result": None,
        "error": None
    }
    
    background_tasks.add_task(process_document_background, job_id, file_bytes, file.filename, file.content_type)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "stage": "Arquivo recebido"
    }

@app.get("/job/{job_id}")
@app.get("/api/extract/job/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return jobs_store[job_id]

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
