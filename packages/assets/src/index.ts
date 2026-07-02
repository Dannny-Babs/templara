export interface GoogleFontRequest {
  family: string;
  weights?: number[];
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
}

export function getGoogleFontCssUrl(request: GoogleFontRequest): string {
  const family = request.family.trim().replace(/\s+/g, "+");
  const weights = request.weights?.length ? `:wght@${request.weights.join(";")}` : "";
  const display = request.display ?? "swap";

  return `https://fonts.googleapis.com/css2?family=${family}${weights}&display=${display}`;
}

export async function waitForDocumentFonts(): Promise<void> {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
}
