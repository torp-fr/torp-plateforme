"""
Microservice OCR avec PaddleOCR
Supporte PDFs et images avec OCR haute qualité pour documents français
"""

import base64
import io
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes
from PIL import Image
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="OCR Service", version="1.0.0")

# CORS pour permettre les appels depuis Supabase Edge Functions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialiser PaddleOCR (cache le modèle)
# use_angle_cls=True pour détecter l'orientation
# lang='fr' pour optimiser pour le français
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr', show_log=False)

logger.info("PaddleOCR initialized with French language model")


class OCRRequest(BaseModel):
    """Request model pour OCR avec base64"""
    content: str  # Base64 encoded file
    mime_type: str
    max_pages: Optional[int] = 50  # Limite de pages pour PDFs


class OCRResponse(BaseModel):
    """Response model"""
    text: str
    pages_processed: int
    method: str
    warnings: List[str] = []


def ocr_image(image: Image.Image) -> str:
    """
    Applique PaddleOCR sur une image PIL

    Args:
        image: Image PIL

    Returns:
        Texte extrait
    """
    # Convertir PIL Image en bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()

    # Appliquer OCR
    result = ocr_engine.ocr(img_byte_arr, cls=True)

    # Extraire le texte (PaddleOCR retourne [[[bbox], (text, confidence)], ...])
    if not result or not result[0]:
        return ""

    lines = []
    for line in result[0]:
        if len(line) >= 2:
            text = line[1][0]  # (text, confidence)[0]
            lines.append(text)

    return '\n'.join(lines)


def process_pdf(pdf_bytes: bytes, max_pages: int = 50) -> tuple[str, int, List[str]]:
    """
    Traite un PDF : conversion en images + OCR

    Args:
        pdf_bytes: Contenu du PDF
        max_pages: Nombre max de pages à traiter

    Returns:
        (texte_extrait, nombre_pages, warnings)
    """
    warnings = []

    try:
        # Convertir PDF en images (300 DPI pour bonne qualité)
        logger.info("Converting PDF to images...")
        images = convert_from_bytes(pdf_bytes, dpi=300, fmt='png')

        total_pages = len(images)
        pages_to_process = min(total_pages, max_pages)

        if total_pages > max_pages:
            warnings.append(f"PDF contient {total_pages} pages, seules {max_pages} premières pages traitées")

        logger.info(f"Processing {pages_to_process} pages...")

        # OCR sur chaque page
        page_texts = []
        for i, image in enumerate(images[:pages_to_process]):
            logger.info(f"OCR page {i+1}/{pages_to_process}")
            try:
                text = ocr_image(image)
                if text.strip():
                    page_texts.append(f"## Page {i+1}\n\n{text}")
                else:
                    warnings.append(f"Page {i+1} : aucun texte détecté")
            except Exception as e:
                logger.error(f"Error OCR page {i+1}: {e}")
                warnings.append(f"Page {i+1} : erreur OCR - {str(e)}")

        full_text = '\n\n---\n\n'.join(page_texts)
        return full_text, pages_to_process, warnings

    except Exception as e:
        logger.error(f"PDF processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur traitement PDF: {str(e)}")


def process_image(image_bytes: bytes) -> tuple[str, List[str]]:
    """
    Traite une image : OCR direct

    Args:
        image_bytes: Contenu de l'image

    Returns:
        (texte_extrait, warnings)
    """
    warnings = []

    try:
        image = Image.open(io.BytesIO(image_bytes))
        logger.info(f"Processing image: {image.size} pixels")

        text = ocr_image(image)

        if not text.strip():
            warnings.append("Aucun texte détecté dans l'image")

        return text, warnings

    except Exception as e:
        logger.error(f"Image processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur traitement image: {str(e)}")


@app.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(request: OCRRequest):
    """
    Endpoint principal pour OCR

    Accepte base64 encodé (PDF ou image)
    Retourne le texte extrait
    """
    try:
        # Décoder base64
        file_bytes = base64.b64decode(request.content)
        logger.info(f"Received file: {len(file_bytes)} bytes, type: {request.mime_type}")

        # Traiter selon le type
        if request.mime_type == 'application/pdf':
            text, pages, warnings = process_pdf(file_bytes, request.max_pages)
            return OCRResponse(
                text=text,
                pages_processed=pages,
                method="PaddleOCR (PDF)",
                warnings=warnings
            )

        elif request.mime_type.startswith('image/'):
            text, warnings = process_image(file_bytes)
            return OCRResponse(
                text=text,
                pages_processed=1,
                method="PaddleOCR (Image)",
                warnings=warnings
            )

        else:
            raise HTTPException(status_code=400, detail=f"Type MIME non supporté: {request.mime_type}")

    except base64.binascii.Error:
        raise HTTPException(status_code=400, detail="Contenu base64 invalide")
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr/upload", response_model=OCRResponse)
async def ocr_upload(file: UploadFile):
    """
    Endpoint alternatif : upload direct de fichier
    """
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or 'application/octet-stream'

        logger.info(f"Upload: {file.filename}, {len(file_bytes)} bytes, type: {mime_type}")

        if mime_type == 'application/pdf':
            text, pages, warnings = process_pdf(file_bytes, max_pages=50)
            return OCRResponse(
                text=text,
                pages_processed=pages,
                method="PaddleOCR (PDF)",
                warnings=warnings
            )

        elif mime_type.startswith('image/'):
            text, warnings = process_image(file_bytes)
            return OCRResponse(
                text=text,
                pages_processed=1,
                method="PaddleOCR (Image)",
                warnings=warnings
            )

        else:
            raise HTTPException(status_code=400, detail=f"Type non supporté: {mime_type}")

    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ocr-service",
        "version": "1.0.0",
        "ocr_engine": "PaddleOCR",
        "language": "fr"
    }


@app.get("/")
async def root():
    """Root endpoint avec documentation"""
    return {
        "service": "OCR Microservice",
        "version": "1.0.0",
        "endpoints": {
            "/ocr": "POST - OCR avec base64 JSON",
            "/ocr/upload": "POST - OCR avec multipart/form-data",
            "/health": "GET - Health check",
            "/docs": "GET - Documentation Swagger"
        },
        "features": [
            "PaddleOCR (meilleure qualité open-source)",
            "Support PDF multi-pages",
            "Support images (PNG, JPG, etc.)",
            "Optimisé pour documents français",
            "Détection automatique d'orientation"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
