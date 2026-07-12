import { NextRequest } from 'next/server';

export const runtime = 'edge';

const DOCUMENT_CONVERT_TOOL_URL = process.env.DOCUMENT_CONVERT_TOOL_URL || 'https://localhost:3000';

const memoryCache = new Map<string, { body: ArrayBuffer; contentType: string }>();

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

  if (hash) {
    const cacheKeyUrl = `https://api.freelibreoffice.pages.dev/cache/${hash}-p${page}-q${quality}.${format}`;
    const cacheKey = new Request(cacheKeyUrl);
    
    const globalCaches = typeof caches !== 'undefined' ? (caches as any) : null;
    const cfCache = globalCaches && globalCaches.default ? globalCaches.default : null;

    if (cfCache) {
      try {
        const cachedResponse = await cfCache.match(cacheKey);
        if (cachedResponse) {
          return handleCors(req, cachedResponse);
        }
      } catch (err) {
        console.warn('Cache error:', err);
      }
    } else {
      const cacheId = `${hash}-p${page}-q${quality}.${format}`;
      const cached = memoryCache.get(cacheId);
      if (cached) {
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

async function handleConversion(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'pdf';
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
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
    const globalCaches = typeof caches !== 'undefined' ? (caches as any) : null;
    const cfCache = globalCaches && globalCaches.default ? globalCaches.default : null;

    let isCached = false;
    let cachedTotalPages = '1';
    let cachedActualPage = page.toString();

    // Check Cache by requested page
    const requestedCacheId = `${fileHash}-p${page}-q${quality}.${format}`;
    const requestedCacheKeyUrl = `https://api.freelibreoffice.pages.dev/cache/${requestedCacheId}`;
    const requestedCacheKey = new Request(requestedCacheKeyUrl);

    if (cfCache) {
      const cached = await cfCache.match(requestedCacheKey);
      if (cached) {
        isCached = true;
        cachedTotalPages = cached.headers.get('X-Total-Pages') || '1';
        cachedActualPage = cached.headers.get('X-Actual-Page') || page.toString();
      }
    } else if (memoryCache.has(requestedCacheId)) {
      isCached = true;
      // In-memory cache hit uses the requested page values
    }

    let totalPages = parseInt(cachedTotalPages, 10);
    let actualPage = parseInt(cachedActualPage, 10);

    if (!isCached) {
      const targetUrl = `${DOCUMENT_CONVERT_TOOL_URL}/process?format=${format}&page=${page}&quality=${quality}`;
      const hfFormData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: fileMimeType });
      hfFormData.append('file', fileBlob, fileName);

      const hfResponse = await fetch(targetUrl, { method: 'POST', body: hfFormData });
      if (!hfResponse.ok) throw new Error(await hfResponse.text());

      totalPages = parseInt(hfResponse.headers.get('X-Total-Pages') || '1', 10);
      actualPage = parseInt(hfResponse.headers.get('X-Actual-Page') || page.toString(), 10);

      const pdfArrayBuffer = await hfResponse.arrayBuffer();
      const responseContentType = hfResponse.headers.get('Content-Type') || 'application/octet-stream';

      const finalResponse = new Response(pdfArrayBuffer, {
        headers: {
          'Content-Type': responseContentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
          'X-Total-Pages': totalPages.toString(),
          'X-Actual-Page': actualPage.toString()
        }
      });

      // Write output to CDN or local memory cache
      if (cfCache) {
        // Cache under requested page
        await cfCache.put(requestedCacheKey, finalResponse.clone());
        
        // Optimize: Also cache under canonical page to prevent duplicate backend calls
        if (page !== actualPage) {
          const canonicalCacheKey = new Request(`https://api.freelibreoffice.pages.dev/cache/${fileHash}-p${actualPage}-q${quality}.${format}`);
          await cfCache.put(canonicalCacheKey, finalResponse.clone());
        }
      } else {
        memoryCache.set(requestedCacheId, { body: pdfArrayBuffer, contentType: responseContentType });
        if (page !== actualPage) {
          memoryCache.set(`${fileHash}-p${actualPage}-q${quality}.${format}`, { body: pdfArrayBuffer, contentType: responseContentType });
        }
      }
    }

    const host = req.headers.get('host') || 'api.freelibreoffice.pages.dev';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    
    // Output URL uses the canonical actualPage to maximize cache sharing
    const dynamicStreamUrl = `${protocol}://${host}/api/convert?hash=${fileHash}&format=${format}&page=${actualPage}&quality=${quality}`;

    return handleCors(req, new Response(JSON.stringify({
      success: true,
      hash: fileHash,
      format: format,
      mimeType: format === 'pdf' ? 'application/pdf' : `image/${format === 'svg' ? 'svg+xml' : format}`,
      totalPages: totalPages,
      actualPage: actualPage,
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