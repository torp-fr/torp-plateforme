#!/bin/bash

# Test basique : Health check
echo "=== Test 1: Health check ==="
curl -s https://quote-insight-tally-production.up.railway.app/health | jq .

# Test OCR avec un petit PDF
echo -e "\n=== Test 2: OCR test (creating small base64 PDF) ==="

# Créer un petit PDF de test encodé en base64
# (juste pour tester, pas un vrai PDF DTU)
TEST_B64="JVBERi0xLjAKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCA2MTIgNzkyXS9QYXJlbnQgMiAwIFI+PmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAxMCAwMDAwMCBuCjAwMDAwMDAwNTMgMDAwMDAgbgowMDAwMDAwMTAyIDAwMDAwIG4KdHJhaWxlcjw8L1NpemUgNC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjE2OAolJUVPRg=="

echo "Sending OCR request to Railway..."
curl -X POST https://quote-insight-tally-production.up.railway.app/ocr \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"$TEST_B64\",
    \"mime_type\": \"application/pdf\",
    \"max_pages\": 5
  }" \
  -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -s --max-time 60

echo -e "\n=== Test terminé ==="
