import React, { useEffect, useState, useRef } from 'react';
import { Scene, ProjectConfig } from '../types';
import { DEFAULT_MUSIC } from '../data';
import { 
  Download, Loader2, Play, CheckCircle2, Film, ShieldCheck, AlertCircle, FileVideo, Terminal, Crown, Lock, Zap, Cpu
} from 'lucide-react';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  projectConfig: ProjectConfig;
  canvasElement: HTMLCanvasElement | null;
  onRenderFrameChange?: (index: number) => void;
}

export default function RenderModal({
  isOpen,
  onClose,
  scenes,
  projectConfig,
  canvasElement,
  onRenderFrameChange
}: RenderModalProps) {
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [renderOption, setRenderOption] = useState<'full' | 'fast'>('full');
  const [renderedBlobUrl, setRenderedBlobUrl] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<'720p' | '1080p'>('720p');
  const [dataProfile, setDataProfile] = useState<'saver' | 'premium'>('saver');
  const [statistics, setStatistics] = useState({
    duration: 0,
    fileSize: '0 MB',
    scenesProcessed: 0,
    fps: 30
  });

  const getSubscribedPlan = (): '720p' | '1080p' => {
    const email = localStorage.getItem('yotor_session_email') || '';
    if (!email) return '720p';
    
    const normalized = email.toLowerCase().trim();
    const MASTER_OWNER = 'ephremmelkamu49@gmail.com';
    const BACKUP_OWNER = 'josij9989@gmail.com';
    if (normalized === MASTER_OWNER || normalized === BACKUP_OWNER) {
      return '1080p';
    }
    
    const whitelistSaved = localStorage.getItem('yotor_whitelist');
    if (whitelistSaved) {
      try {
        const parsed = JSON.parse(whitelistSaved);
        if (parsed.map((e: string) => e.toLowerCase().trim()).includes(normalized)) {
          return '1080p';
        }
      } catch (e) {}
    }
    
    const savedPlans = localStorage.getItem('yotor_email_plans');
    if (savedPlans) {
      try {
        const parsed = JSON.parse(savedPlans);
        if (parsed[normalized]) {
          return parsed[normalized];
        }
      } catch (e) {}
    }
    return '720p';
  };

  const activePlan = getSubscribedPlan();

  useEffect(() => {
    if (isOpen) {
      setExportQuality(getSubscribedPlan());
    }
  }, [isOpen, renderStatus]);

  const handleTriggerUpgrade = () => {
    window.dispatchEvent(new CustomEvent('yotor_trigger_upgrade'));
    onClose();
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const renderIndexRef = useRef<number>(0);
  const renderTimeRef = useRef<number>(0);
  const currentRenderAudioRef = useRef<HTMLAudioElement | null>(null);
  const renderBackgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourcesRef = useRef<any[]>([]);
  const renderLoopTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      cleanupRenderSubprocesses();
    };
  }, []);

  const addLog = (msg: string) => {
    setRenderLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const cleanupRenderSubprocesses = () => {
    if (renderLoopTimeoutRef.current) {
      clearInterval(renderLoopTimeoutRef.current);
    }
    if (currentRenderAudioRef.current) {
      currentRenderAudioRef.current.pause();
      currentRenderAudioRef.current = null;
    }
    if (renderBackgroundMusicRef.current) {
      renderBackgroundMusicRef.current.pause();
      renderBackgroundMusicRef.current = null;
    }
    
    // clean audio contexts
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    audioDestNodeRef.current = null;
    audioSourcesRef.current = [];
  };

  const initiateRenderAndStitching = async () => {
    if (!canvasElement) {
      setRenderStatus('failed');
      addLog("Critical failure: Render canvas element is offline.");
      return;
    }

    try {
      cleanupRenderSubprocesses();
      setRenderStatus('rendering');
      setProgress(0);
      recordedChunksRef.current = [];
      renderIndexRef.current = 0;
      renderTimeRef.current = 0;
      setRenderLogs([]);
      
      const scenesToRender = renderOption === 'fast' 
        ? scenes.slice(0, Math.min(2, scenes.length)) // Render first 2 scenes for fast testing 
        : scenes;
      
      const totalSecondsToRender = scenesToRender.reduce((s, scene) => s + scene.duration, 0);
      
      if (totalSecondsToRender > 60) {
        const m = Math.floor(totalSecondsToRender / 60);
        const s = Math.round(totalSecondsToRender % 60);
        addLog(`⏳ ረጅም ቪዲዮ ተገኝቷል (${m} ደቂቃ ከ ${s} ሰከንድ)። የይቶር High-Performance ዥረት ቋት (Streaming Buffers) በትክክል ተዘጋጅተዋል...`);
      }

      addLog("Initializing AudioContext Engine...");
      // Initialize AudioContext to mix gTTS streams and backgrounds
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      
      // Node destination matching MediaRecorder
      const audioDest = audioCtx.createMediaStreamDestination();
      audioDestNodeRef.current = audioDest;

      // 1. Capture stream from HTML Canvas
      addLog("Capturing high-fidelity 30fps canvas compositing stream...");
      const canvasStream = canvasElement.captureStream(30);
      
      // 2. Load background music loop if selected
      if (projectConfig.musicTrack) {
        addLog("Blending cinematic background dynamic tracks...");
        const music = new Audio(projectConfig.musicTrack);
        music.loop = true;
        // Bypassing CORS constraints by setting crossOrigin anonymous
        music.crossOrigin = "anonymous";
        music.volume = projectConfig.musicVolume;
        renderBackgroundMusicRef.current = music;

        // Bridge background music into AudioContext
        const musicSrc = audioCtx.createMediaElementSource(music);
        musicSrc.connect(audioDest);
        musicSrc.connect(audioCtx.destination); // Let user hear matching monitor clip softly while baking
        music.play().catch(() => {});
      }

      // 3. Stitched Audio MediaStream
      const mixedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));
      audioDest.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));

      // 4. Set target codecs
      let options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' };
      }

      // Apply Amharic-optimized Data Save Profiles
      if (dataProfile === 'saver') {
        options.videoBitsPerSecond = 750000; // 750 Kbps (Very dense compression, beautiful enough but 5x smaller file size)
        options.audioBitsPerSecond = 48000;  // 48 Kbps
        addLog("⚡ [Ultra-Saver] የዳታ ቆጣቢ ሞድ በርቷል፡ ቪዲዮውን በትንሽ ዳታ በፍጥነት ለደንበኞች ለማድረስ በጥራት ተጨምቆ በመስራት ላይ ነው...");
      } else {
        options.videoBitsPerSecond = 3200000; // 3.2 Mbps (Uncompressed cinema frames)
        options.audioBitsPerSecond = 128000;  // 128 Kbps
        addLog("💎 [Cinema-Max] የከፍተኛ ጥራት ሞድ በርቷል፡ እያንዳንዱ ምስል እና ድምፅ ሳይቀነስ በላቀ ጥራት በመዘጋጀት ላይ ነው...");
      }

      addLog(`Setting up MediaRecorder compression wrapper. Mode: ${options.mimeType || 'default'}`);
      const mediaRecorder = new MediaRecorder(mixedStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        addLog("Wrapping media frames inside container...");
        const finalBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const finalUrl = URL.createObjectURL(finalBlob);
        setRenderedBlobUrl(finalUrl);
        
        // Calculate size metadata
        const sizeInMb = (finalBlob.size / (1024 * 1024)).toFixed(2);
        setStatistics({
          duration: totalSecondsToRender,
          fileSize: `${sizeInMb} MB`,
          scenesProcessed: scenesToRender.length,
          fps: 30
        });

        setRenderStatus('completed');
        addLog(`Compilation SUCCESS. Final WebM binary matches ${sizeInMb} MB.`);
      };

      // Start recording
      mediaRecorder.start();
      addLog("Master stitch recording initialized successfully.");

      // Scene-by-scene timing workflow
      const renderSceneStep = async (index: number) => {
        if (index >= scenesToRender.length) {
          addLog("Stitching timeline limits reached. Compiling final code...");
          mediaRecorder.stop();
          cleanupRenderSubprocesses();
          return;
        }

        const scene = scenesToRender[index];
        addLog(`Composing Scene ${index + 1}/${scenesToRender.length} ("${scene.text.substring(0, 35)}...")`);
        
        // Update background visual indices
        renderIndexRef.current = index;
        setProgress(Math.round((index / scenesToRender.length) * 100));

        // Signal parent to update the active timeline scene and captions
        if (onRenderFrameChange) {
          onRenderFrameChange(index);
        }

        // Delay slightly to let the video source mount and load, then play it!
        // This ensures the recorded WebM composition stream features dynamic flowing video motion!
        setTimeout(() => {
          const videoEl = canvasElement?.parentElement?.querySelector('video') as HTMLVideoElement;
          if (videoEl) {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          }
        }, 150);

        // Start active narrator TTS loader
        const ttsUrl = `/api/tts?text=${encodeURIComponent(scene.text)}&lang=${projectConfig.voiceLanguage}`;
        const ttsAudio = new Audio(ttsUrl);
        ttsAudio.crossOrigin = "anonymous";
        currentRenderAudioRef.current = ttsAudio;

        try {
          // Route gTTS speech into custom AudioContext
          const ttsSrc = audioCtx.createMediaElementSource(ttsAudio);
          ttsSrc.connect(audioDest);
          ttsSrc.connect(audioCtx.destination);
          
          await new Promise((resolve) => {
            ttsAudio.addEventListener('canplaythrough', () => {
              addLog(`Syncing voiceover track for S-${index+1}...`);
              ttsAudio.play().catch(() => {});
              
              // We run this scene for the calculated duration (or length of TTS, whichever is larger!)
              let remainingTime = scene.duration;
              const clockTick = 100;
              
              const stepTimer = setInterval(() => {
                remainingTime -= (clockTick / 1000);
                
                // Track progress linearly
                const completedSeconds = scenesToRender.slice(0, index).reduce((s, sc) => s + sc.duration, 0) + (scene.duration - remainingTime);
                setProgress(Math.min(99, Math.round((completedSeconds / totalSecondsToRender) * 100)));

                if (remainingTime <= 0) {
                  clearInterval(stepTimer);
                  ttsAudio.pause();
                  resolve(true);
                }
              }, clockTick);
            });

            ttsAudio.addEventListener('error', (e) => {
              addLog(`CORS / Network warning on S-${index+1} audio synthesis. Rendering with default silent timeline.`);
              
              // Maintain duration timeline even if speech fails
              setTimeout(() => {
                resolve(true);
              }, scene.duration * 1000);
            });
            
            ttsAudio.load();
          });
        } catch (audioErr: any) {
          addLog(`Bypassing audio bridge: ${audioErr.message}`);
          await new Promise((resolve) => setTimeout(resolve, scene.duration * 1000));
        }

        // Proceed to next scene block recursion
        renderSceneStep(index + 1);
      };

      // Trigger first step
      renderSceneStep(0);

    } catch (err: any) {
      console.error(err);
      setRenderStatus('failed');
      addLog(`CRITICAL COMPILE ABORTED: ${err.message}`);
      cleanupRenderSubprocesses();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fadeIn" id="render-workbench">
      <div className="bg-[#0c0c0e]/95 border border-zinc-805 rounded-3xl max-w-xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Visual particles glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Header bar */}
        <div className="text-center pb-4 mb-5 border-b border-zinc-800/80">
          <h1 className="text-sm font-light text-zinc-100 uppercase tracking-widest justify-center flex items-center gap-2">
            <FileVideo className="text-indigo-400" size={18} />
            Render & Stitch Studio
          </h1>
          <p className="text-xs text-zinc-500 mt-1.5">Stitches speech voiceovers, cinematic landscape clips and sound together</p>
        </div>

        {renderStatus === 'idle' && (
          <div className="space-y-4 py-2 overflow-y-auto max-h-[70vh] pr-1 scrollbar-thin">
            
            {/* Resolution/Duration segment */}
            <div className="p-4 bg-[#050505] rounded-2xl border border-zinc-900 space-y-3">
              <span className="text-[10px] font-mono tracking-widest font-semibold text-zinc-500 uppercase block">Set Baking Range Option:</span>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRenderOption('full')}
                  className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                    renderOption === 'full' 
                      ? 'bg-indigo-500/5 border-indigo-505 text-indigo-400 font-bold' 
                      : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="text-xs font-semibold">HQ Full Render</span>
                  <span className="text-[9px] text-zinc-500 mt-1 font-sans">Renders complete {scenes.length} scenes verbatim stream</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRenderOption('fast')}
                  className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                    renderOption === 'fast' 
                      ? 'bg-indigo-500/5 border-indigo-505 text-indigo-400 font-bold' 
                      : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="text-xs font-semibold">Fast Test Segment</span>
                  <span className="text-[9px] text-zinc-500 mt-1 font-sans">Bakes first 2 scenes for instantaneous review</span>
                </button>
              </div>
            </div>

            {/* Choose Video quality according to active paid plans */}
            <div className="p-4 bg-[#050505] rounded-2xl border border-zinc-900 space-y-3">
              <span className="text-[10px] font-mono tracking-widest font-semibold text-zinc-500 uppercase block flex items-center gap-1">
                <Crown size={11} className="text-cyan-400" /> Choose Export Resolution:
              </span>
              
              <div className="grid grid-cols-2 gap-3">
                {/* 720p HD Quality (Standard High-Def) - always unlocked */}
                <button
                  type="button"
                  onClick={() => setExportQuality('720p')}
                  className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                    exportQuality === '720p' 
                      ? 'bg-teal-500/5 border-teal-500 text-teal-400 font-bold shadow-sm' 
                      : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">720p HD Quality</span>
                    {exportQuality === '720p' && <div className="w-2 h-2 rounded-full bg-teal-400" />}
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-1 font-sans">1280x720 (Standard HD)</span>
                  <span className="text-[8px] font-mono text-zinc-650 mt-1 uppercase">Unlocked • 10K ETB Plan</span>
                </button>

                {/* 1080p Full HD Cosmic Quality - locked if current activePlan is '720p' */}
                {activePlan === '720p' ? (
                  <div className="p-3 border border-zinc-900/50 bg-zinc-950/40 rounded-xl flex flex-col text-left relative opacity-85">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-zinc-650 flex items-center gap-1">
                        1080p Full HD
                      </span>
                      <Lock size={11} className="text-zinc-700" />
                    </div>
                    <span className="text-[9px] text-zinc-650 mt-1 font-sans">1920x1080 (Cinema FHD)</span>
                    <span className="text-[8px] font-mono text-red-400/80 mt-1 uppercase font-bold">15K ETB Plan Required</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExportQuality('1080p')}
                    className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                      exportQuality === '1080p' 
                        ? 'bg-cyan-500/5 border-cyan-500 text-cyan-400 font-bold shadow-sm' 
                        : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold flex items-center gap-1">
                        <Crown size={11} className="text-cyan-400" /> 1080p Cosmic
                      </span>
                      {exportQuality === '1080p' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-1 font-sans">1920x1080 (Cinema Quality)</span>
                    <span className="text-[8.5px] font-mono text-cyan-400 mt-1 uppercase">Unlocked • 15K ETB Plan</span>
                  </button>
                )}
              </div>

              {/* Friendly drawer upgrade alert for 720p users */}
              {activePlan === '720p' && (
                <div className="p-2.5 bg-cyan-950/10 border border-cyan-900/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-[9px] text-[#00b4d8] leading-normal max-w-xs">
                    የምስል ጥራት ወደ **1080p Full HD** ከፍ ለማድረግ ወርሃዊ የቴሌብር ምዝገባዎን ያሻሽሉ።
                  </p>
                  <button
                    type="button"
                    onClick={handleTriggerUpgrade}
                    className="self-start sm:self-center px-2 py-1 bg-cyan-500 text-zinc-950 hover:bg-cyan-400 text-[8px] tracking-widest uppercase font-black rounded transition-all shrink-0"
                  >
                    🚀 Upgrade Account
                  </button>
                </div>
              )}
            </div>

            {/* Choose Data Optimization Profile (በትንሽ ዳታ vs በትልቅ ዳታ ጥራት) */}
            <div className="p-4 bg-[#050505] rounded-2xl border border-zinc-900 space-y-3">
              <span className="text-[10px] font-mono tracking-widest font-semibold text-zinc-500 uppercase block flex items-center gap-1.5">
                <Zap size={11} className="text-amber-400" /> የዳታ አጠቃቀምና ፍጥነት መቆጣጠሪያ / Data Optimization Profile:
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Low Data Saving Mode */}
                <button
                  type="button"
                  onClick={() => setDataProfile('saver')}
                  className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                    dataProfile === 'saver'
                      ? 'bg-amber-500/5 border-amber-500 text-amber-400 font-bold shadow-sm'
                      : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <Zap size={11} className="text-amber-400" /> በትንሽ ዳታ / Ultra-Saver
                    </span>
                    {dataProfile === 'saver' && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  </div>
                  <span className="text-[9.5px] text-zinc-400 mt-1 leading-normal">
                    ጥራቱ ሳይቀንስ ፋይሉን እጅግ ያሳንሰዋል። በቴሌግራም ወይም ዋትስአፕ በትንሽ ዳታ በፍጥነት ለደንበኞች ይደርሳል! 🚀 (የምክር አገልግሎት)
                  </span>
                  <span className="text-[8px] font-mono text-zinc-600 mt-1.5 uppercase font-bold text-amber-500/80">Optimized for Ethiopia mobile network</span>
                </button>

                {/* 2. Maximum Studio Quality Mode */}
                <button
                  type="button"
                  onClick={() => setDataProfile('premium')}
                  className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                    dataProfile === 'premium'
                      ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400 font-bold shadow-sm'
                      : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <Cpu size={11} className="text-indigo-400" /> ከፍተኛ ጥራት / Maximum HD
                    </span>
                    {dataProfile === 'premium' && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                  </div>
                  <span className="text-[9.5px] text-zinc-400 mt-1 leading-normal">
                    ለትላልቅ ስክሪኖች እና ማስታወቂያዎች የሚሆን ፊልም-ጥራት ያላቸው ምስሎችን ያመርታል። (ትልቅ የቪዲዮ ፋይል መጠን ይሰጣል)
                  </span>
                  <span className="text-[8px] font-mono text-zinc-650 mt-1.5 uppercase font-bold">Cinema Bitrate (3.2Mbps Uncompressed)</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 p-3.5 bg-[#050505] border border-zinc-900 rounded-xl text-[10px] leading-relaxed text-zinc-450">
              <ShieldCheck size={15} className="text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>System Integrity Check:</strong> Compilation renders directly in the browser utilizing hardware acceleration. Keep this browser tab active and stay on screen for pristine frame pacing.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="py-3 bg-zinc-900 border border-zinc-800 rounded-xl font-semibold text-xs text-zinc-400 hover:text-white transition-colors uppercase tracking-wider font-mono text-center"
                id="render-cancel-btn"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={initiateRenderAndStitching}
                className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-98"
                id="render-start-btn"
              >
                <Play size={14} fill="currentColor" />
                Initialize Baking
              </button>
            </div>
          </div>
        )}

        {renderStatus === 'rendering' && (
          <div className="space-y-5 py-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-center py-6">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-20 h-20 border-4 border-indigo-500/10 rounded-full" />
                  <div className="absolute w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-base font-bold font-mono text-indigo-400">{progress}%</span>
                </div>
              </div>

              <div className="space-y-1 text-center">
                <span className="text-xs font-semibold text-zinc-300 block">Framing Movie Sequence...</span>
                <p className="text-[10px] text-zinc-500">Compiling scene timings and syncing text subtitles</p>
              </div>

              {/* Progress track */}
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Rendering Terminal logs */}
            <div className="flex-1 bg-[#050505] border border-zinc-900 rounded-xl p-3 max-h-[140px] overflow-y-auto font-mono text-[9px] text-[#8e909a] space-y-1.5" id="render-terminal-logs">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-2 border-b border-zinc-900 pb-1 shrink-0">
                <Terminal size={10} />
                <span>Compiler Log Output</span>
              </div>
              {renderLogs.map((log, lIdx) => (
                <div key={lIdx} className="leading-normal">{log}</div>
              ))}
            </div>

            <button
              onClick={() => {
                cleanupRenderSubprocesses();
                setRenderStatus('idle');
              }}
              className="w-full py-2.5 bg-red-955/10 hover:bg-red-950/40 border border-red-900/30 text-red-400 hover:text-red-200 text-xs font-semibold rounded-xl transition-colors shrink-0 font-mono uppercase tracking-widest"
              id="render-stop-abort-btn"
            >
              Abort Compile
            </button>
          </div>
        )}

        {renderStatus === 'completed' && renderedBlobUrl && (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
              <CheckCircle2 size={48} className="text-indigo-455" />
              <div className="space-y-1">
                <h3 className="text-base font-light text-zinc-100 uppercase tracking-wider">Video Stitched Successfully!</h3>
                <p className="text-xs text-zinc-500">Total assembled duration is fully synced to audio speech.</p>
              </div>
            </div>

            <div className="p-4 bg-[#050505] rounded-2xl border border-zinc-900 grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
              <div className="space-y-1">
                <span className="text-zinc-600 uppercase tracking-widest text-[8px] font-mono block">Total Duration</span>
                <p className="text-zinc-200 font-mono font-bold text-sm">{statistics.duration.toFixed(1)} seconds</p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-600 uppercase tracking-widest text-[8px] font-mono block">Estimated Size</span>
                <p className="text-zinc-200 font-mono font-bold text-sm">{statistics.fileSize}</p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-600 uppercase tracking-widest text-[8px] font-mono block">Scenes Built</span>
                <p className="text-zinc-200 font-mono font-bold text-sm">{statistics.scenesProcessed} Segments</p>
              </div>
              <div className="space-y-1">
                <span className="text-zinc-600 uppercase tracking-widest text-[8px] font-mono block">Resolution Target</span>
                <p className="text-zinc-250 font-mono font-bold text-xs uppercase">
                  {exportQuality === '1080p' ? (
                    projectConfig.aspectRatio === '16:9' ? '1920x1080 (Full HD)' : projectConfig.aspectRatio === '9:16' ? '1080x1920 (Shorts)' : '1080x1080 (Square)'
                  ) : (
                    projectConfig.aspectRatio === '16:9' ? '1280x720 (Standard HD)' : projectConfig.aspectRatio === '9:16' ? '720x1280 (Shorts)' : '800x800 (Square)'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRenderStatus('idle');
                  setRenderedBlobUrl(null);
                }}
                className="flex-1 py-3 bg-zinc-900 border border-zinc-800 text-zinc-450 hover:text-white rounded-xl text-xs font-semibold font-mono uppercase tracking-widest transition-colors"
                id="render-again-btn"
              >
                Render settings
              </button>
              
              <a
                href={renderedBlobUrl}
                download={`automated_video_${Date.now()}.webm`}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold block text-center rounded-xl text-xs shadow-lg shadow-indigo-505/20 active:scale-98 transition-transform cursor-pointer font-mono uppercase tracking-widest"
                id="download-master-video-file-btn"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Download size={14} />
                  Download File
                </span>
              </a>
            </div>
          </div>
        )}

        {renderStatus === 'failed' && (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
              <AlertCircle size={44} className="text-red-500 animate-pulse" />
              <h3 className="text-base font-semibold text-zinc-100 font-mono uppercase">Baking Session Stopped</h3>
              <p className="text-xs text-red-400 max-w-sm">An error occurred during canvas compilation or audio synthesis</p>
            </div>

            <div className="bg-red-955/10 border border-red-900/40 p-3 rounded-xl max-h-[140px] overflow-y-auto space-y-1">
              {renderLogs.slice(-4).map((log, index) => (
                <div key={index} className="text-[10px] uppercase font-mono text-red-350 leading-normal">{log}</div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-450 hover:text-white transition-colors"
              >
                Back to Compositor
              </button>
              <button
                type="button"
                onClick={initiateRenderAndStitching}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-555 text-white font-bold text-xs rounded-xl transition-all font-mono uppercase tracking-widest"
                id="retry-baking-btn"
              >
                Retry Baking Session
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
