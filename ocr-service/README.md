# OCR Microservice

Microservice OCR autonome avec **PaddleOCR** pour extraction de texte haute qualité des documents français (DTU, normes, etc.).

## 🎯 Features

- ✅ **PaddleOCR** - Meilleure qualité OCR open-source
- ✅ **Support PDF multi-pages** - Conversion automatique en images
- ✅ **Support images** - PNG, JPG, WEBP, etc.
- ✅ **Optimisé français** - Modèle FR pré-chargé
- ✅ **Détection orientation** - Rotation automatique
- ✅ **API REST** - FastAPI avec documentation Swagger
- ✅ **Docker ready** - Déploiement facile

## 🚀 Déploiement local (test)

### Option 1 : Docker (recommandé)

```bash
# Build l'image
docker build -t ocr-service .

# Run le container
docker run -p 8080:8080 ocr-service

# Test
curl http://localhost:8080/health
```

### Option 2 : Python direct

```bash
# Installer poppler (pour pdf2image)
# Ubuntu/Debian:
sudo apt-get install poppler-utils

# macOS:
brew install poppler

# Installer dépendances Python
pip install -r requirements.txt

# Run
python main.py
```

## 📡 API Endpoints

### POST /ocr

OCR avec base64 JSON

```bash
curl -X POST http://localhost:8080/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "content": "base64_encoded_pdf_here",
    "mime_type": "application/pdf",
    "max_pages": 50
  }'
```

**Response:**
```json
{
  "text": "Texte extrait du document...",
  "pages_processed": 15,
  "method": "PaddleOCR (PDF)",
  "warnings": []
}
```

### POST /ocr/upload

OCR avec upload de fichier

```bash
curl -X POST http://localhost:8080/ocr/upload \
  -F "file=@document.pdf"
```

### GET /health

Health check

```bash
curl http://localhost:8080/health
```

### GET /docs

Documentation interactive Swagger UI

→ http://localhost:8080/docs

## ☁️ Déploiement production

### Option A : Railway.app (simple, $5/mois)

1. Connectez votre repo GitHub
2. Sélectionnez le dossier `ocr-service`
3. Railway détecte automatiquement le Dockerfile
4. Déployez ! URL fournie automatiquement

### Option B : Google Cloud Run (pay-as-you-go)

```bash
# Build et push
gcloud builds submit --tag gcr.io/YOUR_PROJECT/ocr-service

# Deploy
gcloud run deploy ocr-service \
  --image gcr.io/YOUR_PROJECT/ocr-service \
  --platform managed \
  --region europe-west1 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --allow-unauthenticated
```

### Option C : VPS (OVH, Scaleway, etc.)

```bash
# SSH sur votre VPS
ssh user@your-vps-ip

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone repo
git clone https://github.com/your-repo/quote-insight-tally.git
cd quote-insight-tally/ocr-service

# Build et run
docker build -t ocr-service .
docker run -d -p 8080:8080 --restart unless-stopped ocr-service

# Configurer reverse proxy (nginx) pour HTTPS
```

## 🔗 Intégration avec Supabase Edge Functions

Une fois déployé, configurez l'URL dans Supabase secrets :

```bash
# Supabase Dashboard > Edge Functions > Secrets
OCR_SERVICE_URL=https://your-ocr-service.railway.app
```

Les Edge Functions appelleront automatiquement ce service pour les PDFs.

## 📊 Performance

- **Latence** : ~2-5s par page PDF (300 DPI)
- **Mémoire** : ~1-2 GB RAM
- **CPU** : Supporte multi-threading
- **GPU** : Optionnel (peut accélérer 3-5x)

## 🐛 Debugging

Logs en temps réel :

```bash
# Docker
docker logs -f <container_id>

# Python direct
# Les logs s'affichent dans le terminal
```

## 💰 Coûts estimés

- **Railway.app** : $5-10/mois (toujours actif)
- **Google Cloud Run** : ~$0.05 par 1000 requêtes (pay-as-you-go)
- **VPS OVH** : €3-7/mois (VPS Starter)

## 🔒 Sécurité

Pour production, ajoutez :

1. **API Key** authentication
2. **Rate limiting**
3. **HTTPS** obligatoire
4. **CORS** restreint à votre domaine

Exemple avec API key :

```python
# main.py
from fastapi import Header, HTTPException

API_KEY = os.getenv("OCR_API_KEY", "your-secret-key")

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")

@app.post("/ocr", dependencies=[Depends(verify_api_key)])
async def ocr_endpoint(request: OCRRequest):
    # ...
```
