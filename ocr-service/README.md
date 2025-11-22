# OCR Microservice (PaddleOCR)

Service d'OCR production-ready basé sur PaddleOCR pour extraction de texte depuis PDFs et images.

## Fonctionnalités

- **OCR haute qualité** avec PaddleOCR (modèle français)
- **Support PDF** : conversion automatique en images 300 DPI
- **Support images** : PNG, JPEG, WEBP, etc.
- **Traitement batch** : jusqu'à 100 pages par PDF
- **API REST** simple avec FastAPI
- **Déployable** sur Railway, Render, Fly.io, Google Cloud Run, etc.

## Architecture

```
Client (Supabase Edge Function)
    ↓ POST /ocr (base64)
OCR Service (FastAPI)
    ↓
PaddleOCR Engine (Python)
    ↓
Text extraction
```

## Déploiement

### Option 1 : Railway.app (Recommandé)

**Prix** : $5/mois

1. Créez un compte sur [railway.app](https://railway.app)
2. Connectez votre repo GitHub
3. Créez un nouveau projet : **Deploy from GitHub**
4. Sélectionnez le repo `quote-insight-tally`
5. Dans **Settings** → **Source** :
   - Root Directory : `ocr-service`
6. Railway détecte le Dockerfile automatiquement
7. Cliquez sur **Deploy**
8. Attendez 5-10 minutes (téléchargement des modèles PaddleOCR)
9. Dans **Settings** → **Networking** :
   - Cliquez sur **Generate Domain**
   - Copiez l'URL générée

### Option 2 : Render.com

**Prix** : GRATUIT (750h/mois)

1. Créez un compte sur [render.com](https://render.com)
2. New → **Web Service**
3. Connectez votre repo GitHub
4. Configuration :
   - Name : `ocr-service`
   - Root Directory : `ocr-service`
   - Environment : **Docker**
   - Plan : **Free**
5. Déployez
6. **Note** : Le service s'endort après 15 min d'inactivité (cold start ~30s)

### Option 3 : Fly.io

**Prix** : GRATUIT (3 VMs incluses)

```bash
# Installation
curl -L https://fly.io/install.sh | sh

# Connexion
fly auth login

# Depuis le dossier ocr-service/
cd ocr-service
fly launch --name ocr-service --region cdg

# Déploiement
fly deploy
```

### Option 4 : Google Cloud Run

**Prix** : Pay-as-you-go (très économique)

```bash
# Build l'image
gcloud builds submit --tag gcr.io/VOTRE_PROJECT/ocr-service

# Déploiement
gcloud run deploy ocr-service \
  --image gcr.io/VOTRE_PROJECT/ocr-service \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300
```

## Configuration Supabase

Une fois déployé, configurez l'URL dans Supabase :

1. Supabase Dashboard → **Settings** → **Edge Functions**
2. Ajoutez un secret :
   - **Nom** : `OCR_SERVICE_URL`
   - **Valeur** : `https://votre-service.railway.app` (sans slash final)
3. Redéployez vos Edge Functions

## Test local

```bash
# Installation des dépendances
pip install -r requirements.txt

# Lancement
python main.py

# Ou avec Docker
docker-compose up --build
```

Le service sera disponible sur `http://localhost:8080`

## API

### Health Check

```bash
curl https://votre-service.railway.app/health
```

**Réponse** :
```json
{
  "status": "healthy",
  "service": "OCR Service (PaddleOCR)",
  "version": "1.0.0"
}
```

### OCR Endpoint

```bash
curl -X POST https://votre-service.railway.app/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "content": "BASE64_ENCODED_FILE",
    "mime_type": "application/pdf",
    "max_pages": 50
  }'
```

**Paramètres** :
- `content` : Fichier encodé en base64
- `mime_type` : `application/pdf`, `image/png`, `image/jpeg`, etc.
- `max_pages` : Limite de pages pour PDFs (défaut: 50)

**Réponse** :
```json
{
  "text": "Texte extrait...",
  "pages_processed": 5,
  "warnings": [],
  "processing_time_seconds": 12.5
}
```

## Performance

- **Images** : ~1-2 secondes par image
- **PDFs** : ~2-3 secondes par page (300 DPI)
- **Mémoire** : ~1.5 GB (modèles PaddleOCR en RAM)
- **Premier déploiement** : ~5-10 minutes (téléchargement modèles)

## Limites

- Taille maximale : **50 MB** par fichier
- Pages par PDF : **100 pages max** (configurable)
- Langues supportées : Français (modifiable dans `main.py`)

## Monitoring

Les logs incluent :
- Taille des fichiers reçus
- Temps de traitement
- Nombre de pages traitées
- Warnings (peu de texte détecté, etc.)

## Support

Pour des questions ou problèmes :
1. Vérifiez les logs du service
2. Testez le `/health` endpoint
3. Vérifiez que `OCR_SERVICE_URL` est bien configuré dans Supabase
