
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import CanvasRenderer, { CanvasRendererHandle } from './components/CanvasRenderer';
import ControlPanel from './components/ControlPanel';
import { EFFECTS, INITIAL_GLOBAL_PARAMS } from './constants';
import { GlobalParams, EffectDef, ParamConfig, PlaybackState } from './types';
import { randomFloat, randomInt, hslToHex } from './services/utils';

const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const App: React.FC = () => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true);
  
  const [globalParams, setGlobalParams] = useState<GlobalParams>(INITIAL_GLOBAL_PARAMS);
  const [activeEffect, setActiveEffect] = useState<EffectDef>(EFFECTS[0]);
  const [effectParams, setEffectParams] = useState<Record<string, number | string | boolean>>(EFFECTS[0].defaultParams);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loop: true,
    muted: false,
  });

  // ON AIR 전용 상태
  const [isOnAirActive, setIsOnAirActive] = useState(false);

  const rendererRef = useRef<CanvasRendererHandle>(null);
  const onAirRendererRef = useRef<CanvasRendererHandle>(null);
  const navigatorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaObjectUrlRef = useRef<string | null>(null);
  const activeEffectRef = useRef(activeEffect);
  const effectParamsRef = useRef(effectParams);
  const globalParamsRef = useRef(globalParams);
  const syncChannel = useMemo(
    () => typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('visual-parameter-sync'),
    [],
  );

  const isOnAirView = new URLSearchParams(window.location.search).get('view') === 'onair';

  // 1. 메인 창 -> 온에어 창 상태 전송
  useEffect(() => {
    if (!syncChannel) return;
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
    if (!syncChannel) return;
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

  useEffect(() => {
    activeEffectRef.current = activeEffect;
    effectParamsRef.current = effectParams;
    globalParamsRef.current = globalParams;
  }, [activeEffect, effectParams, globalParams]);

  useEffect(() => {
    if (isOnAirView) return;
    if (!mediaSrc) {
      setIsNavigatorVisible(true);
      return;
    }

    const showNavigator = () => {
      setIsNavigatorVisible(true);
      if (navigatorHideTimerRef.current) clearTimeout(navigatorHideTimerRef.current);
      navigatorHideTimerRef.current = setTimeout(() => setIsNavigatorVisible(false), 5000);
    };

    showNavigator();
    window.addEventListener('mousemove', showNavigator, { passive: true });

    return () => {
      window.removeEventListener('mousemove', showNavigator);
      if (navigatorHideTimerRef.current) clearTimeout(navigatorHideTimerRef.current);
    };
  }, [isOnAirView, mediaSrc]);

  const handleUpload = (file: File) => {
    if (!SUPPORTED_MEDIA_TYPES.has(file.type)) {
      window.alert('지원되는 파일 형식은 JPG, PNG, WEBP, MP4, MOV, WEBM입니다.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      window.alert('업로드 파일은 최대 600MB까지 지원합니다.');
      return;
    }
    if (mediaObjectUrlRef.current) {
      URL.revokeObjectURL(mediaObjectUrlRef.current);
      mediaObjectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    mediaObjectUrlRef.current = url;
    setMediaSrc(url);
    setIsVideo(file.type.startsWith('video'));
    setPlaybackState({ isPlaying: false, currentTime: 0, duration: 0, loop: true, muted: false });
  };

  useEffect(() => () => {
    if (mediaObjectUrlRef.current) {
      URL.revokeObjectURL(mediaObjectUrlRef.current);
    }
  }, []);

  useEffect(() => {
    if (!syncChannel) return;
    const closeChannel = () => syncChannel.close();
    window.addEventListener('pagehide', closeChannel, { once: true });
    return () => window.removeEventListener('pagehide', closeChannel);
  }, [syncChannel]);

  const handleExport = () => {
    if (rendererRef.current) rendererRef.current.startExport();
  };

  const handleOnAir = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'onair');
    const onAirWindow = window.open(
      url.toString(), 
      'VisualParameterOnAir', 
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,noopener,noreferrer'
    );
    if (onAirWindow) onAirWindow.opener = null;
  };

  const handleStartOnAir = () => {
    setIsOnAirActive(true);
    window.requestAnimationFrame(() => {
      onAirRendererRef.current?.setMuted(false);
      onAirRendererRef.current?.play();
    });
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
        const currentEffect = activeEffectRef.current;
        const mixableEffects = EFFECTS.filter(effect => effect.id !== 'none');
        const randomEffect = Math.random() < 0.58 && currentEffect.id !== 'none'
          ? currentEffect
          : mixableEffects[Math.floor(Math.random() * mixableEffects.length)];
        const currentParams = effectParamsRef.current;
        const newParams: Record<string, number | string | boolean> = {};
        (Object.entries(randomEffect.paramConfig) as [string, ParamConfig][]).forEach(([key, config]) => {
          const currentValue = currentEffect.id === randomEffect.id ? currentParams[key] : undefined;
          const defaultValue = randomEffect.defaultParams[key];

          if (config.type === 'slider') {
            const min = config.min ?? config.randomRange?.[0] ?? 0;
            const max = config.max ?? config.randomRange?.[1] ?? 1;
            const step = config.step ?? 0.01;
            const base = typeof currentValue === 'number'
              ? currentValue
              : typeof defaultValue === 'number'
                ? defaultValue
                : (min + max) / 2;
            const drift = (max - min) * 0.16;
            const rawValue = Math.max(min, Math.min(max, base + randomFloat(-drift, drift)));
            const steppedValue = Math.round(rawValue / step) * step;
            newParams[key] = Number(steppedValue.toFixed(step < 1 ? 3 : 0));
          } else if (config.type === 'select') {
            const options = config.options || [];
            const base = typeof currentValue === 'string' && options.includes(currentValue) ? currentValue : defaultValue;
            newParams[key] = Math.random() < 0.72 && typeof base === 'string' ? base : options[randomInt(0, Math.max(0, options.length - 1))];
          } else if (config.type === 'toggle') {
            const base = typeof currentValue === 'boolean' ? currentValue : Boolean(defaultValue);
            newParams[key] = Math.random() < 0.78 ? base : !base;
          } else {
            newParams[key] = defaultValue;
          }
        });
        setActiveEffect(randomEffect);
        setEffectParams(newParams);
        const currentGlobal = globalParamsRef.current;
        const activeColorMode = currentGlobal.bw
          ? 1
          : currentGlobal.xray
            ? 2
            : currentGlobal.thermal
              ? 3
              : currentGlobal.invert
                ? 4
                : currentGlobal.dramaticWarm
                  ? 5
                  : currentGlobal.dramaticCool
                    ? 6
                    : 0;
        const colorMode = Math.random() < 0.68 ? activeColorMode : randomInt(0, 6);
        setGlobalParams(prev => ({
          ...prev,
          bw: colorMode === 1,
          xray: colorMode === 2,
          thermal: colorMode === 3,
          invert: colorMode === 4,
          dramaticWarm: colorMode === 5,
          dramaticCool: colorMode === 6,
        }));
      };
      mix();
      interval = setInterval(mix, 3000);
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
      timer = setInterval(pickNewTarget, 2000);
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
            onClick={handleStartOnAir}
          >
            <div className="w-24 h-24 rounded-full border border-white/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-red-500">
               <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
            </div>
            <span className="mt-8 text-[12px] font-black tracking-[1em] text-white/40 uppercase group-hover:text-white transition-colors">Click to Start Sync</span>
            <span className="mt-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">Enable Autoplay & AI Engine</span>
          </div>
        )}
        
        <CanvasRenderer 
          ref={onAirRendererRef}
          mediaSrc={mediaSrc} 
          isVideo={isVideo}
          activeEffect={activeEffect}
          effectParams={effectParams}
          globalParams={globalParams}
          onUpload={() => {}} 
          isCleanFeed={true}
          audioEnabled={isOnAirActive}
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
          audioEnabled={true}
        />
      </main>
      <div className={`absolute bottom-3 left-1/2 z-50 w-full px-6 transition-all duration-500 ease-out ${isNavigatorVisible ? '-translate-x-1/2 translate-y-0 opacity-100 pointer-events-none' : '-translate-x-1/2 translate-y-8 opacity-0 pointer-events-none'}`}>
         <div className={isNavigatorVisible ? 'pointer-events-auto' : 'pointer-events-none'}>
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
