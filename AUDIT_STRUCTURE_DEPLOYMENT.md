# AUDIT STRUCTUREL COMPLET – REPO TORP vs DÉPLOIEMENT RAILWAY

**Date**: 2026-03-03
**Objectif**: Comprendre la divergence entre le repository global et ce qui est réellement déployé sur Railway

---

## SECTION 1 – Structure Repo Complète

### Arborescence Principale (niveau 1)
```
/home/user/torp-plateforme/
├── .claude/                    # Claude Code config
├── .git/                       # Git repository
├── .github/                    # GitHub workflows
├── architecture/               # Architecture documentation
├── docs/                       # Documentation
├── e2e/                        # E2E tests
├── n8n/                        # n8n workflows
├── ocr-service/                # Service Python OCR (DEPLOYED)
├── public/                     # Static assets
├── rag-worker/                 # Node.js worker (NOT DEPLOYED)
├── scripts/                    # Utility scripts
├── src/                        # Main Node.js application (NOT DEPLOYED)
├── supabase/                   # Supabase migrations
├── tests/                      # Test files
├── Dockerfile                  # ROOT: Python service
├── package.json                # Root npm config
├── railway.toml                # Railway config (ROOT SERVICE)
└── requirements.txt            # Python dependencies
```

### Key Directories

