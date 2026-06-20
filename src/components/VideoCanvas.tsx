import React, { useEffect, useRef, useState } from 'react';
import { Scene, AspectRatio, ProjectConfig } from '../types';
import { DEFAULT_MUSIC, GOOGLE_TTS_LANGUAGES } from '../data';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, Maximize, RefreshCw, Layers, Check, Sparkles, Eye, EyeOff
} from 'lucide-react';

interface VideoCanvasProps {
  scenes: Scene[];
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  projectConfig: ProjectConfig;
  onUpdateConfig: (updated: Partial<ProjectConfig>) => void;
  playbackIndex: number;
  setPlaybackIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function VideoCanvas({
  scenes,
  activeSceneId,
  onSelectScene,
  projectConfig,
  onUpdateConfig,
  playbackIndex,
  setPlaybackIndex,
  isPlaying,
  setIsPlaying,
  canvasRef
}: VideoCanvasProps) {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioSrcRefs = useRef<{ [key: string]: string }>({});
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const progressTimerRef = useRef<any>(null);

  const [currentSceneTime, setCurrentSceneTime] = useState<number>(0);
  const currentSceneTimeRef = useRef<number>(0);
  const playbackIndexRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showConfigTabs, setShowConfigTabs] = useState<'ratio' | 'subtitle' | 'music' | 'motion' | 'voice'>('ratio');
  const [loadedTtsPercentage, setLoadedTtsPercentage] = useState<number>(0);

  // Active scene accessor
  const currentScene = scenes[playbackIndex] || null;

  // Initialize and keep background music sync
  useEffect(() => {
    if (!musicAudioRef.current) {
      musicAudioRef.current = new Audio();
    }
    const music = musicAudioRef.current;
    
    if (projectConfig.musicTrack) {
      music.src = projectConfig.musicTrack;
      music.loop = true;
      music.volume = isMuted ? 0 : projectConfig.musicVolume;
      if (isPlaying) {
        music.play().catch(err => console.warn("Audio autoplay blocked or waiting user trigger:", err));
      } else {
        music.pause();
      }
    } else {
      music.pause();
      music.src = '';
    }

    return () => {
      music.pause();
    };
  }, [projectConfig.musicTrack, isPlaying]);

