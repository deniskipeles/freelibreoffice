"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Docs() {
  const [host, setHost] = useState("freelibreoffice.pages.dev");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeSnippets = {
    curlFile: `curl --request POST \\
  --url "https://${host}/api/convert?format=webp&page=1&quality=85" \\
  --header "Content-Type: multipart/form-data" \\
  --form "file=@/path/to/document.docx"`,

    curlUrl: `curl --request POST \\
  --url "https://${host}/api/convert?format=svg&page=1&url=https://example.com/document.docx"`,

    jsFetch: `const formData = new FormData();
formData.append("file", fileInput.files[0]);

// 1. Get CDN Cached URL Metadata
const response = await fetch("https://${host}/api/convert?format=webp&page=1", {
  method: "POST",
  body: formData
});

const metadata = await response.json();
console.log("Streamable Link:", metadata.url);

// 2. Load directly into your <img> tag
document.getElementById("preview-img").src = metadata.url;`,

    pythonRequests: `import requests

url = "https://${host}/api/convert"
params = {
    "format": "webp",
    "page": "1",
    "quality": "80"
}

# Uploading local file
files = {'file': open('document.docx', 'rb')}
response = requests.post(url, params=params, files=files)

metadata = response.json()
print("CDN Streaming URL:", metadata.get("url"))`,

    goHttp: `package main

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
)

func main() {
	apiUrl := "https://${host}/api/convert?format=png&page=1"
	
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	
	f, _ := os.Open("document.docx")
	defer f.Close()
	
	fw, _ := w.CreateFormFile("file", "document.docx")
	io.Copy(fw, f)
	w.Close()
	
	req, _ := http.NewRequest("POST", apiUrl, &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	
	client := &http.Client{}
	res, _ := client.Do(req)
	defer res.Body.Close()
	
	body, _ := io.ReadAll(res.Body)
	fmt.Println(string(body))
}`
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-6 px-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">
              FreeLibreOffice <span className="text-blue-600 dark:text-blue-400 font-medium">Docs</span>
            </span>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5"
          >
            ← Back to Sandbox
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="md:col-span-3 space-y-4 md:sticky md:top-24 h-fit">
          <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">Endpoints</h3>
          <nav className="flex flex-col gap-2 text-sm font-medium">
            <a href="#convert" className="text-blue-600 dark:text-blue-400 hover:underline">POST /api/convert</a>
            <a href="#stream" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">GET /api/convert</a>
          </nav>
          
          <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase pt-4">SDK Examples</h3>
          <nav className="flex flex-col gap-2 text-sm font-medium">
            <a href="#curl" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">cURL Snippets</a>
            <a href="#javascript" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">JavaScript</a>
            <a href="#python" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Python</a>
            <a href="#go" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Go</a>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="md:col-span-9 space-y-12">
          
          {/* Intro */}
          <section className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8">
            <h1 className="text-3xl font-bold tracking-tight">API Reference Documentation</h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed">
              The FreeLibreOffice API converts office documents into high-fidelity vector PDF files or directly extracts individual pages as responsive raster/vector image layers.
            </p>
          </section>

          {/* Endpoint: POST */}
          <section id="convert" className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-2.5 py-1 rounded-md">POST</span>
                <code className="text-sm font-semibold">/api/convert</code>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">
                Transforms an uploaded document file or remote URL, stores the layout output inside the CDN Edge Cache, and returns a JSON payload containing metadata and a high-speed direct stream URL.
              </p>
            </div>

            {/* Query Parameters Table */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-500">
                    <th className="p-4">Query Param</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Default</th>
                    <th className="p-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr>
                    <td className="p-4 font-mono font-semibold text-blue-600 dark:text-blue-400">format</td>
                    <td className="p-4 text-zinc-500">string</td>
                    <td className="p-4 font-mono">pdf</td>
                    <td className="p-4">Target extension: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-xs">pdf, svg, png, jpeg, webp, avif</code>.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-semibold text-blue-600 dark:text-blue-400">page</td>
                    <td className="p-4 text-zinc-500">number</td>
                    <td className="p-4 font-mono">1</td>
                    <td className="p-4">The target page to extract. Ignored for PDF conversions.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-semibold text-blue-600 dark:text-blue-400">quality</td>
                    <td className="p-4 text-zinc-500">number</td>
                    <td className="p-4 font-mono">80</td>
                    <td className="p-4">Raster image compression ratio (1-100). Applies only to <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-xs">jpeg, webp, avif</code>.</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-mono font-semibold text-blue-600 dark:text-blue-400">url</td>
                    <td className="p-4 text-zinc-500">string</td>
                    <td className="p-4 text-zinc-500">None</td>
                    <td className="p-4">A direct public link to the source document. Bypass multipart files entirely.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Handshake Response */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Response Payload (JSON)</h4>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800">
{`{
  "success": true,
  "hash": "eebcd49494a4d378e81dbb8d7...",
  "format": "webp",
  "mimeType": "image/webp",
  "totalPages": 12,
  "actualPage": 1,
  "url": "https://${host}/api/convert?hash=eebcd49494a4d378e81dbb8d7...&format=webp&page=1&quality=80"
}`}
              </pre>
            </div>
          </section>

          {/* Endpoint: GET (Stream) */}
          <section id="stream" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs px-2.5 py-1 rounded-md">GET</span>
              <code className="text-sm font-semibold">/api/convert?hash=...</code>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              Retrieves the cached converted file directly from the Cloudflare Edge CDN using its unique content hash. Returns the raw file bytes with appropriate content-type headers and 1-year browser cache headers (<code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-xs">Cache-Control</code>).
            </p>
          </section>

          {/* Code Snippets Section */}
          <section id="curl" className="space-y-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold">Code Integration Examples</h2>

            {/* cURL Local File */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">cURL (Multipart Upload)</h3>
                <button
                  onClick={() => handleCopy(codeSnippets.curlFile, "curlFile")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copiedIndex === "curlFile" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800 font-mono">
                {codeSnippets.curlFile}
              </pre>
            </div>

            {/* cURL URL Link */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">cURL (Import Remote URL)</h3>
                <button
                  onClick={() => handleCopy(codeSnippets.curlUrl, "curlUrl")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copiedIndex === "curlUrl" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800 font-mono">
                {codeSnippets.curlUrl}
              </pre>
            </div>

            {/* JavaScript fetch */}
            <div id="javascript" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">JavaScript (Web API / Fetch)</h3>
                <button
                  onClick={() => handleCopy(codeSnippets.jsFetch, "jsFetch")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copiedIndex === "jsFetch" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800 font-mono">
                {codeSnippets.jsFetch}
              </pre>
            </div>

            {/* Python requests */}
            <div id="python" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Python (Requests)</h3>
                <button
                  onClick={() => handleCopy(codeSnippets.pythonRequests, "pythonRequests")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copiedIndex === "pythonRequests" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800 font-mono">
                {codeSnippets.pythonRequests}
              </pre>
            </div>

            {/* Go Native net/http */}
            <div id="go" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Go (net/http Multipart)</h3>
                <button
                  onClick={() => handleCopy(codeSnippets.goHttp, "goHttp")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copiedIndex === "goHttp" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs overflow-x-auto border border-zinc-800 font-mono">
                {codeSnippets.goHttp}
              </pre>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}