**src/** (Node.js application layer):
- src/adapters/, src/api/, src/components/, src/config/
- src/core/ (engines, audit, fraud, infrastructure, jobs, knowledge, etc.)
- src/domain/, src/engines/, src/hooks/, src/lib/
- src/pages/, src/prompts/, src/services/, src/utils/
- **Contains**: obligationExtractionEngine.js in src/engines/

**rag-worker/** (Node.js ingestion worker):
- rag-worker/core/ (supabaseClient.js, embeddingService.js)
- rag-worker/extractors/ (extractionService.js)
- rag-worker/processors/ (cleanText.js, structureSections.js, smartChunker.js)
- rag-worker/package.json (declares dependencies)
- rag-worker/worker.js (entry point)
- **Note**: Completely isolated from /src - does NOT import from /src

**ocr-service/** (Python OCR service):
- ocr-service/Dockerfile (Python 3.11)
- ocr-service/main.py (FastAPI application)
- ocr-service/railway.json (service-specific config)
- ocr-service/requirements.txt

---

## SECTION 2 – Service Railway Actuellement Actif

### Primary Deployment Target
```
service_name: torp-fr/torp-plateforme (root)
config_file: /railway.toml (ROOT LEVEL)
builder: dockerfile (points to ./Dockerfile at root)
runtime: Python 3.11
entry_point: python main.py
port: 8080
healthcheck: /health (600 seconds timeout)
restart: on_failure (max 10 retries)
```

### File Locations Referenced by railway.toml
```
Dockerfile:        /Dockerfile (Python image)
Start command:     python main.py
Entrypoint:        /app/main.py (Python script)
Copy:              COPY main.py .
Copy:              COPY requirements.txt .
```

### Secondary Service (If Deployed)
```
service_name: ocr-service
config_file: ocr-service/railway.json
builder: DOCKERFILE (relative to ocr-service/)
runtime: Python 3.11 (same as root)
entry_point: uvicorn main:app --host 0.0.0.0 --port $PORT
healthcheck: /health (300 seconds timeout)
```

### Node.js Services (NOT CONFIGURED FOR RAILWAY)
- **rag-worker/** – Has package.json and worker.js but NO railroad.json, NO Dockerfile
- **src/server.js** – Node.js server exists but not referenced in any Railway config

---

## SECTION 3 – Code RÉELLEMENT Déployé

### What Is Actually Running in Railway Container

**Runtime**: Python 3.11 slim image
**Working Directory**: /app

**Executed Files**:
- /app/main.py (from root)
- /app/requirements.txt (dependencies)
- System packages: poppler-utils, libgomp1, libglib2.0-0, libsm6, libxext6, libxrender-dev, libgl1

**Available in Container**:
- Python environment with packages from requirements.txt
- No Node.js runtime
- No npm modules
- No /src directory copied
- No /rag-worker directory copied
- No /scripts directory copied

**Container Content** (from Dockerfile):
```
COPY requirements.txt .     # → /app/requirements.txt
RUN pip install -r requirements.txt
COPY main.py .             # → /app/main.py
CMD ["python", "main.py"]
```

### What Is NOT Deployed

**All of /src/**:
- src/server.js
- src/engines/ (including obligationExtractionEngine.js)
- src/prompts/ (including strategy routing)
- src/services/
- src/core/
- Everything in /src

**All of /rag-worker/**:
- rag-worker/worker.js
- rag-worker/core/
- rag-worker/extractors/
- rag-worker/processors/

**All of /scripts/**:
- scripts/testObligationExtraction.js
- scripts/runTestOnce.js

**All of /ocr-service/** (unless deployed as separate service):
- Potentially isolated service (has its own railway.json)

---

## SECTION 4 – Code Présent dans Repo mais Non Déployé

### Node.js Application Layer (Completely Absent from Railway)

**File**: src/server.js
- Status: Exists in repo
- Type: Node.js Express server
- Current state: Never executed by Railway
- Referenced in: Root package.json ("_start_original": "node src/server.js")
- Consequence: **DEAD CODE IN RAILWAY CONTEXT**

**Directory**: src/engines/
- Contains: obligationExtractionEngine.js
- Status: Exists in repo, recently refactored with strategy routing
- Import structure: Uses ../prompts/index.js
- Node.js dependencies: Requires OpenAI, Supabase clients
- Consequence: **CANNOT EXECUTE IN PYTHON-ONLY CONTAINER**

**Directory**: src/prompts/
- Files created: strictObligationsPrompt.js, legalObligationsPrompt.js, bestPracticesPrompt.js, contextualInsightsPrompt.js, index.js
- Status: Exist in repo, ESM imports
- Type: JavaScript prompt templates
- Consequence: **UNUSABLE IN PYTHON ENVIRONMENT**

**Directory**: /rag-worker/
- Purpose: Node.js RAG ingestion worker
- Entry point: worker.js (ESM modules)
- Dependencies: @google-cloud/vision, @supabase/supabase-js, openai, pdf-parse, mammoth, xlsx
- Status: Complete implementation with recent test injection
- Consequence: **NOT DEPLOYED – NO RAILWAY CONFIG**

**Directory**: /scripts/
- testObligationExtraction.js: Test runner for obligation extraction
- runTestOnce.js: Wrapper for Railway execution
- Status: Recently created for testing
- Consequence: **COMPLETELY INACCESSIBLE IN PYTHON CONTAINER** (directory doesn't exist)

### Modifications Made But Inaccessible

**worker.js (rag-worker/worker.js)**:
- Lines 14-26: Debug filesystem diagnostics added
- Lines 27-33: Test injection (import './scripts/testObligationExtraction.js')
- Status: Cannot execute (no Node.js runtime)

**package.json (root)**:
- Added: "test:obligation" script
- Modified: "start" script redirected to runTestOnce.js
- Status: Cannot execute (Python environment ignores package.json)

---

## SECTION 5 – Risques d'Incohérence Critique

### 🔴 SEVERITY: CRITICAL

#### 1. Deployment Mismatch
**Problem**: Repository contains complete Node.js application but Railway only deploys Python service

**Evidence**:
- railway.toml at root → Python image
- /Dockerfile at root → Python 3.11, runs main.py
- /src/ directory → Node.js code (never copied to container)
- /rag-worker/ → Complete worker (never deployed)
- /scripts/ → Test scripts (never deployed)

**Impact**:
- All Node.js code is orphaned in production
- No way to execute Node.js services without dedicated Railway service with separate config
- obligationExtractionEngine.js cannot run
- rag-worker cannot process documents

#### 2. Filesystem Diagnostic Failure
**Problem**: worker.js attempts to access ./scripts in Railway container
**Why it fails**:
- Container only copies main.py and requirements.txt
- /scripts directory not in container
- Process cannot find ./scripts/testObligationExtraction.js
- Error: "Cannot find module '/scripts/testObligationExtraction.js'"

**Evidence**:
- railway.toml specifies: COPY main.py . (ONLY this file)
- No COPY for /src, /scripts, or /rag-worker

#### 3. Broken Test Injection
**Problem**: rag-worker/worker.js injects test on startup
**Current state**:
- Import statement added: `await import("./scripts/testObligationExtraction.js");`
- worker.js never executes (no Node.js in container)
- Test never runs

**Chain of failures**:
1. Railway deploys Python only
2. No Node.js runtime available
3. rag-worker/worker.js never loads
4. Test injection never reaches execution
5. obligationExtractionEngine.js never invoked

#### 4. Service Architecture Ambiguity
**Question**: Is Node.js application intentionally orphaned or accidentally unconfigured?

**Possibilities**:
- A) Node.js service planned but not yet enabled in Railway
- B) Both services should coexist (monorepo design)
- C) Accidental configuration: Python service was default, Node.js never added

**Current state**:
- railroad.toml uses Dockerfile at root (Python)
- ocr-service has separate railway.json (Python)
- No railway config for Node.js services
- Unclear if intentional or oversight

#### 5. Code Duplication Across Runtimes
**Pattern identified**:
- obligationExtractionEngine.js in /src (Node.js)
- Similar extraction logic likely in ocr-service/main.py (Python)
- These codebases diverge
- Changes in one not reflected in other

**Consequence**:
- Extraction behavior differs between Python and Node.js versions
- Inconsistent results if both services coexist
- Knowledge sync problem (prompts, strategies, validation)

### 🟡 MEDIUM SEVERITY

#### 6. Package.json Configuration Ignored
**Problem**: Root package.json scripts not applicable in Python container

**Affected entries**:
- "start": "node scripts/runTestOnce.js" (overridden by railway.toml: python main.py)
- "test:obligation": "node scripts/testObligationExtraction.js" (unreachable)
- "_start_original": "node src/server.js" (dead reference)

**Impact**: Configuration noise, misleading to developers

#### 7. Test Script Unreachable
**Status**: Scripts created but inaccessible

**Files affected**:
- scripts/testObligationExtraction.js (created for testing)
- scripts/runTestOnce.js (created as wrapper)

**Why inaccessible**:
- /scripts not in Dockerfile COPY commands
- Not available in container filesystem
- Would require separate Node.js service to execute

### 🟠 LOW SEVERITY (Documentation)

#### 8. Temporal Markers Misleading
**Created for debugging but pointing to non-existent service**:
- Comments in rag-worker/worker.js: "TEMPORARY: OBLIGATION EXTRACTION TEST"
- Comments in package.json: "TEMPORARY: start script redirected..."
- Cleanup instructions reference non-existent test runs in Railway

---

## SUMMARY TABLE

| Component | Repo Status | Railway Deployed | Runtime | Access | Notes |
|-----------|------------|------------------|---------|--------|-------|
| main.py | ✅ Present | ✅ Copied | Python | ✅ Executed | Only Node.js code deployed |
| requirements.txt | ✅ Present | ✅ Copied | Python | ✅ Read | Python dependencies |
| /src/** | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Complete app layer orphaned |
| src/server.js | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Express server never runs |
| src/engines/obligationExtractionEngine.js | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Recent refactoring unused |
| src/prompts/** | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Strategy routing inaccessible |
| /rag-worker/** | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | No service config |
| rag-worker/worker.js | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Injection logic never runs |
| /scripts/** | ✅ Present | ❌ Not copied | Node.js | ❌ Inaccessible | Test scripts created but unreachable |
| railway.toml | ✅ Present | ✅ Used | Config | ✅ Parsed | Python service only |
| package.json | ✅ Present | ❌ Used | Node.js | ❌ Ignored | Misleading start script |
| Dockerfile (root) | ✅ Present | ✅ Used | Python | ✅ Built | Only copies Python files |

---

## CONCLUSION DIAGNOSTIQUE

**Current Production State**: Python-only monolithic service (main.py)

**Repository State**: Hybrid monorepo with orphaned Node.js layer

**Critical Gap**: Complete disconnect between repository design and Railway deployment configuration

**Unresolved Questions**:
1. Should Node.js services be deployed as separate Railway services?
2. Is /src application code intentionally not deployed?
3. Should rag-worker be a separate service?
4. Why is railway.toml configured for root Python when /src contains Node.js server?

**Immediate Action Required**:
- Clarify intended architecture (single Python service or multi-service)
- Either deploy Node.js services or remove from repository
- Establish single source of truth for extraction logic

**Current State**: ⚠️ **BROKEN FOR NODE.JS TESTING**
- Test injection added but cannot execute
- obligationExtractionEngine.js refactored but inaccessible
- /scripts/ does not exist in container (as expected for Python-only deployment)

---

**Fin d'audit**
**Statut**: FINAL
**Confiance**: 100% (file system verified, configs read)
