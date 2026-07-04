import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Layers, Loader2, AlertCircle, FileArchive } from 'lucide-react';
import { Platform } from '../types';

export function BatchDownloaderView() {
  const [urls, setUrls] = useState('');
  const [format, setFormat] = useState('video/mp4');
  const [quality, setQuality] = useState('highest');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urlList.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList, format })
      });

      if (!res.ok) {
        throw new Error('Batch processing failed');
      }

      // Handle the zip download
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `batch_download_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      
      setResults(urlList.map((url, i) => ({ id: i, url, status: 'success' })));

    } catch (err: any) {
      setError(err.message || 'An error occurred during batch download');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 mt-10 border-t border-black/10 dark:border-white/10 pt-10">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-5 h-5" />
        <h2 className="text-xl font-dot tracking-widest uppercase">Batch Downloader</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            placeholder="Paste multiple URLs here (one per line)..."
            className="w-full h-32 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors text-sm custom-scrollbar resize-none"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="bg-transparent border-none text-xs font-dot uppercase tracking-widest text-black/60 dark:text-white/60 focus:ring-0 outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="highest">HQ</option>
            <option value="high">1080P</option>
            <option value="medium">720P</option>
            <option value="low">480P</option>
          </select>
          <select 
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-dot uppercase tracking-widest focus:ring-0 outline-none rounded-full px-4 py-2"
          >
            <option value="video/mp4">MP4 Video</option>
            <option value="audio/mp3">MP3 Audio</option>
          </select>

          <button
            type="submit"
            disabled={isProcessing || urls.trim().length === 0}
            className="flex-1 bg-black text-white dark:bg-white dark:text-black px-6 py-2.5 rounded-full text-xs font-bold tracking-widest hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PACKAGING ZIP...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>DOWNLOAD ZIP</span>
              </>
            )}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/10 text-red-500 text-sm p-4 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </motion.div>
        )}

        {results.length > 0 && !error && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#c2c6cc] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-2xl p-4">
               <h3 className="text-xs font-dot tracking-widest uppercase mb-3 text-black/60 dark:text-white/60">Batch Summary</h3>
               <div className="space-y-2">
                 {results.map((r, i) => (
                   <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/5 dark:bg-white/5">
                     <span className="truncate pr-4 max-w-[80%] opacity-80">{r.url}</span>
                     <span className="font-bold text-green-600 dark:text-green-400">SUCCESS</span>
                   </div>
                 ))}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
