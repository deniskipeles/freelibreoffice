import { NextRequest } from 'next/server';

export const runtime = 'edge';

const DOCUMENT_CONVERT_TOOL_URL = process.env.DOCUMENT_CONVERT_TOOL_URL || 'https://localhost:3000';

// Fallback in-memory cache for environments without Cloudflare CDN cache (e.g. Hugging Face, Localhost)
// Declared globally so it persists across server requests.
const memoryCache = new Map<string, { body: ArrayBuffer; contentType: string }>();

// CORS Handler helper
function handleCors(req: NextRequest, response: Response): Response {
  const origin = req.headers.get('origin') || '*';
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', origin);
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  newHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCors(req, new Response(null, { status: 204 }));
}

async function sha256(buffer: ArrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('hash');
  const format = req.nextUrl.searchParams.get('format') || 'pdf';
  const page = req.nextUrl.searchParams.get('page') || '1';
  const quality = req.nextUrl.searchParams.get('quality') || '80';

  // ACTION 1: Act as the stream server
  if (hash) {
    const cacheKeyUrl = `https://api.freelibreoffice.pages.dev/cache/${hash}-p${page}-q${quality}.${format}`;
    const cacheKey = new Request(cacheKeyUrl);
    
    const globalCaches = typeof caches !== 'undefined' ? (caches as any) : null;
    const cfCache = globalCaches && globalCaches.default ? globalCaches.default : null;

    // A. Attempt to retrieve from Cloudflare CDN first
    if (cfCache) {
      try {
        const cachedResponse = await cfCache.match(cacheKey);
        if (cachedResponse) {
          console.log('Serving from Cloudflare CDN Edge Cache');
          return handleCors(req, cachedResponse);
        }
      } catch (err) {
        console.warn('CDN Cache lookup failed:', err);
      }
    } 
    // B. Fallback to Local Memory Cache (For Hugging Face / Local Dev)
    else {
      const cacheId = `${hash}-p${page}-q${quality}.${format}`;
      const cached = memoryCache.get(cacheId);
      if (cached) {
        console.log(`Serving from Memory Cache (Hugging Face Fallback): ${cacheId}`);
        return handleCors(req, new Response(cached.body, {
          headers: { 
            'Content-Type': cached.contentType,
            'Cache-Control': 'public, max-age=31536000' 
          }
        }));
      }
    }

    return handleCors(req, new Response('File expired or not found. Please re-upload.', { status: 410 }));
  }

  return handleConversion(req);
}

export async function POST(req: NextRequest) {
  return handleConversion(req);
}

// ACTION 2: Process document, cache, and return dynamic JSON url metadata
async function handleConversion(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'pdf';
    const page = req.nextUrl.searchParams.get('page') || '1';
    const quality = req.nextUrl.searchParams.get('quality') || '80';
    const queryUrl = req.nextUrl.searchParams.get('url');

    let fileBuffer: ArrayBuffer;
    let fileName = 'document';
    let fileMimeType = 'application/octet-stream';

    if (queryUrl) {
      const fileRes = await fetch(queryUrl);
      if (!fileRes.ok) throw new Error(`Failed to fetch file from remote URL`);
      fileBuffer = await fileRes.arrayBuffer();
      const urlPath = new URL(queryUrl).pathname;
      fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1) || 'document';
      fileMimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
    } else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const file = formData.get('file');
        if (file && file instanceof File) {
          fileBuffer = await file.arrayBuffer();
          fileName = file.name;
          fileMimeType = file.type;
        } else {
          return handleCors(req, new Response('No file uploaded', { status: 400 }));
        }
      } else {
        return handleCors(req, new Response('Unsupported content-type', { status: 400 }));
      }
    } else {
      return handleCors(req, new Response('Missing file or url parameters', { status: 400 }));
    }

    const fileHash = await sha256(fileBuffer);
    const cacheKeyUrl = `https://api.freelibreoffice.pages.dev/cache/${fileHash}-p${page}-q${quality}.${format}`;
    const cacheKey = new Request(cacheKeyUrl);
    
    const globalCaches = typeof caches !== 'undefined' ? (caches as any) : null;
    const cfCache = globalCaches && globalCaches.default ? globalCaches.default : null;

    let isCached = false;
    
    // Check CDN Cache
    if (cfCache) {
      const cached = await cfCache.match(cacheKey);
      if (cached) isCached = true;
    } 
    // Check Local Memory Cache fallback
    else {
      const cacheId = `${fileHash}-p${page}-q${quality}.${format}`;
      if (memoryCache.has(cacheId)) isCached = true;
    }

    // Process if missing from both caches
    if (!isCached) {
      const targetUrl = `${DOCUMENT_CONVERT_TOOL_URL}/process?format=${format}&page=${page}&quality=${quality}`;
      const hfFormData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: fileMimeType });
      hfFormData.append('file', fileBlob, fileName);

      const hfResponse = await fetch(targetUrl, { method: 'POST', body: hfFormData });
      if (!hfResponse.ok) throw new Error(await hfResponse.text());

      const pdfArrayBuffer = await hfResponse.arrayBuffer();
      const responseContentType = hfResponse.headers.get('Content-Type') || 'application/octet-stream';

      const finalResponse = new Response(pdfArrayBuffer, {
        headers: {
          'Content-Type': responseContentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
        }
      });

      // A. Write to CDN cache if on Cloudflare
      if (cfCache) {
        await cfCache.put(cacheKey, finalResponse.clone());
      } 
      // B. Write to Local Memory cache if on Hugging Face
      else {
        const cacheId = `${fileHash}-p${page}-q${quality}.${format}`;
        memoryCache.set(cacheId, {
          body: pdfArrayBuffer,
          contentType: responseContentType
        });
      }
    }

    // Dynamic self-referential hostname detection
    const host = req.headers.get('host') || 'api.freelibreoffice.pages.dev';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const dynamicStreamUrl = `${protocol}://${host}/api/convert?hash=${fileHash}&format=${format}&page=${page}&quality=${quality}`;

    return handleCors(req, new Response(JSON.stringify({
      success: true,
      hash: fileHash,
      format: format,
      mimeType: format === 'pdf' ? 'application/pdf' : `image/${format === 'svg' ? 'svg+xml' : format}`,
      url: dynamicStreamUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error: any) {
    return handleCors(req, new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}