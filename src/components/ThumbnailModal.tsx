import React, { useState } from 'react';
import { X, Image as ImageIcon, Download, RefreshCw, Wand2 } from 'lucide-react';
import { Scene, AspectRatio } from '../types';

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  aspectRatio: AspectRatio;
}

export default function ThumbnailModal({ isOpen, onClose, scenes, aspectRatio }: ThumbnailModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateThumbnail = async () => {
    setIsGenerating(true);
    setErrorText(null);
    setThumbnailUrl(null);
    try {
      const scenesText = scenes.map(s => s.text).join(" ");
      const response = await fetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenesText, aspectRatio })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const data = await response.json();
      if (data.imageUrl) {
        setThumbnailUrl(data.imageUrl);
      } else {
        throw new Error("No image URL received.");
      }
    } catch (e: any) {
      setErrorText(e.message || "Failed to generate thumbnail.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!thumbnailUrl) return;
    const a = document.createElement("a");
    a.href = thumbnailUrl;
    a.download = `yotor-thumbnail-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300 font-sans">
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-3xl w-full max-w-4xl shadow-2xl shadow-indigo-900/20 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="text-xl font-light text-white tracking-tight">ማራኪ ታምኔል መፍጠሪያ (AI Thumbnail Maker)</h2>
              <span className="text-xs text-zinc-500 font-mono tracking-wider">GENERATE CLICKABLE THUMBNAILS FOR YOUR VIDEO</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center relative min-h-[400px]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-6 animate-pulse">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="text-indigo-400" size={32} />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold font-sans text-indigo-400 mb-2">ታምኔል እየተሰራ ነው... አፍታ ይጠብቁ</h3>
                <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Painting Cinematic Masterpiece</p>
              </div>
            </div>
          ) : thumbnailUrl ? (
            <div className="flex flex-col items-center gap-6 w-full fade-in slide-in-from-bottom-5 animate-in duration-500">
               <div className="relative group rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900 max-w-full">
                  <img 
                    src={thumbnailUrl} 
                    alt="Generated Video Thumbnail" 
                    className="max-w-full max-h-[500px] object-contain transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                     <p className="text-xs font-mono text-zinc-300 uppercase tracking-widest drop-shadow-md">Generated with Gemini 3.1 Flash</p>
                  </div>
               </div>
            </div>
          ) : (
            <div className="text-center max-w-lg space-y-6">
              <div className="w-20 h-20 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-center mx-auto text-zinc-600 mb-6 shadow-inner">
                 <ImageIcon size={32} />
              </div>
              <h3 className="text-white text-xl font-bold font-sans">የቪዲዮዎን ታምኔል (Thumbnail) በአንድ ክሊክ ይስሩ</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                በቪዲዮዎ ስክሪፕት ውስጥ ያለውን ሃሳብ (Concept) በመረዳት እጅግ ማራኪ እና ዓይን የሚስብ ሽፋን (Cover Image) AI በሰከንዶች ውስጥ ያሰናዳልዎታል።
              </p>
            </div>
          )}

          {errorText && (
             <div className="mt-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-xs font-mono w-full max-w-xl text-center">
                ስህተት አጋጥሟል! {errorText}
             </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
           <div className="text-[10px] text-zinc-600 font-mono tracking-wider flex flex-col gap-1">
             <span>* Gemini 3.1 Flash Image Engine</span>
             <span>* 1K Resolution High-Quality Output</span>
           </div>
           
           <div className="flex gap-4">
              {thumbnailUrl && !isGenerating && (
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold font-sans flex items-center gap-2 transition-all shadow-lg"
                >
                  <Download size={16} />
                  አውርድ (Download)
                </button>
              )}
              
              <button
                onClick={generateThumbnail}
                disabled={isGenerating || scenes.length === 0}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold font-sans flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                {thumbnailUrl ? <RefreshCw size={16} /> : <Wand2 size={16} />}
                {thumbnailUrl ? 'በድጋሚ ሞክር (Re-Generate)' : 'ታምኔል ፍጠር (Generate Now)'}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}