  // Sync background music volume
  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = isMuted ? 0 : projectConfig.musicVolume;
    }
  }, [projectConfig.musicVolume, isMuted]);

  // Handle active scene change trigger (Source loader)
  useEffect(() => {
    if (!currentScene) return;

    // Stop current custom audio, load active scene TTS chunk
    stopAllTtsAudios();
    setCurrentSceneTime(0);

    if (isPlaying) {
      playActiveSceneTtsAndVideo();
    }
  }, [playbackIndex, currentScene?.id]);

  // Handle overall Play/Pause toggles
  useEffect(() => {
    if (isPlaying) {
      // Start Video
      const video = currentScene ? videoRefs.current[currentScene.id] : null;
      if (video) {
        video.play().catch(() => {});
      }
      playActiveSceneTtsAndVideo();
      startTimelineTimer();
    } else {
      // Pause Video
      (Object.values(videoRefs.current) as (HTMLVideoElement | null)[]).forEach(vid => {
        if (vid) vid.pause();
      });
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
      }
      stopAllTtsAudios();
      clearTimelineTimer();
    }

    return () => {
      clearTimelineTimer();
    };
  }, [isPlaying]);

  const stopAllTtsAudios = () => {
    (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach(aud => {
      aud.pause();
      aud.currentTime = 0;
    });
  };

  const playActiveSceneTtsAndVideo = () => {
    if (!currentScene) return;

    // Pause all other videos, play current
    (Object.entries(videoRefs.current) as [string, HTMLVideoElement | null][]).forEach(([id, vid]) => {
      if (!vid) return;
      if (id === currentScene.id) {
        vid.play().catch(() => {});
      } else {
        // Keep previous video playing slightly for transition
        const prevScene = playbackIndex > 0 ? scenes[playbackIndex - 1] : null;
        if (prevScene && id === prevScene.id) {
           setTimeout(() => { if (vid) vid.pause() }, 1000);
        } else {
           vid.pause();
        }
      }
    });

    // Dynamic Speaking proxy chunk loader
    const ttsUrl = `/api/tts?text=${encodeURIComponent(currentScene.text)}&lang=${projectConfig.voiceLanguage}`;
    
    let audio = audioRefs.current[currentScene.id];
    let cachedSrc = audioSrcRefs.current[currentScene.id];

    if (!audio || cachedSrc !== ttsUrl) {
      if (audio) {
        audio.pause();
      }
      audio = new Audio(ttsUrl);
      audioRefs.current[currentScene.id] = audio;
      audioSrcRefs.current[currentScene.id] = ttsUrl;
    }

    audio.volume = isMuted ? 0 : 1.0;
    
    // Play with fallback/guard
    audio.play()
      .catch((err) => {
        console.warn("TTS Audio play waiting for user action limit API:", err);
      });

    // Handle music play if active
    if (musicAudioRef.current && projectConfig.musicTrack) {
      musicAudioRef.current.volume = isMuted ? 0 : projectConfig.musicVolume;
      musicAudioRef.current.play().catch(() => {});
    }
  };

  // Timeline pacing ticking
  const startTimelineTimer = () => {
    clearTimelineTimer();
    
    const intervalTime = 100; // Tick every 100ms
    progressTimerRef.current = setInterval(() => {
      setCurrentSceneTime(prev => {
        const nextTime = prev + (intervalTime / 1000);
        
        let targetDuration = currentScene?.duration || 4;
        
        // Also safeguard with TTS audio real length if it is loaded & ready
        const currentAudio = currentScene ? audioRefs.current[currentScene.id] : null;
        if (currentAudio?.duration && !isNaN(currentAudio.duration)) {
          // Sync segment duration exactly to audio length (video equals voiceover)
          targetDuration = currentAudio.duration + 0.15; // Only a brief pad for perfect flow
        }

        if (nextTime >= targetDuration) {
          // Go to next scene or loop
          if (playbackIndex < scenes.length - 1) {
            setPlaybackIndex(p => {
              playbackIndexRef.current = p + 1;
              return p + 1;
            });
            currentSceneTimeRef.current = 0;
            return 0;
          } else {
            // Reached absolute script end
            setIsPlaying(false);
            setPlaybackIndex(0);
            playbackIndexRef.current = 0;
            currentSceneTimeRef.current = 0;
            return 0;
          }
        }
        currentSceneTimeRef.current = nextTime;
        return nextTime;
      });
    }, intervalTime);
  };

  const clearTimelineTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Canvas Frame Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Define standard composition dims
    let width = 1280;
    let height = 720; // 16:9 widescreen default

    if (projectConfig.aspectRatio === '9:16') {
      width = 720;
      height = 1280; // Shorts Vertical height
    } else if (projectConfig.aspectRatio === '1:1') {
      width = 800;
      height = 800; // Instagram Square
    }

    canvas.width = width;
    canvas.height = height;

    const render = () => {
      // Clear Canvas
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      const drawVideoFrame = (vid: HTMLVideoElement, alpha: number, scale: number = 1.0) => {
        if (!vid || vid.readyState < 2) return;
        ctx.globalAlpha = alpha;
        const vWidth = vid.videoWidth;
        const vHeight = vid.videoHeight;
        const vRatio = vWidth / vHeight;
        const cRatio = width / height;

        let sx = 0, sy = 0, sWidth = vWidth, sHeight = vHeight;

        if (vRatio > cRatio) {
          // Video is wider -> Crop sides
          sWidth = vHeight * cRatio;
          sx = (vWidth - sWidth) / 2;
        } else {
          // Video is taller -> Crop top/bottom
          sHeight = vWidth / cRatio;
          sy = (vHeight - sHeight) / 2;
        }

        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.scale(scale, scale);
        // apply blur for zoomBlur if scaling is intense
        if (scale > 1.05 || scale < 0.95) {
          ctx.filter = `blur(${Math.abs(1 - scale) * 20}px)`;
        }
        
        ctx.drawImage(vid, sx, sy, sWidth, sHeight, -width/2, -height/2, width, height);
        ctx.restore();
        
        ctx.globalAlpha = 1.0;
      };

      // 1. Draw Stock Video Frame with Cinematic Transitions
      const currentVideo = currentScene ? videoRefs.current[currentScene.id] : null;
      
      const tSource = projectConfig.transitionType || 'crossfade';
      const transitionDuration = projectConfig.transitionDuration || 0.5;
      const cTime = currentSceneTimeRef.current;
      const pIndex = playbackIndexRef.current;

      const isTransitioning = pIndex > 0 && cTime < transitionDuration && tSource !== 'none';

      if (isTransitioning) {
        const prevScene = scenes[pIndex - 1];
        const prevVideo = prevScene ? videoRefs.current[prevScene.id] : null;
        const progress = cTime / transitionDuration; // 0 to 1

        if (tSource === 'crossfade') {
          if (prevVideo) drawVideoFrame(prevVideo, 1.0); // Base frame
          if (currentVideo) drawVideoFrame(currentVideo, progress); // Fade in new frame
        } else if (tSource === 'zoomBlur') {
          // Prev video zooms IN and fades out
          if (prevVideo) {
            drawVideoFrame(prevVideo, 1.0 - progress, 1.0 + (progress * 0.4));
          }
          // Current video zooms IN from scaled down and fades in
          if (currentVideo) {
            drawVideoFrame(currentVideo, progress, 0.8 + (progress * 0.2));
          }
        }
      } else {
        if (currentVideo) drawVideoFrame(currentVideo, 1.0, 1.0);
      }

      // 2. Cinematic shadow vignette backdrop filter
      const grad = ctx.createRadialGradient(width/2, height/2, Math.min(width, height)*0.3, width/2, height/2, Math.max(width, height)*0.7);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 3. Draw Captions/Subtitles
      if (currentScene && projectConfig.subtitleStyle.enabled) {
        const text = projectConfig.subtitleStyle.uppercase 
          ? currentScene.caption.toUpperCase()
          : currentScene.caption;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Dynamic scaled font sizing relative to resolution
        const baseFontSize = projectConfig.subtitleStyle.fontSize;
        const scaleFactor = width / 1280;
        const finalFontSize = Math.max(16, Math.floor(baseFontSize * scaleFactor));
        
        ctx.font = `600 ${finalFontSize}px "${projectConfig.subtitleStyle.fontFamily}", system-ui, sans-serif`;

        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        const maxLineWidth = width * 0.85; // Margin line padding limits

        // Wrap words to fit canvas width neatly
        for (let n = 0; n < words.length; n++) {
          const testLine = currentLine + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxLineWidth && n > 0) {
            lines.push(currentLine.trim());
            currentLine = words[n] + ' ';
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine.trim());

        // Subtitle layout adjustments
        const lineHeight = finalFontSize * 1.35;
        const totalTextHeight = lines.length * lineHeight;
        
        let py = height * 0.82; // standard bottom
        if (projectConfig.subtitleStyle.position === 'middle') {
          py = height / 2;
        } else if (projectConfig.subtitleStyle.position === 'top') {
          py = height * 0.18;
        }

        // Adjust starting drawing Y position
        const startY = py - (totalTextHeight / 2) + (lineHeight / 2);

        // Draw background box or text styling
        lines.forEach((line, index) => {
          const ly = startY + (index * lineHeight);
          const textWidth = ctx.measureText(line).width;

          // Translucent padding capsule background box
          if (projectConfig.subtitleStyle.backgroundColor) {
            ctx.fillStyle = projectConfig.subtitleStyle.backgroundColor;
            const px = 18 * scaleFactor;
            const pyBox = 8 * scaleFactor;
            ctx.beginPath();
            ctx.roundRect(
              width/2 - textWidth/2 - px,
              ly - lineHeight/2 - pyBox + (finalFontSize * 0.08),
              textWidth + px*2,
              lineHeight + pyBox*2 - (finalFontSize * 0.16),
              10 * scaleFactor
            );
            ctx.fill();
          }

          // Subtle text shadow effect
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 8 * scaleFactor;
          ctx.shadowOffsetX = 2 * scaleFactor;
          ctx.shadowOffsetY = 2 * scaleFactor;

          // Draw the caption letters
          ctx.fillStyle = projectConfig.subtitleStyle.color;
          ctx.fillText(line, width / 2, ly);

          // Reset shadows
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });
      }

      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [projectConfig, currentScene]);

  const handleNext = () => {
    if (playbackIndex < scenes.length - 1) {
      setPlaybackIndex(p => {
        playbackIndexRef.current = p + 1;
        return p + 1;
      });
    } else {
      setPlaybackIndex(0);
      playbackIndexRef.current = 0;
    }
    setCurrentSceneTime(0);
    currentSceneTimeRef.current = 0;
  };

  const handlePrev = () => {
    if (playbackIndex > 0) {
      setPlaybackIndex(p => {
        playbackIndexRef.current = p - 1;
        return p - 1;
      });
    } else {
      setPlaybackIndex(scenes.length - 1);
      playbackIndexRef.current = scenes.length - 1;
    }
    setCurrentSceneTime(0);
    currentSceneTimeRef.current = 0;
  };

  // Pre-fetch all TTS files to monitor completion
  const handlePrecacheTts = async () => {
    setLoadedTtsPercentage(5);
    let cached = 0;
    try {
      for (const scene of scenes) {
        const ttsUrl = `/api/tts?text=${encodeURIComponent(scene.text)}&lang=${projectConfig.voiceLanguage}`;
        const audio = new Audio(ttsUrl);
        audioRefs.current[scene.id] = audio;
        audioSrcRefs.current[scene.id] = ttsUrl;
        
        await new Promise((resolve) => {
          audio.addEventListener('canplaythrough', () => {
            cached++;
            setLoadedTtsPercentage(Math.round((cached / scenes.length) * 100));
            resolve(true);
          }, { once: true });
          
          audio.addEventListener('error', () => {
            // resolve anyway to avoid blocking
            resolve(false);
          }, { once: true });
          
          audio.load();
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoadedTtsPercentage(0), 1000);
    }
  };

  // Ratio dynamic aspect bounds utility
  const getAspectClass = (ratio: AspectRatio) => {
    if (ratio === '9:16') return 'aspect-[9/16] max-h-[500px] w-auto mx-auto';
    if (ratio === '1:1') return 'aspect-square max-h-[450px] w-auto mx-auto';
    return 'aspect-video w-full';
  };

  return (
    <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 flex flex-col h-full justify-between" id="visual-studio">
      
      {/* Aspect Ratio and Configurations Head */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold bg-indigo-500/5 px-2.5 py-1 rounded-md border border-indigo-500/15">
              <Sparkles size={11} className="fill-current" />
              Live Compositor
            </span>
          </div>
          
          {/* Dynamic tabs */}
          <div className="flex items-center bg-zinc-950 p-1 border border-zinc-900 rounded-xl text-xs">
            <button
              onClick={() => setShowConfigTabs('ratio')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${showConfigTabs === 'ratio' ? 'bg-indigo-650 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Layout
            </button>
            <button
              onClick={() => setShowConfigTabs('subtitle')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${showConfigTabs === 'subtitle' ? 'bg-indigo-650 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Captions
            </button>
            <button
              onClick={() => setShowConfigTabs('music')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${showConfigTabs === 'music' ? 'bg-indigo-650 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Soundtrack
            </button>
            <button
              onClick={() => setShowConfigTabs('voice')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${showConfigTabs === 'voice' ? 'bg-indigo-650 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Voice
            </button>
            <button
              onClick={() => setShowConfigTabs('motion')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${showConfigTabs === 'motion' ? 'bg-indigo-650 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Motion
            </button>
          </div>
        </div>

        {/* Configurations Dynamic Sub Panels */}
        <div className="p-4 bg-[#050505] border border-zinc-900 rounded-xl text-xs min-h-[70px] flex items-center">
          {showConfigTabs === 'ratio' && (
            <div className="w-full grid grid-cols-3 gap-3">
              {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onUpdateConfig({ aspectRatio: ratio })}
                  className={`py-2 px-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${
                    projectConfig.aspectRatio === ratio
                      ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400 font-bold'
                      : 'border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs font-semibold">{ratio === '16:9' ? 'Landscape' : ratio === '9:16' ? 'Vertical Shorts' : 'Square'}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{ratio}</span>
                </button>
              ))}
            </div>
          )}

          {showConfigTabs === 'subtitle' && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-zinc-900">
                <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Visibility Toggle</span>
                <button
                  onClick={() => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, enabled: !projectConfig.subtitleStyle.enabled } })}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                    projectConfig.subtitleStyle.enabled 
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {projectConfig.subtitleStyle.enabled ? (
                    <><Eye size={10} /> CAPTIONS ON</>
                  ) : (
                    <><EyeOff size={10} /> CAPTIONS OFF</>
                  )}
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, position: 'bottom' } })}
                  className={`py-1.5 border rounded-lg ${projectConfig.subtitleStyle.position === 'bottom' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Bottom Box
                </button>
                <button
                  onClick={() => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, position: 'middle' } })}
                  className={`py-1.5 border rounded-lg ${projectConfig.subtitleStyle.position === 'middle' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Center Box
                </button>
                <button
                  onClick={() => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, position: 'top' } })}
                  className={`py-1.5 border rounded-lg ${projectConfig.subtitleStyle.position === 'top' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Top Header
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wider">Font:</span>
                  <select
                    value={projectConfig.subtitleStyle.fontFamily}
                    onChange={(e) => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, fontFamily: e.target.value as any } })}
                    className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-zinc-300"
                  >
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Inter">Inter</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-zinc-500 font-mono uppercase text-[9px] tracking-wider">
                    <input
                      type="checkbox"
                      checked={projectConfig.subtitleStyle.uppercase}
                      onChange={(e) => onUpdateConfig({ subtitleStyle: { ...projectConfig.subtitleStyle, uppercase: e.target.checked } })}
                      className="rounded border-zinc-800 text-indigo-600 focus:ring-indigo-550"
                    />
                    ALL CAPS
                  </label>
                  
                  {loadedTtsPercentage > 0 ? (
                    <span className="text-[10px] text-indigo-400 font-mono">Caching: {loadedTtsPercentage}%</span>
                  ) : (
                    <button
                      onClick={handlePrecacheTts}
                      className="text-[10.5px] text-indigo-400 underline hover:text-indigo-300 font-mono uppercase"
                      title="Load and cache speech mp3s in client local memory"
                    >
                      Preload Voice Over
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showConfigTabs === 'music' && (
            <div className="w-full space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEFAULT_MUSIC.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => onUpdateConfig({ musicTrack: track.url })}
                    className={`p-1.5 border rounded-lg text-left truncate flex flex-col justify-center ${
                      projectConfig.musicTrack === track.url
                        ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400 font-bold'
                        : 'border-[#0c0c0e] text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className="font-semibold block truncate leading-tight">{track.title.split(' (')[0]}</span>
                    <span className="text-[9px] text-zinc-650 block truncate">{track.vibe}</span>
                  </button>
                ))}
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                  <Volume2 size={13} className="text-zinc-500" />
                  <input
                    type="range"
                    min="0"
                    max="0.5" // limit ambient max so narration is pristine
                    step="0.01"
                    value={projectConfig.musicVolume}
                    onChange={(e) => onUpdateConfig({ musicVolume: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">{Math.round(projectConfig.musicVolume * 200)}%</span>
                </div>
              </div>
            </div>
          )}

          {showConfigTabs === 'voice' && (
            <div className="w-full grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {GOOGLE_TTS_LANGUAGES.map((langOpts) => (
                <div key={langOpts.code} className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => onUpdateConfig({ voiceLanguage: langOpts.code })}
                    className={`flex-1 p-2 border rounded-xl text-left transition-all flex flex-col justify-center ${
                      projectConfig.voiceLanguage === langOpts.code
                        ? 'bg-indigo-500/5 border-indigo-500 text-indigo-400 font-bold'
                        : 'border-[#0c0c0e] hover:border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className="text-[11px] font-semibold block leading-tight">{langOpts.name.split(' - ')[0]}</span>
                    <span className="text-[9px] text-zinc-650 block mt-0.5">{langOpts.name.split(' - ')[1] || 'Standard'}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ttsUrl = `/api/tts?text=${encodeURIComponent("ሰላም፣ ይህ የድምፅ ናሙና ነው። የዮቶር አርቴፊሻል ኢንተለጀንስ ነው።")}&lang=${langOpts.code}`;
                      new Audio(ttsUrl).play();
                    }}
                    title="Play Preview"
                    className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    <Volume2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showConfigTabs === 'motion' && (
            <div className="w-full space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => onUpdateConfig({ transitionType: 'none' })}
                  className={`py-1.5 border rounded-lg ${projectConfig.transitionType === 'none' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Hard Cut
                </button>
                <button
                  onClick={() => onUpdateConfig({ transitionType: 'crossfade' })}
                  className={`py-1.5 border rounded-lg ${projectConfig.transitionType === 'crossfade' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Smooth Crossfade
                </button>
                <button
                  onClick={() => onUpdateConfig({ transitionType: 'zoomBlur' })}
                  className={`py-1.5 border rounded-lg ${projectConfig.transitionType === 'zoomBlur' ? 'bg-zinc-900 border-indigo-500 text-indigo-400 font-bold' : 'border-zinc-900 text-zinc-500'}`}
                >
                  Zoom Blur
                </button>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500 font-mono text-[10px]">Duration (s)</span>
                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.1"
                  value={projectConfig.transitionDuration}
                  onChange={(e) => onUpdateConfig({ transitionDuration: parseFloat(e.target.value) })}
                  className="w-48 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[10px] font-mono text-indigo-400">{projectConfig.transitionDuration}s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actual Composition Monitor Layout */}
      <div className="relative flex-1 flex items-center justify-center p-3 bg-[#050505] rounded-3xl border border-zinc-900 overflow-hidden my-4">
        {/* Transparent grid backing */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* The canvas target */}
        <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-zinc-900 max-w-full">
          <canvas
            ref={canvasRef}
            className={`${getAspectClass(projectConfig.aspectRatio)} rounded-2xl shadow-2xl shadow-black/80`}
            id="rendering-canvas"
          />
        </div>

        {/* Hidden active videos for crossfade rendering */}
        {scenes.map(s => (
          <video
            key={s.id}
            ref={el => { videoRefs.current[s.id] = el; }}
            src={s.videoUrl}
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            className="absolute pointer-events-none opacity-0 w-1 h-1"
            preload="auto"
          />
        ))}
      </div>

      {/* Mechanical Playback Control Deck */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-3.5">
        
        {/* Cumulative Timeline Scroll */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Scene {playbackIndex + 1} of {scenes.length}</span>
            <span className="text-indigo-400 font-bold font-mono">{currentSceneTime.toFixed(1)}s / {currentScene?.duration || 4}s</span>
          </div>

          <div 
            className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden cursor-pointer border border-zinc-850"
            onClick={(e) => {
              // Click to skip scenes instantly
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              const sceneTargetIdx = Math.floor(percent * scenes.length);
              if (sceneTargetIdx >= 0 && sceneTargetIdx < scenes.length) {
                setPlaybackIndex(sceneTargetIdx);
                setCurrentSceneTime(0);
              }
            }}
          >
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-100"
              style={{ 
                width: `${((playbackIndex + (currentSceneTime / (currentScene?.duration || 4))) / scenes.length) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Action button deck */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              type="button"
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
              title="Prev Scene"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => {
                if (!isPlaying) {
                  playActiveSceneTtsAndVideo();
                }
                setIsPlaying(!isPlaying);
              }}
              type="button"
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transform transition-all active:scale-95 shadow-md shadow-indigo-505/20"
              id="compositor-play-btn"
            >
              {isPlaying ? <Pause size={18} className="fill-current text-white" /> : <Play size={18} className="fill-current text-white" />}
            </button>
            <button
              onClick={handleNext}
              type="button"
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
              title="Next Scene"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 max-w-[200px] truncate text-right">
            <span className="block font-semibold text-zinc-300 truncate">S-{playbackIndex+1}: {currentScene?.keywords.split(' ')[0]} clip</span>
            <span className="block text-[10px] text-zinc-550 italic shrink-0 leading-none truncate">gTTS Accent: {GOOGLE_TTS_LANGUAGES.find(l => l.code === projectConfig.voiceLanguage)?.name.split(' - ')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
