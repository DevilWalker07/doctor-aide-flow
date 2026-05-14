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
        image_base64 = None

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
            image_base64 = base64.b64encode(output.getvalue()).decode("utf-8")

        elif ext in [".txt", ".md"]:
            update_job(job_id, "processing", "Lendo texto do arquivo...")
            extracted_text = file_bytes.decode("utf-8", errors="replace")

        elif ext == ".docx":
            update_job(job_id, "processing", "Extraindo texto do DOCX...")
            result = mammoth.extract_text(io.BytesIO(file_bytes))
            extracted_text = result.value

        elif ext == ".pdf":
            update_job(job_id, "processing", "Extraindo texto do PDF...")
            # Use PyPDFium2 for quick text extraction
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_bytes)
            text_pages = []
            for i in range(len(pdf)):
                page = pdf[i]
                textpage = page.get_textpage()
                text_pages.append(textpage.get_text_bounded())
            
            extracted_text = "\n".join(text_pages).strip()
            
            if len(extracted_text) < 100 and len(pdf) > 0:
                update_job(job_id, "processing", "PDF parece ser imagem. Lendo com IA...")
                # Convert first page to image
                page = pdf[0]
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
                image_base64 = base64.b64encode(output.getvalue()).decode("utf-8")
                extracted_text = ""
        else:
            raise Exception(f"Formato não suportado: {ext}")

        update_job(job_id, "processing", "Lendo com IA (OpenAI)...")

        prompt = """Extraia os dados clínicos do documento e retorne ESTRITAMENTE um JSON com as seguintes chaves (sem formatação markdown ```json, apenas o JSON puramente):
        {
            "nome": "string ou null",
            "idade": "numero ou null",
            "sexo": "string ou null",
            "leito": "string ou null",
            "setor": "string ou null",
            "data_admissao": "string ou null",
            "hda": "string ou null",
            "lista_de_problemas": ["string"],
            "antibioticos": ["string"],
            "medicacoes": ["string"],
            "laboratorios": ["string"],
            "exame_fisico": "string ou null",
            "condutas": ["string"],
            "pendencias": ["string"],
            "alertas": ["string"]
        }"""

        messages = [
            {"role": "system", "content": "Você é um assistente médico especialista em extração de dados estruturados. Retorne apenas JSON válido."}
        ]

        if image_base64:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            })
        else:
            messages.append({
                "role": "user",
                "content": f"{prompt}\n\nDocumento:\n{extracted_text}"
            })

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0,
            max_tokens=2000,
            response_format={ "type": "json_object" }
        )

        update_job(job_id, "processing", "Organizando dados clínicos...")
        result_content = response.choices[0].message.content
        
        try:
            clinical_json = json.loads(result_content)
        except Exception:
            clinical_json = {"error": "Falha ao parsear JSON", "raw": result_content}

        clinical_json["fileName"] = filename
        clinical_json["engine"] = "openai-vision" if image_base64 else "openai-text"
        
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
        "result": None,
        "error": None
    }
    
    background_tasks.add_task(process_document_background, job_id, file_bytes, file.filename, file.content_type)
    
    return {"job_id": job_id}

@app.get("/job/{job_id}")
@app.get("/api/extract/job/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return jobs_store[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
