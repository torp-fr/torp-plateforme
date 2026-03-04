# Knowledge Corpus — TORP Knowledge Brain

Ce dossier contient les documents sources utilisés pour alimenter le Knowledge Brain
de la plateforme TORP. Il est organisé par type de document pour faciliter la gestion
et la traçabilité des ingestions.

## Structure

```
knowledge_corpus/
├── regulations/       Textes réglementaires (DTU, arrêtés, décrets, RE 2020…)
├── guides/            Guides de mise en œuvre et bonnes pratiques
├── normes/            Normes NF, EN, ISO, Eurocodes
├── pricing/           Bordereaux de prix, DPGF, mercuriales, indices
├── jurisprudence/     Arrêts, jugements, sentences arbitrales BTP
└── technical_docs/    Documentation technique générale (DOE, AT, CCTP…)
```

## Ingestion

Pour ingérer un dossier entier (max 10 fichiers par batch) :

```bash
pnpm ingest:batch ./knowledge_corpus/regulations
pnpm ingest:batch ./knowledge_corpus/guides
pnpm ingest:batch ./knowledge_corpus/pricing
```

Pour tester sans écriture en base :

```bash
pnpm ingest:batch ./knowledge_corpus/regulations --dry-run
```

## Formats supportés

| Extension | Extracteur |
|-----------|-----------|
| `.pdf`    | pdf-parse (PDFParse class) |
| `.docx`   | mammoth |
| `.xlsx`   | exceljs |
| `.csv`    | papaparse |
| `.txt`    | UTF-8 decode |
| `.md`     | UTF-8 decode |

## Règles de sécurité

- Taille maximale par fichier : **25 MB**
- Nombre max de chunks par document : **500**
- Doublons : le script détecte et ignore les documents déjà ingérés (même titre)
- En cas d'échec : le document est marqué `ingestion_status = 'failed'` en base

## Ajout de documents

1. Déposer le fichier dans le sous-dossier approprié
2. Respecter la convention de nommage (voir README.md de chaque sous-dossier)
3. Lancer `pnpm ingest:batch ./knowledge_corpus/<sous-dossier>`
4. Vérifier le résultat dans la table `knowledge_documents` de Supabase
