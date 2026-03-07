async function extractPdf(buffer: Buffer): Promise<string> {

  console.log("[PDF] parsing started")

  const result = await pdfParse(buffer)

  console.log("[PDF] parsing completed")

  return result.text
    .replace(/\f/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .trim()
}
