"""
Microservice OCR basé sur PaddleOCR
Déployable sur Railway, Render, Fly.io, etc.
"""
import os
import io
import base64
import logging
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes

# Configuration du logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialisation de FastAPI
app = FastAPI(
    title="OCR Service (PaddleOCR)",
    description="Service d'OCR pour PDFs et images avec PaddleOCR",
    version="1.0.0"
)

# CORS pour permettre les appels depuis Supabase Edge Functions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, restreindre aux domaines Supabase
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialisation de PaddleOCR (au démarrage pour éviter de le refaire à chaque requête)
logger.info("Initialisation de PaddleOCR...")
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr', show_log=False)
logger.info("PaddleOCR initialisé avec succès")


# === MODELS ===

class OCRRequest(BaseModel):
    """Requête OCR"""
    content: str  # Base64 encoded file content
    mime_type: str  # application/pdf, image/png, image/jpeg, etc.
    max_pages: Optional[int] = 50  # Limite de pages pour les PDFs


class OCRResponse(BaseModel):
    """Réponse OCR"""
    text: str
    pages_processed: int
    warnings: List[str] = []
    processing_time_seconds: float


# === HELPERS ===

def ocr_image(image: Image.Image) -> str:
    """
    Applique PaddleOCR sur une image PIL
    
    Args:
        image: Image PIL à traiter
        
    Returns:
        Texte extrait
    """
    # Convertir PIL Image en bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    # Appliquer OCR
    result = ocr_engine.ocr(img_byte_arr, cls=True)
    
    if not result or not result[0]:
        return ""
    
    # Extraire le texte de chaque ligne détectée
    lines = [line[1][0] for line in result[0]]
    
    return '\n'.join(lines)


def process_image(image_bytes: bytes) -> tuple[str, List[str]]:
    """
    Traite une image : OCR direct
    
    Args:
        image_bytes: Bytes de l'image
        
    Returns:
        (texte extrait, liste des warnings)
    """
    warnings = []
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convertir en RGB si nécessaire
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')
        
        text = ocr_image(image)
        
        if len(text) < 10:
            warnings.append("Très peu de texte détecté dans l'image")
        
        return text, warnings
        
    except Exception as e:
        logger.error(f"Erreur traitement image: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur traitement image: {str(e)}")


def process_pdf(pdf_bytes: bytes, max_pages: int = 50) -> tuple[str, int, List[str]]:
    """
    Traite un PDF : conversion en images + OCR
    
    Args:
        pdf_bytes: Bytes du PDF
        max_pages: Nombre maximum de pages à traiter
        
    Returns:
        (texte extrait, nombre de pages traitées, liste des warnings)
    """
    warnings = []
    
    try:
        # Conversion PDF → Images (300 DPI pour bonne qualité)
        logger.info(f"Conversion du PDF en images (max {max_pages} pages)...")
        images = convert_from_bytes(pdf_bytes, dpi=300, fmt='png')
        
        total_pages = len(images)
        pages_to_process = min(total_pages, max_pages)
        
        if total_pages > max_pages:
            warnings.append(f"PDF contient {total_pages} pages, seules les {max_pages} premières seront traitées")
        
        logger.info(f"PDF converti : {pages_to_process} pages à traiter")
        
        # OCR sur chaque page
        page_texts = []
        for i, image in enumerate(images[:pages_to_process], 1):
            logger.info(f"OCR page {i}/{pages_to_process}...")
            text = ocr_image(image)
            
            if text:
                page_texts.append(f"## Page {i}\n\n{text}")
            else:
                warnings.append(f"Page {i}: Aucun texte détecté")
        
        full_text = '\n\n'.join(page_texts)
        
        if len(full_text) < 50:
            warnings.append("Très peu de texte extrait du PDF (possible PDF vide ou illisible)")
        
        return full_text, pages_to_process, warnings
        
    except Exception as e:
        logger.error(f"Erreur traitement PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur traitement PDF: {str(e)}")


# === ENDPOINTS ===

@app.get("/")
async def root():
    """Endpoint racine"""
    return {
        "service": "OCR Service (PaddleOCR)",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ocr": "/ocr (POST)"
        }
    }


@app.get("/health")
async def health():
    """Health check pour Railway/Render"""
    return {
        "status": "healthy",
        "service": "OCR Service (PaddleOCR)",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(request: OCRRequest):
    """
    Endpoint principal pour OCR
    
    Accepte un fichier encodé en base64 (PDF ou image) et retourne le texte extrait
    """
    start_time = datetime.utcnow()
    
    try:
        # Décoder le contenu base64
        file_bytes = base64.b64decode(request.content)
        file_size_mb = len(file_bytes) / (1024 * 1024)
        
        logger.info(f"Traitement fichier: {request.mime_type}, {file_size_mb:.2f} MB")
        
        # Vérifier la taille
        if file_size_mb > 50:
            raise HTTPException(
                status_code=413,
                detail=f"Fichier trop volumineux: {file_size_mb:.2f} MB (max 50 MB)"
            )
        
        # Traiter selon le type
        if request.mime_type == 'application/pdf':
            text, pages_processed, warnings = process_pdf(file_bytes, request.max_pages)
            
        elif request.mime_type.startswith('image/'):
            text, warnings = process_image(file_bytes)
            pages_processed = 1
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Type de fichier non supporté: {request.mime_type}"
            )
        
        # Calculer le temps de traitement
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        logger.info(
            f"OCR terminé: {len(text)} caractères extraits, "
            f"{pages_processed} pages, {processing_time:.2f}s"
        )
        
        return OCRResponse(
            text=text,
            pages_processed=pages_processed,
            warnings=warnings,
            processing_time_seconds=processing_time
        )
        
    except base64.binascii.Error:
        raise HTTPException(status_code=400, detail="Contenu base64 invalide")
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Erreur inattendue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
