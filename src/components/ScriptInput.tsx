import React, { useState } from 'react';
import { GOOGLE_TTS_LANGUAGES } from '../data';
import { Eye, EyeOff, Sparkles, AlertCircle, FileText, Settings, Key, HelpCircle } from 'lucide-react';

interface ScriptInputProps {
  onAnalyze: (script: string, pexelsKey: string, voiceLang: string) => Promise<void>;
  isLoading: boolean;
  loadingStage?: string;
}

const TEMPLATES = [
  {
    title: "✨ Cosmic Voyage",
    lang: "en-gb",
    script: "We stand on the edge of a new cosmos. Stars flicker in the endless fabric of space, calling us to explore what lies beyond. For generations, we have looked up and wondered. Now, we build the engines of discovery. We journey through deep nebulae, seeking new horizons and celestial wonders. This is the story of our infinite horizon, and the endless search for knowledge."
  },
  {
    title: "🏔️ Ethiopian Majestic (አማርኛ)",
    lang: "am",
    script: "ውብ እና ታላቅ ሀገር። ከሰማይ በታች የተንጣለሉ የሰሜን ተራሮች ግርማ ሞገስ እና አስደናቂው የታሪክ ጉዞ። ጥንታዊ የድንጋይ ውቅሮች እና የላሊበላ ገዳማት ምስጢር። ታላቁ አባይ ወንዝ በሸለቆዎች ውስጥ ሲፈስ የተፈጥሮን ድንቅ ስራ ያሳያል። ይህ በታሪክ እና በክብር የደመቀው ልዩ ሀገር ኢትዮጵያ ነው።"
  },
  {
    title: "🌊 Deep Blue Ocean",
    lang: "en-in",
    script: "Beneath the dancing waves lies an uncharted empire of glowing coral reefs. Sunlight fades into absolute cobalt silence where massive blue whales guide their kin. Luminescent creatures glow like neon lanterns in the deep trenches. A world unchanged for eons, whispering the ancient origin stories of our planet."
  },
  {
    title: "🌆 Cyberpunk Neo-Tokyo",
    lang: "en",
    script: "Neon rain slicked streets reflect the towering digital obelisks of a future city. Flying vehicles slice through the thick perpetual fog. Tech-wear nomads walk among holographic advertisements, where human consciousness and artificial neural meshes merge together. Welcome to the machine age."
  }
];

export default function ScriptInput({ onAnalyze, isLoading, loadingStage = "Analyzing Script..." }: ScriptInputProps) {
  const [script, setScript] = useState<string>(
    "We stand on the edge of a new cosmos. Stars flicker in the endless fabric of space, calling us to explore what lies beyond. For generations, we have looked up and wondered. Now, we build the engines of discovery. We journey through deep nebulae, seeking new horizons and celestial wonders. This is the story of our infinite horizon, and the endless search for knowledge."
  );
  const [pexelsKey, setPexelsKey] = useState<string>(() => {
    return localStorage.getItem('pexels_api_key') || '';
  });
  const [showKey, setShowKey] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-gb');
  const [showSettings, setShowSettings] = useState(false);

  // Approximate reading speed helper (estimating ~140 words per minute, i.e., 2.3 words/second)
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round(wordCount / 2.3);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!script.trim()) return;
    
    // Persist key locally for convenience
    if (pexelsKey) {
      localStorage.setItem('pexels_api_key', pexelsKey);
    } else {
      localStorage.removeItem('pexels_api_key');
    }
    
    onAnalyze(script, pexelsKey, voiceLang);
  };

  return (
    <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden" id="script-panel">
      {/* Visual background lights */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-sm uppercase tracking-widest font-semibold text-zinc-300">Script Processor</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Define your movie script and narration timeline</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-all ${
            showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Credentials & Settings"
          id="toggle-settings-btn"
        >
          <Settings size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Settings and Pexels integration keys */}
        {showSettings && (
          <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-3.5 animate-fadeIn" id="settings-drawer">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                <Key size={13} className="text-indigo-400" />
                Pexels API Key <span className="text-zinc-650 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={pexelsKey}
                  onChange={(e) => setPexelsKey(e.target.value)}
                  placeholder="Paste your Pexels API key here..."
                  className="w-full bg-[#050505] border border-zinc-800 text-zinc-100 text-sm rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:border-indigo-500/50"
                  id="pexels-key"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                If left blank, the applet automatically uses a **premium pre-curated cinematic library** with stunning 4K landscape footage so you can generate professional clips instantly. Get a free API key at{" "}
                <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                  pexels.com/api
                </a>
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="mb-4">
            <span className="text-[10px] font-mono tracking-widest font-semibold text-zinc-500 uppercase block mb-2">
              Select Breathtaking Narrative Preset / ፈጣን ታሪኮች
            </span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setScript(tpl.script);
                    setVoiceLang(tpl.lang);
                  }}
                  className={`p-2.5 text-[11px] rounded-xl border text-left transition-all font-sans block ${
                    script === tpl.script
                      ? 'bg-indigo-500/5 border-indigo-500/40 text-indigo-400 font-bold'
                      : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  <div className="truncate font-semibold">{tpl.title}</div>
                  <div className="text-[9px] text-zinc-550 italic truncate font-mono mt-0.5">Accent: {tpl.lang}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-400">Script Body ({wordCount} words)</label>
            <div className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              Estimated Runtime: <span className="text-indigo-400 font-medium">{minutes > 0 ? `${minutes}m ` : ''}{seconds}s</span>
            </div>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your video narrative script here... Writing a screenplay of around 700 words will compile a pristine, fully animated 5-minute masterwork!"
            rows={8}
            className="w-full bg-[#050505] border border-zinc-800 text-zinc-200 placeholder-zinc-600 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500/50 resize-y leading-relaxed font-sans"
            id="script-text-input"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Voice Tone & Accent (gTTS)</label>
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              className="w-full bg-[#050505] border border-zinc-800 text-zinc-300 text-sm rounded-xl p-3 focus:outline-none focus:border-indigo-500/50 font-sans"
              id="voice-selector"
            >
              {GOOGLE_TTS_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#0c0c0e]">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={isLoading || !script.trim()}
              className={`w-full h-[46px] flex items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all ${
                isLoading
                  ? 'bg-indigo-600/40 cursor-not-allowed text-zinc-400 font-medium'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98]'
              }`}
              id="generate-button"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">Processing...</span>
                  </div>
                </div>
              ) : (
                <>
                  <Sparkles size={14} className="fill-current" />
                  Generate Narrative Video
                </>
              )}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping shrink-0" />
            <span className="text-xs font-mono text-indigo-400 font-medium">{loadingStage}</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10.5px] text-zinc-400 leading-relaxed">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-indigo-400" />
          <span>
            <strong>System Security Verification:</strong> The visual text segmenter maps your narration to high-definition footage in real-time. This server uses standard clean models for safety.
          </span>
        </div>
      </form>
    </div>
  );
}
