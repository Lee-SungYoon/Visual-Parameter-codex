
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import CanvasRenderer, { CanvasRendererHandle } from './components/CanvasRenderer';
import ControlPanel from './components/ControlPanel';
import { EFFECTS, INITIAL_GLOBAL_PARAMS } from './constants';
import { GlobalParams, EffectDef, ParamConfig, PlaybackState } from './types';
import { randomFloat, randomInt, hslToHex } from './services/utils';

const App: React.FC = () => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [globalParams, setGlobalParams] = useState<GlobalParams>(INITIAL_GLOBAL_PARAMS);
  const [activeEffect, setActiveEffect] = useState<EffectDef>(EFFECTS[0]);
  const [effectParams, setEffectParams] = useState<Record<string, number | string | boolean>>(EFFECTS[0].defaultParams);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loop: true,
    muted: true,
  });

  // ON AIR 전용 상태
  const [isOnAirActive, setIsOnAirActive] = useState(false);

  const rendererRef = useRef<CanvasRendererHandle>(null);
  const syncChannel = useMemo(() => new BroadcastChannel('visual-parameter-sync'), []);

  const isOnAirView = new URLSearchParams(window.location.search).get('view') === 'onair';

  // 1. 메인 창 -> 온에어 창 상태 전송
  useEffect(() => {
    if (!isOnAirView) {
      const state = {
        type: 'STATE_UPDATE',
        mediaSrc,
        isVideo,
        globalParams,
        activeEffectId: activeEffect.id,
        effectParams
      };
      syncChannel.postMessage(state);
    }
  }, [mediaSrc, isVideo, globalParams, activeEffect, effectParams, isOnAirView, syncChannel]);

  // 2. 메시지 수신 및 초기 동기화 요청
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (isOnAirView) {
        if (data.type === 'STATE_UPDATE') {
          if (data.mediaSrc !== undefined) setMediaSrc(data.mediaSrc);
          if (data.isVideo !== undefined) setIsVideo(data.isVideo);
          if (data.globalParams !== undefined) setGlobalParams(data.globalParams);
          if (data.activeEffectId !== undefined) {
            const effect = EFFECTS.find(eff => eff.id === data.activeEffectId);
            if (effect) setActiveEffect(effect);
          }
          if (data.effectParams !== undefined) setEffectParams(data.effectParams);
        }
      } else if (data.type === 'REQUEST_SYNC') {
        syncChannel.postMessage({
          type: 'STATE_UPDATE',
          mediaSrc,
          isVideo,
          globalParams,
          activeEffectId: activeEffect.id,
          effectParams
        });
      }
    };

    syncChannel.onmessage = handleMessage;
    if (isOnAirView) syncChannel.postMessage({ type: 'REQUEST_SYNC' });

    return () => { syncChannel.onmessage = null; };
  }, [isOnAirView, syncChannel, mediaSrc, isVideo, globalParams, activeEffect, effectParams]);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setMediaSrc(url);
    setIsVideo(file.type.startsWith('video'));
    setPlaybackState({ isPlaying: false, currentTime: 0, duration: 0, loop: true, muted: true });
  };

  const handleExport = () => {
    if (rendererRef.current) rendererRef.current.startExport();
  };

  const handleOnAir = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'onair');
    window.open(
      url.toString(), 
      'VisualParameterOnAir', 
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
  };

  const handleEffectSelect = (effect: EffectDef) => {
    setActiveEffect(effect);
    setEffectParams(effect.defaultParams);
  };

  // Mix Mode
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (globalParams.mixMode && !isOnAirView) {
      const mix = () => {
        const randomEffect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
        setActiveEffect(randomEffect);
        const newParams: Record<string, number | string | boolean> = {};
        (Object.entries(randomEffect.paramConfig) as [string, ParamConfig][]).forEach(([key, config]) => {
           if (config.randomRange) {
               newParams[key] = config.step && config.step % 1 === 0 
                ? randomInt(config.randomRange[0], config.randomRange[1])
                : parseFloat(randomFloat(config.randomRange[0], config.randomRange[1]).toFixed(2));
           } else {
               newParams[key] = randomEffect.defaultParams[key];
           }
        });
        setEffectParams(newParams);
      };
      mix();
      interval = setInterval(mix, 2500);
    }
    return () => clearInterval(interval);
  }, [globalParams.mixMode, isOnAirView]);

  // Color Mix
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let lerpTimer: ReturnType<typeof setInterval>;
    if (globalParams.colorMix && !isOnAirView) {
      let targetHue = globalParams.hue;
      const pickNewTarget = () => { targetHue = (targetHue + randomInt(40, 120)) % 360; };
      lerpTimer = setInterval(() => {
        setGlobalParams(prev => {
          const nextHue = prev.hue + (targetHue - prev.hue) * 0.1;
          return { ...prev, hue: nextHue, effectColor: hslToHex(nextHue, prev.saturation, prev.lightness), gradientPreset: 0 };
        });
      }, 100);
      pickNewTarget();
      timer = setInterval(pickNewTarget, 3000);
    }
    return () => { clearInterval(timer); clearInterval(lerpTimer); };
  }, [globalParams.colorMix, isOnAirView]);

  // 온에어 뷰 렌더링
  if (isOnAirView) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
        {!isOnAirActive && (
          <div 
            className="absolute inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center cursor-pointer group"
            onClick={() => setIsOnAirActive(true)}
          >
            <div className="w-24 h-24 rounded-full border border-white/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-red-500">
               <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
            </div>
            <span className="mt-8 text-[12px] font-black tracking-[1em] text-white/40 uppercase group-hover:text-white transition-colors">Click to Start Sync</span>
            <span className="mt-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">Enable Autoplay & AI Engine</span>
          </div>
        )}
        
        <CanvasRenderer 
          mediaSrc={mediaSrc} 
          isVideo={isVideo}
          activeEffect={activeEffect}
          effectParams={effectParams}
          globalParams={globalParams}
          onUpload={() => {}} 
          isCleanFeed={true}
        />
        
        {isOnAirActive && !mediaSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10 gap-4">
            <span className="text-[12px] font-black tracking-[1.5em] uppercase animate-pulse">Waiting for Signal</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-white font-sans overflow-hidden text-zinc-900">
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <Header onExport={handleExport} onAir={handleOnAir} isExporting={isExporting} />
      </div>
      <main className="w-full h-full">
        <CanvasRenderer 
          ref={rendererRef}
          mediaSrc={mediaSrc} 
          isVideo={isVideo}
          activeEffect={activeEffect}
          effectParams={effectParams}
          globalParams={globalParams}
          onUpload={handleUpload}
          onExportStateChange={setIsExporting}
          onPlaybackStateChange={setPlaybackState}
        />
      </main>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 w-full px-6 max-w-[1600px] pointer-events-none">
         <div className="pointer-events-auto">
            <ControlPanel 
              globalParams={globalParams}
              setGlobalParams={setGlobalParams}
              activeEffect={activeEffect}
              effectParams={effectParams}
              setEffectParams={setEffectParams}
              allEffects={EFFECTS}
              onSelectEffect={handleEffectSelect}
              isVideo={isVideo}
              playbackState={playbackState}
              onPlay={() => rendererRef.current?.play()}
              onPause={() => rendererRef.current?.pause()}
              onSeek={(time) => rendererRef.current?.seek(time)}
              onStepFrame={(direction) => rendererRef.current?.stepFrame(direction)}
              onToggleLoop={() => rendererRef.current?.setLoop(!playbackState.loop)}
              onToggleMute={() => rendererRef.current?.setMuted(!playbackState.muted)}
              onFullscreen={() => rendererRef.current?.enterFullscreen()}
            />
         </div>
      </div>
    </div>
  );
};

export default App;
