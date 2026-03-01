export async function extractImageText(arrayBuffer, fileName) {
  try {
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const response = await fetch(
      "https://vision.googleapis.com/v1/images:annotate?key=" +
        process.env.GOOGLE_VISION_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: "TEXT_DETECTION" },
                { type: "DOCUMENT_TEXT_DETECTION" },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Google Vision API failed: ${errorData.error?.message || "Unknown error"}`
      );
    }

    const result = await response.json();

    if (
      !result.responses ||
      !result.responses[0] ||
      !result.responses[0].fullTextAnnotation
    ) {
      throw new Error("No text detected in image");
    }

    const text = result.responses[0].fullTextAnnotation.text || "";

    if (!text || text.trim().length === 0) {
      throw new Error("Image OCR returned empty text");
    }

    return {
      text: text.trim(),
      confidence: "ocr",
      detections: result.responses[0].textAnnotations?.length || 0,
    };
  } catch (error) {
    throw new Error(`Image OCR failed: ${error.message}`);
  }
}
