import React, { useState, useEffect, useRef } from 'react';
import { Scene, ProjectConfig, AspectRatio } from './types';
import { DEFAULT_CATALOG, DEFAULT_MUSIC } from './data';
import ScriptInput from './components/ScriptInput';
import Timeline from './components/Timeline';
import VideoCanvas from './components/VideoCanvas';
import RenderModal from './components/RenderModal';
import AccessGate from './components/AccessGate';
import { 
  Sparkles, Download, Video, Palette, Library, Info, HelpCircle,
  Terminal, Send, X, Bot, Sliders, Eye, EyeOff, MessageSquare, Volume2, Zap, SlidersHorizontal, Command
} from 'lucide-react';

export default function App() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('Analyzing narration text...');
  const [pexelsKey, setPexelsKey] = useState<string>(() => {
    return localStorage.getItem('pexels_api_key') || '';
  });
  const [isRenderOpen, setIsRenderOpen] = useState<boolean>(false);
  
  // Shared Playback state for real-time play elements
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const activeSceneId = scenes[playbackIndex]?.id || null;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Ref inside parent to access the compiled canvas directly from RenderModal
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
    aspectRatio: '16:9',
    musicTrack: DEFAULT_MUSIC[1].url, // Meditative pad default
    musicVolume: 0.12,
    voiceLanguage: 'en-gb',
    subtitleStyle: {
      fontSize: 32,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      position: 'bottom',
      fontFamily: 'Space Grotesk',
      uppercase: true
    }
  });

  // --- YOTOR OWNER EXCLUSIVE AI STUDIO COPILOT PORTAL ---
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [copilotLogs, setCopilotLogs] = useState<{ id: string; type: 'system' | 'user' | 'assistant'; text: string }[]>([
    {
      id: 'init',
      type: 'assistant',
      text: 'ሰላም ባለቤት ሆይ! 👑\nእኔ የእርስዎ የግል "ይቶር AI ስቱዲዮ ረዳት" (Yotor AI Copilot) ነኝ። በጽሁፍ ብቻ ትዕይንቶችን ማስተካከል፣ መደመር ወይም የግርጌ ጽሁፎችን መለወጥ ይችላሉ።\n\n📌 የሚሞክሩት ምሳሌዎች፡\n• "የግርጌ ጽሑፍ መጠን ወደ 40 ቀይርልኝ"\n• "የግርጌ ጽሑፍ ቀለም ቢጫ አድርግ"\n• "የጀርባ ሙዚቃ ድምፅ 30% አድርግ"\n• "የቪዲዮውን አቀማመጥ 9:16 አድርገው"\n• "የሁሉንም ቪዲዮዎች ርዝማኔ 6 ሰከንድ አድርግ"\n\n📢 **ልዩ የፕሮሞሽን አገልግሎት (Owner-Only Promotion Generator)***\n• "ማስታወቂያ ስጠኝ" ወይም "ስለ app promotion ንገረኝ" ብለው ከጠየቁኝ ለደንበኞች የሚጋሩ ማራኪ የቴሌግራም እና የቲክቶክ ጽሑፎችን እዚሁ አዘጋጅቼ እሰጥዎታለሁ።'
    }
  ]);

  useEffect(() => {
    const checkAdminStatus = () => {
      const email = (localStorage.getItem('yotor_session_email') || '').toLowerCase().trim();
      if (email === 'ephremmelkamu49@gmail.com' || email === 'josij9989@gmail.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
    // Periodically verify session variables in case they log in/out
    const intv = setInterval(checkAdminStatus, 2000);
    return () => clearInterval(intv);
  }, []);

  const handleRunCopilotCommand = (cmdText: string) => {
    if (!cmdText.trim()) return;
    const cleanCmd = cmdText.trim();
    
    // Add user message
    const userMsgId = `usr_${Date.now()}`;
    const updatedLogs = [
      ...copilotLogs,
      { id: userMsgId, type: 'user' as const, text: cleanCmd }
    ];
    setCopilotLogs(updatedLogs);
    setCopilotInput('');

    // Process and respond
    setTimeout(() => {
      const inputLower = cleanCmd.toLowerCase().trim();
      let responseText = '';
      
      try {
        // Core Parsing Rules
        if (inputLower.includes('ማጥፋት') || inputLower.includes('ሰርዝ') && inputLower.includes('ሁሉንም') || inputLower.includes('clear all') || inputLower.includes('empty')) {
          setScenes([]);
          responseText = '🗑️ ሁሉንም ትዕይንቶች በስኬት አጥፍቻለሁ። አሁን አዲስ ስክሪፕት መያዝ ይችላሉ።';
        }
        else if (inputLower.includes('ቆጣቢ') || inputLower.includes('saver') || inputLower.includes('ዳታ')) {
          responseText = '⚡ [ዳታ ቆጣቢ ሞድ] በጥሩ ሁኔታ ተረድቻለሁ! እባክዎ ይህንን ቪዲዮ Render ሲያደርጉት በ "ትንሽ ዳታ / Ultra-Saver" መቆጣጠሪያውን ተጭነው ይላኩት። ጥራቱን ሳይቀንስ በትንሽ ሜባ በፍጥነት ለደንበኛው ይደርሳል።';
        }
        else if (inputLower.includes('ፕሮሞሽን') || inputLower.includes('promotion') || inputLower.includes('promo') || inputLower.includes('ማስታወቂያ') || inputLower.includes('አስተዋውቅ')) {
          responseText = `📢 **ለይቶር ባለቤት የተዘጋጀ ልዩ የፕሮሞሽን ፅሁፍ (Yotor VIP Promotion Generator)** 👑

ባለቤት ሆይ፥ መተግበሪያውን (ይቶር ቪዲዮ ስቱዲዮን) ለደንበኞች ለማስተዋወቅና ብዙ ተከፋይ ተጠቃሚዎችን ለማፍራት የሚረዱ ማራኪ የማስታወቂያ ጽሑፎችን አዘጋጅቼልዎታለሁ። ገልብጠው መጠቀም ይችላሉ፡

========================================
🚀 **አማራጭ 1፦ ለቴሌግራም ቻናልና ግሩፕ (Telegram Channel High-Converting Copy)**
========================================
"ያለ ምንም ድካም በ AI ቪዲዮዎችን መስራት እና መሸጥ ይፈልጋሉ? 🤩

በኢትዮጵያ የመጀመሪያው የሆነው **#የይቶር (Yotor) AI ቪዲዮ ስቱዲዮ** ስራ ጀምሯል! 🎉

🔥 **ይቶር (Yotor) ምን ይሰራል?**
• ✍️ ማንኛውንም ጽሑፍ (ስክሪፕት) ወዲያውኑ ወደ አስገራሚ የአማርኛ ድምፅ (Voiceover) ይቀይራል
• 🎬 ጽሑፉን መሰረት ያደረጉ ማራኪ ቪዲዮዎችን ያውጣጣል
• 📱 በሴኮንዶች ውስጥ ለቲክቶክ (9:16)፣ ለዩቲዩብ (16:9) ወይም ለፌስቡክ ቪዲዮዎችን ያመርታል
• ⚡ **የዳታ ቆጣቢ ቴክኖሎጂ (Ultra-Saver)** ስላለው በትንሽ ሜጋባይት በፍጥነት ይወርዳል!

💰 **የአገልግሎት እቅዶች (Plans)፡**
1️⃣ **የ 720p HD እቅድ** ፡ በቴሌብር ወርሃዊ ክፍያ 10,000 ብር ብቻ!
2️⃣ **የ 1080p Full HD እቅድ** ፡ በቴሌብር ወርሃዊ ክፍያ 15,000 ብር ብቻ!

👉 **አሁኑኑ ይግቡና ከታች ያለውን የቴሌብር ክፍያ በመጫን ፍቃድዎን በሰከንዶች ውስጥ ያግብሩ!**
🔗 ${window.location.origin} 👈"

========================================
🎬 **አማራጭ 2፦ ለቲክቶክ እና ለሪልስ የሚሆን የቪዲዮ ስክሪፕት (TikTok / Reels Viral Script)**
========================================
* [ቪዲዮ እይታ]፡ በስልኩ ማራኪ ቪዲዮዎችን ሰርቶ በቴሌግራም ገንዘብ እየሰራ ያለ ዘመናዊ ኢትዮጵያዊ ወጣት።
* [ድምፅ]፡ "በስልክዎ ብቻ ጽሁፎችን ጽፈው ማራኪ ቪዲዮዎችን መስራት እንደሚችሉ ያውቃሉ? ያውም በአሪፍ የአማርኛ ድምፅ! በይቶር (Yotor) AI ስቱዲዮ አሁን ይቻላል። ቪዲዮዎችን በትንሽ ዳታ በፍጥነት ሰርተው ለደንበኞችዎ ያድርሱ። ሊንኩን በመጫን አሁኑኑ በነፃ ይሞክሩት!"

========================================
💡 **ለባለቤቱ የሚመከሩ የግብይት ስልቶች (Yotor Marketing Tips for Ethiopia):**
• 1. በየቀኑ አጫጭር ቪዲዮዎችን በዚህ ስቱዲዮ እየሰሩ ቲክቶክ ላይ ይፖስቱ። ቲክቶክ ቶሎ ሰዎችን ያዳርሳል።
• 2. መግባት የሚፈልጉ ደንበኞች በቴሌብር ሲከፍሉዎት፥ እርስዎ በ **'Yotor AI Guard Assistant'** chat-bot አማካኝነት በቀጥታ ፍቃድ እንዲያገኙ ይፍቀዱላቸው (Approve ያድርጉ)።

ፈጣሪ ስራዎትን ይባርክ! ✨`;
        }
        else if (inputLower.includes('ጨምር') || inputLower.includes('add') || inputLower.includes('ትዕይንት')) {
          const topicKeywords = cleanCmd.match(/(?:ስለ|about)\s+([^፣።]+)/)?.[1] || 'cosmic deep exploration space drone';
          const fallbackCatalogIdx = scenes.length;
          const fallbackVid = DEFAULT_CATALOG[fallbackCatalogIdx % DEFAULT_CATALOG.length];
          
          const newScene: Scene = {
            id: `sc_cop_new_${Date.now()}`,
            text: `ትዕይንት ${scenes.length + 1}: ${topicKeywords}`,
            keywords: topicKeywords,
            caption: `${topicKeywords.toUpperCase()}`,
            duration: 6.0,
            videoUrl: fallbackVid.url,
            videoThumb: fallbackVid.thumbnail,
            videoAuthor: fallbackVid.author,
            videoAuthorUrl: '#',
            voiceoverUrl: `/api/tts?text=${encodeURIComponent(topicKeywords)}&lang=${projectConfig.voiceLanguage}`,
            originalIndex: scenes.length
          };

          setScenes(prev => [...prev, newScene]);
          setPlaybackIndex(scenes.length);
          responseText = `✅ አዲስ ትዕይንት ስለ "${topicKeywords}" በስኬት ተጨምሯል!`;
        }
        else if (inputLower.includes('መጠን') || inputLower.includes('size') || inputLower.includes('font')) {
          const numbers = inputLower.match(/\d+/);
          if (numbers) {
            const size = parseInt(numbers[0], 10);
            if (size >= 12 && size <= 85) {
              setProjectConfig(prev => ({
                ...prev,
                subtitleStyle: {
                  ...prev.subtitleStyle,
                  fontSize: size
                }
              }));
              responseText = `📐 የግርጌ ጽሑፍ (Subtitle Size) በትክክል ወደ **${size}px** ተቀይሯል!`;
            } else {
              responseText = `⚠️ የተሳሳተ መጠን ነው። እባክዎን ከ 12 እስከ 80 ባለው የልኬት ገደብ ይምረጡ።`;
            }
          } else {
            responseText = `❓ የግርጌ ጽሑፍ የፊደል መጠን ስንት ይሁን? ለምሳሌ "የግርጌ ጽሁፍ መጠን 40 አድርግ" ብለው ይጠይቁኝ።`;
          }
        }
        else if (inputLower.includes('ቀለም') || inputLower.includes('color') || inputLower.includes('ቢጫ') || inputLower.includes('ቀይ') || inputLower.includes('አረንጓዴ') || inputLower.includes('ነጭ') || inputLower.includes('ሰማያዊ')) {
          let name = 'ነጭ (White)';
          let code = '#FFFFFF';

          if (inputLower.includes('ቢጫ') || inputLower.includes('yellow')) {
            name = 'ቢጫ (Yellow)';
            code = '#FACC15';
          } else if (inputLower.includes('ቀይ') || inputLower.includes('red')) {
            name = 'ቀይ (Red)';
            code = '#EF4444';
          } else if (inputLower.includes('አረንጓዴ') || inputLower.includes('green')) {
            name = 'አረንጓዴ (Green)';
            code = '#10B981';
          } else if (inputLower.includes('ሰማያዊ') || inputLower.includes('blue') || inputLower.includes('cyan')) {
            name = 'ሰማያዊ (Cyan)';
            code = '#06B6D4';
          }

          setProjectConfig(prev => ({
            ...prev,
            subtitleStyle: {
              ...prev.subtitleStyle,
              color: code
            }
          }));
          responseText = `🎨 የግርጌ ጽሑፍ ቀለም ወደ **${name}** ተቀይሯል!`;
        }
        else if (inputLower.includes('ድምፅ') || inputLower.includes('volume') || inputLower.includes('ሙዚቃ')) {
          const numbers = inputLower.match(/\d+/);
          if (numbers) {
            const value = parseInt(numbers[0], 10);
            const factor = value > 1 ? value / 100 : value;
            setProjectConfig(prev => ({
              ...prev,
              musicVolume: Number(factor.toFixed(2))
            }));
            responseText = `🎵 የጀርባ ሙዚቃ የድምፅ መጠን ወደ **${Math.round(factor * 100)}%** በስኬት ተስተካክሏል!`;
          } else {
            responseText = `❓ የሙዚቃ ድምፅ መጠን ስንት እንዲሆን ይፈልጋሉ? ለምሳሌ "ሙዚቃ ድምፅ 15%" ይበሉኝ።`;
          }
        }
        else if (inputLower.includes('ርዝማኔ') || inputLower.includes('duration') || inputLower.includes('ሰከንድ')) {
          const numbers = inputLower.match(/\d+/);
          if (numbers) {
            const secs = parseFloat(numbers[0]);
            if (secs >= 2 && secs <= 40) {
              setScenes(prev => prev.map(s => ({ ...s, duration: secs })));
              responseText = `⏱️ የሁሉም ትዕይንቶች ርዝማኔ በአንድ ጊዜ ወደ **${secs} ሰከንድ** በተሳካ ሁኔታ ተለውጧል!`;
            } else {
              responseText = `⚠️ እባክዎ ከ 2 ሰከንድ እስከ 40 ሰከንዶች ባለው ግልጽ ገደብ ውስጥ ይሞክሩ።`;
            }
          } else {
            responseText = `❓ ትዕይንቱ ስንት ሰከንድ እንዲቆይ ይፈልጋሉ? ለምሳሌ "የሁሉንም ርዝማኔ 6 ሰከንድ አድርግ" ይበሉኝ።`;
          }
        }
        else if (inputLower.includes('አቀማመጥ') || inputLower.includes('ratio') || inputLower.includes('9:16') || inputLower.includes('16:9') || inputLower.includes('1:1')) {
          let selectedRatio: AspectRatio = '16:9';
          if (inputLower.includes('9:16')) selectedRatio = '9:16';
          else if (inputLower.includes('1:1')) selectedRatio = '1:1';

          setProjectConfig(prev => ({ ...prev, aspectRatio: selectedRatio }));
          responseText = `📐 የቪዲዮ አቀማመጥ ወደ **${selectedRatio}** (TikTok/YouTube) በቅርጽ ተቀይሯል!`;
        }
        else {
          responseText = `💡 ባለቤት ሆይ፥ ትዕዛዙን በጥራት ተረድቻለሁ ግን ለማስተናገድ ትክክለኛውን ግቤት አላገኘሁም። እባክዎን በቀጥታ "ቀለም ቢጫ አድርግ"፣ "ርዝማኔ 6 ሰከንድ" ወይም "የግርጌ ጽሑፍ መጠን ወደ 40 ቀይር" በማለት በቀኝ ቅጽ ያዘዙኝ። ወዲያውኑ አስተካክላለሁ! ✨`;
        }
      } catch (e: any) {
        responseText = `❌ ትዕዛዝዎን ለማስፈጸም ስሞክር ስህተት ገጥሞኛል: ${e.message}`;
      }

      setCopilotLogs(prev => [
        ...prev,
        { id: `asst_${Date.now()}`, type: 'assistant' as const, text: responseText }
      ]);
    }, 450);
  };

  // Load spectacular cosmic startup template
  useEffect(() => {
    loadStartupCosmicTemplate();
  }, []);

  const loadStartupCosmicTemplate = () => {
    const defaultSentences = [
      { text: "We stand on the edge of a new cosmos.", query: "starry galaxy slow motion space" },
      { text: "Stars flicker in the endless fabric of space, calling us to explore.", query: "cosmic universe nebulas" },
      { text: "For generations, we have looked up and wondered.", query: "happy man looking up sky starry night" },
      { text: "And now, we build the engines of discovery.", query: "futuristic machinery space cockpit" }
    ];

    const initialScenes: Scene[] = defaultSentences.map((s, index) => {
      // Find matching index in our beautiful default catalog so they have actual assets!
      const fallbackVid = DEFAULT_CATALOG[index % DEFAULT_CATALOG.length];
      return {
        id: `sc_${index}_${Date.now()}`,
        text: s.text,
        keywords: s.query,
        caption: s.text,
        duration: 4.5,
        videoUrl: fallbackVid.url,
        videoThumb: fallbackVid.thumbnail,
        videoAuthor: fallbackVid.author,
        videoAuthorUrl: '#',
        voiceoverUrl: `/api/tts?text=${encodeURIComponent(s.text)}&lang=en-gb`,
        originalIndex: index
      };
    });

    setScenes(initialScenes);
    setPlaybackIndex(0);
  };

  // Triggers Gemini parser pipeline
  const handleAnalyzeScript = async (scriptText: string, providedPexelsKey: string, voiceLang: string) => {
    setIsLoading(true);
    setLoadingStage('Analyzing story script with Gemini AI...');
    // Sync pexels credential key status
    setPexelsKey(providedPexelsKey);
    setIsPlaying(false);
    setPlaybackIndex(0);

    try {
      const response = await fetch('/api/analyze-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ script: scriptText })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze script');
      }

      const rawScenes = data.scenes || [];
      if (rawScenes.length === 0) {
        throw new Error('No scenes could be auto-segmented from your text');
      }

      setLoadingStage(`Found ${rawScenes.length} scenes. Matching stunning cinematic footage...`);

      // To prevent rate limits and support long videos up to 30 minutes, process searches sequentially,
      // and update the loading stages dynamically!
      const populatedScenes: Scene[] = [];
      
      for (let i = 0; i < rawScenes.length; i++) {
        const scene = rawScenes[i];
        setLoadingStage(`Securing footage for scene ${i + 1} of ${rawScenes.length}...`);
        
        const voiceoverUrl = `/api/tts?text=${encodeURIComponent(scene.text)}&lang=${voiceLang}`;
        
        let videoUrl = '';
        let videoThumb = '';
        let author = '';

        if (providedPexelsKey) {
          try {
            const pexelsResponse = await fetch(`/api/pexels/search?query=${encodeURIComponent(scene.keywords)}`, {
              headers: {
                'x-pexels-key': providedPexelsKey
              }
            });
            const pexelsData = await pexelsResponse.json();
            
            if (pexelsResponse.ok && pexelsData.videos && pexelsData.videos.length > 0) {
              const bestClip = pexelsData.videos[0];
              const files = bestClip.video_files || [];
              const mp4Files = files.filter((f: any) => f.file_type === 'video/mp4' || f.link.includes('.mp4'));
              const hd = mp4Files.find((f: any) => f.width >= 1280 && f.width <= 1920);
              const sd = mp4Files.find((f: any) => f.width < 1280);
              const anyMp4 = mp4Files[0];

              videoUrl = hd?.link || sd?.link || anyMp4?.link || '';
              videoThumb = bestClip.video_pictures?.[0]?.picture || '';
              author = bestClip.user?.name || 'Stock Creator';
            }
          } catch (e) {
            console.warn(`Could not fetch video for scene ${i}:`, e);
          }
        }

        // Fallback to beautiful pre-curated catalog files if search returned nothing
        if (!videoUrl) {
          const fallbackVid = DEFAULT_CATALOG[i % DEFAULT_CATALOG.length];
          videoUrl = fallbackVid.url;
          videoThumb = fallbackVid.thumbnail;
          author = fallbackVid.author;
        }

        populatedScenes.push({
          id: scene.id || `sc_${i}_${Date.now()}`,
          text: scene.text,
          keywords: scene.keywords,
          caption: scene.caption || scene.text,
          duration: scene.duration || 4.5,
          videoUrl,
          videoThumb,
          videoAuthor: author,
          videoAuthorUrl: '#',
          voiceoverUrl,
          originalIndex: i
        });

        // Small cooling delay between API fetches to protect Pexels rate limits on wide scripts!
        if (providedPexelsKey && i < rawScenes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, i % 5 === 0 ? 400 : 150));
        }
      }

      setScenes(populatedScenes);
      setPlaybackIndex(0);
      setProjectConfig(prev => ({ ...prev, voiceLanguage: voiceLang }));

    } catch (err: any) {
      alert(`Script Analysis failed: ${err.message}. Placing mechanical chunker instead.`);
      loadStartupCosmicTemplate();
    } finally {
      setIsLoading(false);
    }
  };

  // Modify individual scene keys
  const handleUpdateScene = (sceneId: string, updatedData: Partial<Scene>) => {
    setScenes(prev => prev.map(scene => {
      if (scene.id === sceneId) {
        return { ...scene, ...updatedData };
      }
      return scene;
    }));
  };

  // Dynamic Scene addition
  const handleAddScene = () => {
    const fallbackCatalogIdx = scenes.length;
    const fallbackVid = DEFAULT_CATALOG[fallbackCatalogIdx % DEFAULT_CATALOG.length];
    
    const newScene: Scene = {
      id: `sc_new_${Date.now()}`,
      text: "Add some beautiful narrative phrase here.",
      keywords: "cinematic corporate visual",
      caption: "Add some beautiful narrative phrase here.",
      duration: 5.0,
      videoUrl: fallbackVid.url,
      videoThumb: fallbackVid.thumbnail,
      videoAuthor: fallbackVid.author,
      videoAuthorUrl: '#',
      voiceoverUrl: `/api/tts?text=Add%20some%20beautiful%20narrative%20phrase%20here.&lang=${projectConfig.voiceLanguage}`,
      originalIndex: scenes.length
    };

    setScenes([...scenes, newScene]);
    setPlaybackIndex(scenes.length);
  };

  const handleDeleteScene = (sceneId: string) => {
    if (scenes.length <= 1) return;
    
    const targetIdx = scenes.findIndex(s => s.id === sceneId);
    const filtered = scenes.filter(s => s.id !== sceneId);
    setScenes(filtered);
    
    if (playbackIndex === targetIdx) {
      setPlaybackIndex(Math.max(0, targetIdx - 1));
    } else if (playbackIndex > targetIdx) {
      setPlaybackIndex(prev => prev - 1);
    }
  };

  // Segment order sorting
  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= scenes.length) return;

    const copy = [...scenes];
    const target = copy[index];
    copy[index] = copy[nextIndex];
    copy[nextIndex] = target;

    setScenes(copy);
    setPlaybackIndex(nextIndex);
  };

  const handleSelectScene = (sceneId: string) => {
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx !== -1) {
      setPlaybackIndex(idx);
    }
  };

  const handleUpdateConfig = (updated: Partial<ProjectConfig>) => {
    setProjectConfig(prev => ({ ...prev, ...updated }));
  };

  return (
    <AccessGate>
      <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans antialiased pb-12 selection:bg-indigo-500/30 selection:text-indigo-200">
        
        {/* Absolute visual space sparks */}
        <div className="fixed top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-950/10 via-zinc-900/5 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-4 left-6 py-1 px-3 bg-indigo-500/5 border border-indigo-500/15 text-[10px] uppercase font-mono tracking-widest text-indigo-400 rounded-full flex items-center gap-1.5 shadow">
          <Sparkles size={11} className="fill-current text-indigo-500" />
          YOTOR STUDIO PRO
        </div>

        {/* Main Container Head */}
        <header className="max-w-7xl mx-auto px-6 pt-12 pb-6 border-b border-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                <Video size={24} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse"></span>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">YOTOR / AI</span>
                </div>
                <h1 className="text-2xl font-light text-white font-sans tracking-tight">Script Processor & Compositor</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRenderOpen(true)}
              disabled={scenes.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-100 hover:bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl transition-colors shadow-lg disabled:opacity-30 disabled:pointer-events-none active:scale-98"
              id="bake-video-btn"
            >
              <Download size={14} className="stroke-[2.5px]" />
              Bake & Export Video
            </button>
          </div>
        </header>

        {/* Primary Layout Grid */}
        <main className="max-w-7xl mx-auto px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          
          {/* Left Column: Inputs & Scenarios Sequence (Grids 7) */}
          <div className="lg:col-span-7 space-y-6 flex flex-col">
            <ScriptInput
              onAnalyze={handleAnalyzeScript}
              isLoading={isLoading}
              loadingStage={loadingStage}
            />

            <Timeline
              scenes={scenes}
              activeSceneId={activeSceneId}
              onSelectScene={handleSelectScene}
              onUpdateScene={handleUpdateScene}
              onAddScene={handleAddScene}
              onDeleteScene={handleDeleteScene}
              onMoveScene={handleMoveScene}
              pexelsKey={pexelsKey}
            />
          </div>

          {/* Right Column: Composite Viewer Studio Console (Grids 5) */}
          <div className="lg:col-span-5 h-full">
            <div className="sticky top-6">
              <VideoCanvas
                scenes={scenes}
                activeSceneId={activeSceneId}
                onSelectScene={handleSelectScene}
                projectConfig={projectConfig}
                onUpdateConfig={handleUpdateConfig}
                playbackIndex={playbackIndex}
                setPlaybackIndex={setPlaybackIndex}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                canvasRef={canvasRef}
              />
            </div>
          </div>

        </main>

        {/* Floating rendering wizard panel */}
        <RenderModal
          isOpen={isRenderOpen}
          onClose={() => setIsRenderOpen(false)}
          scenes={scenes}
          projectConfig={projectConfig}
          canvasElement={canvasRef.current}
          onRenderFrameChange={(idx) => {
            setPlaybackIndex(idx);
          }}
        />

        {/* OWNER EXCLUSIVE ACTIVE STUDIO AI COPILOT DRAWER */}
        {isAdmin && (
          <div className="fixed bottom-6 left-6 z-[9999] flex flex-col items-start font-sans">
            {/* Expanded Copilot Terminal */}
            {isCopilotOpen && (
              <div className="w-80 sm:w-96 bg-[#0c0c0e]/95 backdrop-blur-md rounded-3xl border border-indigo-500/30 p-4 shadow-2xl flex flex-col space-y-3 mb-3 shrink-0 animate-in fade-in slide-in-from-bottom-5 duration-300">
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Bot size={16} />
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-zinc-950 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-widest font-mono">የይቶር ስቱዲዮ ረዳት AI</h4>
                      <span className="text-[8px] text-indigo-400 uppercase font-bold tracking-wider font-mono">👑 OWNER UPDATE PORTAL</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsCopilotOpen(false)}
                    className="p-1 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-500 hover:text-white transition-all animate-bounce"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Logs terminal style */}
                <div className="h-60 overflow-y-auto space-y-2.5 pr-1 text-left scrollbar-thin scrollbar-thumb-zinc-800">
                  {copilotLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`flex flex-col space-y-1 ${log.type === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[7.5px] font-mono text-zinc-550 uppercase tracking-widest">
                        {log.type === 'user' ? 'Owner Ephrem' : 'YOTOR COPILOT'}
                      </span>
                      <div className={`p-2.5 rounded-2xl max-w-[85%] text-[10.5px] leading-relaxed whitespace-pre-line ${
                        log.type === 'user' 
                          ? 'bg-[#1e1b4b] border border-indigo-950 text-white rounded-tr-none font-mono text-[10px]' 
                          : 'bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-tl-none font-sans'
                      }`}>
                        {log.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Automation Quick Controls */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("የሁሉንም ቪዲዮዎች ርዝማኔ 6 ሰከንድ አድርግ")}
                    className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-indigo-500/30 text-[8.5px] font-mono text-zinc-400 hover:text-white rounded-lg shrink-0 transition-colors"
                  >
                    ⏱️ 6s Scenes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("የግርጌ ጽሑፍ ቀለም ቢጫ አድርግ")}
                    className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-indigo-500/30 text-[8.5px] font-mono text-zinc-400 hover:text-white rounded-lg shrink-0 transition-colors"
                  >
                    🎨 ቢጫ ቀለም
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("የግርጌ ጽሑፍ መጠን ወደ 40 ቀይርልኝ")}
                    className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-indigo-500/30 text-[8.5px] font-mono text-zinc-400 hover:text-white rounded-lg shrink-0 transition-colors"
                  >
                    📐 40px Size
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("የቪዲዮውን አቀማመጥ 9:16 አድርገው")}
                    className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-indigo-500/30 text-[8.5px] font-mono text-zinc-400 hover:text-white rounded-lg shrink-0 transition-colors"
                  >
                    📱 9:16 TikTok
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("የጀርባ ሙዚቃ ድምፅ 15% አድርግ")}
                    className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-indigo-500/30 text-[8.5px] font-mono text-zinc-400 hover:text-white rounded-lg shrink-0 transition-colors"
                  >
                    🎵 15% Vol
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunCopilotCommand("ማስታወቂያ")}
                    className="px-2 py-1 bg-purple-950/40 hover:bg-purple-900 border border-purple-500/30 hover:border-purple-500 text-[8.5px] font-mono text-purple-300 hover:text-white rounded-lg shrink-0 transition-colors font-bold"
                  >
                    📢 ማስታወቂያ (Get Promo)
                  </button>
                </div>

                {/* Input Prompt form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRunCopilotCommand(copilotInput);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    placeholder="ስቱዲዮውን ለማዘዝ እዚህ ይጻፉ..."
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-900 focus:border-indigo-500/50 rounded-xl px-3 py-2 text-[10.5px] text-zinc-200 placeholder-zinc-700 font-sans focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!copilotInput.trim()}
                    className="p-2 bg-gradient-to-tr from-indigo-600 to-cyan-600 hover:from-indigo-505 hover:to-cyan-505 disabled:opacity-40 text-white rounded-xl transition-all"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>
            )}

            {/* Float Badge Launcher circular Button */}
            <button
              type="button"
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono rounded-full shadow-2xl transition-all font-bold hover:scale-105 active:scale-95 animate-shimmer"
              title="Yotor Developer Copilot"
            >
              <Bot size={16} className="animate-pulse" />
              <span className="text-[10px] uppercase tracking-wide">👑 Yotor AI Copilot</span>
            </button>
          </div>
        )}
      </div>
    </AccessGate>
  );
}
