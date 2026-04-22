/**
 * Loads a logo URL into a data URL + dimensions for embedding in jsPDF.
 * Returns null on failure (so the PDF can fall back to a placeholder).
 */
export interface LoadedLogo {
  dataUrl: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
}

export async function loadLogoForPdf(url?: string | null): Promise<LoadedLogo | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const dims: { width: number; height: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });

    const format: "PNG" | "JPEG" = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG";
    return { dataUrl, format, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

/**
 * Compute display size that fits inside a max box while preserving aspect ratio.
 */
export function fitLogo(logo: LoadedLogo, maxW: number, maxH: number) {
  const ratio = logo.width / logo.height;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}
