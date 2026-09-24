/**
 * Parses Google Flow batchexecute responses, JSON arrays or raw googleusercontent URLs
 */

export interface ParsedFlowFrame {
  id: number;
  imageUrl: string;
  name?: string;
  prompt?: string;
}

export function parseGoogleFlowPayload(rawInput: string): ParsedFlowFrame[] {
  if (!rawInput || typeof rawInput !== 'string') return [];

  // Pre-process escaped JSON characters
  const sanitized = rawInput
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');

  const foundUrls: string[] = [];
  const promptMap = new Map<string, string>();

  // Extract prompts if present before image url in batchexecute RPC structures
  // Pattern: "prompt text",..., "https://flow-content.google/..."
  const promptAndUrlRegex = /"([^"]{15,4000}?)",[^[\]]*?"(https?:\/\/(?:flow-content\.google|lh[0-9]|labs|aisandbox)[^"]+?)"/g;
  let pMatch;
  while ((pMatch = promptAndUrlRegex.exec(sanitized)) !== null) {
    const promptText = pMatch[1].trim();
    const url = pMatch[2].replace(/\\/g, '').replace(/[,;)]+$/, '');
    if (!promptText.startsWith('http') && !promptMap.has(url)) {
      promptMap.set(url, promptText);
    }
  }

  // General URL Regex for Google Flow image CDN & Googleusercontent
  const urlRegex = /(https?:\/\/(?:flow-content\.google\/image\/[a-zA-Z0-9_-]+[^\s"'`<\\]*|lh[0-9]\.googleusercontent\.com\/[^\s"'`<\\]+|[^\s"'`<\\]+?\.(?:png|jpg|jpeg|webp)(?:\?[^\s"'`<\\]*)?))/gi;

  let match;
  while ((match = urlRegex.exec(sanitized)) !== null) {
    let cleanUrl = match[1];
    cleanUrl = cleanUrl.replace(/[,;)]+$/, '');
    cleanUrl = cleanUrl.replace(/\\/g, '');

    if (!foundUrls.includes(cleanUrl)) {
      foundUrls.push(cleanUrl);
    }
  }

  // Fallback: line-by-line if user pasted list of image links
  if (foundUrls.length === 0) {
    const lines = sanitized.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim().replace(/^["']|["']$/g, '');
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!foundUrls.includes(trimmed)) {
          foundUrls.push(trimmed);
        }
      }
    }
  }

  // Return mapped frames
  return foundUrls.map((url, idx) => ({
    id: idx + 1,
    imageUrl: url,
    name: `Кадр ${idx + 1} (Google Flow)`,
    prompt: promptMap.get(url) || undefined
  }));
}
