"use client";

import { useState } from "react";

// Optional env variable. If empty, falls back to the relative path of the deployed instance.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function Home() {
  const [sourceType, setSourceType] = useState<"upload" | "url">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");

  const [format, setFormat] = useState<string>("pdf");
  const [page, setPage] = useState<number>(1);
  const [quality, setQuality] = useState<number>(80);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (sourceType === "upload" && !file) {
      setError("Please select a file to upload.");
      return;
    }
    if (sourceType === "url" && !fileUrl.trim()) {
      setError("Please enter a valid document URL.");
      return;
    }

    setLoading(true);
    setPreviewUrl(null);
    setPreviewType(null);

    try {
      let requestUrl = `${API_URL}/api/convert?format=${format}&page=${page}&quality=${quality}`;
      const options: RequestInit = { method: "POST" };

      if (sourceType === "upload") {
        const formData = new FormData();
        formData.append("file", file!);
        options.body = formData;
      } else {
        requestUrl += `&url=${encodeURIComponent(fileUrl.trim())}`;
      }

      // 1. Fetch JSON Handshake metadata
      const response = await fetch(requestUrl, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Conversion failed");
      }

      const metadata = await response.json();

      // 2. Load the dynamic cached CDN stream URL directly into the DOM
      setPreviewUrl(metadata.url);
      setPreviewType(metadata.mimeType);
      
    } catch (err: any) {
      setError(err.message || "An error occurred during conversion.");
    } finally {
      setLoading(false);
    }
  };

  const showQualitySlider = ["jpeg", "webp", "avif"].includes(format);
  const showPageSelector = format !== "pdf";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-6 px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              FreeLibreOffice <span className="text-blue-600 dark:text-blue-400">Converter</span>
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-zinc-700">
              Zero Hardcode Fork Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Sandbox Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Controls Panel - Left */}
        <section className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-fit">
          <form onSubmit={handleConvert} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Configuration</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Supports automatic hosting detection and decentralized edge streams.
              </p>
            </div>

            {/* Source Type Tab Switcher */}
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl">
              <button
                type="button"
                onClick={() => { setSourceType("upload"); setError(null); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  sourceType === "upload"
                    ? "bg-white dark:bg-zinc-850 shadow-sm text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => { setSourceType("url"); setError(null); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  sourceType === "url"
                    ? "bg-white dark:bg-zinc-850 shadow-sm text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                Import URL
              </button>
            </div>

            {/* Toggle Input Display */}
            {sourceType === "upload" ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Document File
                </label>
                <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl p-6 transition-all text-center relative bg-zinc-50/50 dark:bg-zinc-950/30">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.rtf,.txt"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1 pointer-events-none">
                    <p className="text-sm font-medium">
                      {file ? file.name : "Select or drag file here"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Supports DOCX, PPTX, XLSX, ODT, PDF..."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Remote File URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/document.docx"
                  value={fileUrl}
                  onChange={(e) => { setFileUrl(e.target.value); setError(null); }}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Target Format Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["pdf", "svg", "png", "jpeg", "webp", "avif"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`py-2 px-3 text-sm font-medium rounded-lg capitalize border transition-all ${
                      format === f
                        ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500"
                        : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Parameters */}
            <div className="grid grid-cols-2 gap-4">
              {showPageSelector && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Page Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={page}
                    onChange={(e) => setPage(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {showQualitySlider && (
                <div className="space-y-2 col-span-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Quality ({quality}%)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-full h-9"
                  />
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                loading
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Convert Document"
              )}
            </button>
          </form>
        </section>

        {/* Live Preview Panel - Right */}
        <section className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col h-[550px] lg:h-[650px]">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Live Sandbox Preview</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Decentralized streams utilizing native browser rendering engines.
              </p>
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                download={`converted-page.${format}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
              >
                Download File
              </a>
            )}
          </div>

          <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden flex items-center justify-center relative">
            {previewUrl ? (
              // Handles direct URL stream or standard uploaded blobs seamlessly
              previewType === "application/pdf" ? (
                <iframe
                  src={`${previewUrl}#view=FitH`}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Converted page output"
                  className="max-h-full max-w-full object-contain p-4 select-none shadow-sm"
                  onLoad={() => setLoading(false)} // Clear loader state upon native stream completion
                />
              )
            ) : (
              // Empty State
              <div className="text-center space-y-2 p-6 max-w-sm">
                <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold">No active render</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                  Provide a valid local document or a URL to generate and cache vector or raster files.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}