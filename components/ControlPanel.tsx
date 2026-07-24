import React from 'react';
import { BlendMode, EffectDef, GlobalParams, ParamConfig, PlaybackState, PreviewMode } from '../types';
import {
  CheckSquare,
  ExternalLink,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ControlPanelProps {
  globalParams: GlobalParams;
  setGlobalParams: (p: GlobalParams) => void;
  activeEffect: EffectDef;
  effectParams: Record<string, number | string | boolean>;
  setEffectParams: (p: Record<string, number | string | boolean>) => void;
  allEffects: EffectDef[];
  onSelectEffect: (e: EffectDef) => void;
  isVideo: boolean;
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onToggleLoop: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
}

const TARGETS = [
  { label: 'Entire Video', value: 'entire' },
  { label: 'Person', value: 'person' },
  { label: 'Face', value: 'face' },
  { label: 'Hands', value: 'hands' },
  { label: 'Background', value: 'background' },
  { label: 'Detected Object', value: 'object' },
  { label: 'Motion Area', value: 'motion' },
  { label: 'Depth Range', value: 'depth' },
] as const;

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'add', 'multiply', 'difference'];
const PREVIEW_MODES: { label: string; value: PreviewMode }[] = [
  { label: 'Original', value: 'original' },
  { label: 'Effect', value: 'effect' },
  { label: 'Split View', value: 'split' },
  { label: 'Before / After', value: 'before_after' },
];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const statusTone = (status?: string) => {
  if (status === 'Complete') return 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30';
  if (status === 'Lite') return 'bg-sky-400/20 text-sky-200 border-sky-300/30';
  if (status === 'Mock') return 'bg-amber-400/20 text-amber-100 border-amber-300/30';
  return 'bg-white/10 text-white/45 border-white/10';
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  globalParams,
  setGlobalParams,
  activeEffect,
  effectParams,
  setEffectParams,
  allEffects,
  onSelectEffect,
  isVideo,
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onStepFrame,
  onToggleLoop,
  onToggleMute,
  onFullscreen,
}) => {
  const updateGlobal = <K extends keyof GlobalParams>(key: K, val: GlobalParams[K]) => {
    setGlobalParams({ ...globalParams, [key]: val });
  };

  const updateEffect = (key: string, val: number | string | boolean) => {
    setEffectParams({ ...effectParams, [key]: val });
  };

  const resetActiveEffect = () => {
    setEffectParams(activeEffect.defaultParams);
    setGlobalParams({
      ...globalParams,
      effectEnabled: true,
      effectAmount: 0.85,
      originalMix: 0.25,
      maskFeather: 0.2,
      motionReactivity: 0.5,
      speed: 1,
    });
  };

  const renderParamControl = ([key, config]: [string, ParamConfig]) => {
    const value = effectParams[key];
    const label = key.replace(/([A-Z])/g, ' $1');

    if (config.type === 'slider') {
      const numericValue = typeof value === 'number' ? value : Number(value) || 0;
      return (
        <div key={key} className="min-w-[132px] flex-1 max-w-[210px]">
          <div className="flex items-center justify-between gap-3 text-[8px] font-black uppercase text-white/45">
            <span className="truncate">{label}</span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={numericValue}
              onChange={(event) => updateEffect(key, parseFloat(event.target.value) || 0)}
              className="w-12 bg-transparent text-right text-white/80 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={numericValue}
            onChange={(event) => updateEffect(key, parseFloat(event.target.value))}
            className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
          />
        </div>
      );
    }

    if (config.type === 'select') {
      return (
        <div key={key} className="min-w-[190px]">
          <div className="mb-2 text-[8px] font-black uppercase text-white/45">{label}</div>
          <div className="flex rounded-full border border-white/10 bg-black/35 p-1">
            {config.options?.map((option) => (
              <button
                key={option}
                onClick={() => updateEffect(key, option)}
                className={`h-7 flex-1 rounded-full px-2 text-[8px] font-black uppercase transition ${value === option ? 'bg-white text-zinc-900' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (config.type === 'color') {
      return (
        <div key={key} className="min-w-[132px]">
          <div className="mb-2 text-[8px] font-black uppercase text-white/45">{label}</div>
          <input
            type="color"
            value={typeof value === 'string' ? value : '#40f7ff'}
            onChange={(event) => updateEffect(key, event.target.value)}
            className="h-8 w-full cursor-pointer rounded-full border border-white/10 bg-black/30 p-1"
          />
        </div>
      );
    }

    return (
      <button
        key={key}
        onClick={() => updateEffect(key, !value)}
        className={`flex h-8 items-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase transition ${value ? 'border-white bg-white text-zinc-900' : 'border-white/10 bg-white/10 text-white/55 hover:bg-white/20 hover:text-white'}`}
      >
        {value ? <CheckSquare size={14} /> : <Square size={14} />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex w-full flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/55 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="grid grid-cols-7 gap-2">
          {allEffects.map((effect) => {
            const isActive = activeEffect.id === effect.id;
            return (
              <button
                key={effect.id}
                onClick={() => onSelectEffect(effect)}
                className={`group flex min-h-[92px] flex-col justify-between rounded-lg border p-3 text-left transition ${isActive ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white hover:border-white/35 hover:bg-white/15'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase leading-tight">{effect.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[7px] font-black uppercase ${isActive ? 'border-zinc-950/20 bg-zinc-950/10 text-zinc-700' : statusTone(effect.status)}`}>
                      {effect.status || 'Planned'}
                    </span>
                  </div>
                  <p className={`mt-2 line-clamp-2 text-[8px] font-bold leading-snug ${isActive ? 'text-zinc-600' : 'text-white/45'}`}>{effect.description}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={`text-[7px] font-black uppercase ${isActive ? 'text-zinc-600' : 'text-white/35'}`}>GPU {effect.gpuLoad || 'Medium'}</span>
                  <span className={`h-1.5 w-9 rounded-full ${isActive ? 'bg-zinc-950' : 'bg-white/25 group-hover:bg-white/50'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-zinc-950/55 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            onClick={() => updateGlobal('effectEnabled', !globalParams.effectEnabled)}
            className={`flex h-8 items-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase transition ${globalParams.effectEnabled ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white/55 hover:bg-white/20'}`}
          >
            {globalParams.effectEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
            Effect
          </button>

          <div className="min-w-[150px]">
            <div className="flex justify-between text-[8px] font-black uppercase text-white/45">
              <span>Effect Amount</span>
              <span>{Math.round(globalParams.effectAmount * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={globalParams.effectAmount} onChange={(e) => updateGlobal('effectAmount', parseFloat(e.target.value))} className="mt-2 h-1 w-full appearance-none rounded-full bg-white/15 accent-white" />
          </div>

          <div className="min-w-[178px]">
            <div className="mb-2 text-[8px] font-black uppercase text-white/45">Target</div>
            <select value={globalParams.target} onChange={(e) => updateGlobal('target', e.target.value as GlobalParams['target'])} className="h-8 w-full rounded-full border border-white/10 bg-black/35 px-3 text-[9px] font-black uppercase text-white outline-none">
              {TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
            </select>
          </div>

          <div className="min-w-[150px]">
            <div className="mb-2 text-[8px] font-black uppercase text-white/45">Blend Mode</div>
            <select value={globalParams.blendMode} onChange={(e) => updateGlobal('blendMode', e.target.value as BlendMode)} className="h-8 w-full rounded-full border border-white/10 bg-black/35 px-3 text-[9px] font-black uppercase text-white outline-none">
              {BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>

          {[
            ['originalMix', 'Original Mix'],
            ['maskFeather', 'Mask Feather'],
            ['motionReactivity', 'Motion Reactivity'],
            ['speed', 'Speed'],
          ].map(([key, label]) => (
            <div key={key} className="min-w-[132px]">
              <div className="flex justify-between text-[8px] font-black uppercase text-white/45">
                <span>{label}</span>
                <span>{key === 'speed' ? globalParams.speed.toFixed(1) : `${Math.round(Number(globalParams[key as keyof GlobalParams]) * 100)}%`}</span>
              </div>
              <input
                type="range"
                min={key === 'speed' ? 0 : 0}
                max={key === 'speed' ? 4 : 1}
                step={key === 'speed' ? 0.1 : 0.01}
                value={Number(globalParams[key as keyof GlobalParams])}
                onChange={(e) => updateGlobal(key as keyof GlobalParams, parseFloat(e.target.value) as never)}
                className="mt-2 h-1 w-full appearance-none rounded-full bg-white/15 accent-white"
              />
            </div>
          ))}

          <button onClick={resetActiveEffect} className="flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-[9px] font-black uppercase text-white/55 transition hover:bg-white/20 hover:text-white">
            <RotateCcw size={13} />
            Reset
          </button>

          {activeEffect.reference && (
            <button onClick={() => window.open(activeEffect.reference?.url, '_blank', 'noopener,noreferrer')} className="flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-[9px] font-black uppercase text-white/55 transition hover:bg-white/20 hover:text-white">
              <ExternalLink size={13} />
              Info
            </button>
          )}
        </div>
      </div>

      <div className="rounded-full border border-white/10 bg-zinc-950/55 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex max-w-[720px] flex-1 flex-wrap items-center gap-4">
            {(Object.entries(activeEffect.paramConfig) as [string, ParamConfig][]).map(renderParamControl)}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-white/10 bg-black/35 p-1">
              {PREVIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => updateGlobal('previewMode', mode.value)}
                  className={`h-7 rounded-full px-3 text-[8px] font-black uppercase transition ${globalParams.previewMode === mode.value ? 'bg-white text-zinc-950' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button onClick={playbackState.isPlaying ? onPause : onPlay} disabled={!isVideo} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">
              {playbackState.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={() => onStepFrame(-1)} disabled={!isVideo} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">
              <SkipBack size={14} />
            </button>
            <button onClick={() => onStepFrame(1)} disabled={!isVideo} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">
              <SkipForward size={14} />
            </button>
            <div className="flex min-w-[180px] items-center gap-2">
              <span className="w-9 text-right text-[9px] font-black text-white/45">{formatTime(playbackState.currentTime)}</span>
              <input type="range" min="0" max={playbackState.duration || 0} step="0.01" value={Math.min(playbackState.currentTime, playbackState.duration || 0)} onChange={(e) => onSeek(parseFloat(e.target.value))} disabled={!isVideo || !playbackState.duration} className="h-1 w-24 appearance-none rounded-full bg-white/15 accent-white disabled:opacity-30" />
              <span className="w-9 text-[9px] font-black text-white/45">{formatTime(playbackState.duration)}</span>
            </div>
            <button onClick={onToggleLoop} disabled={!isVideo} className={`h-8 rounded-full border px-3 text-[8px] font-black uppercase transition disabled:opacity-30 ${playbackState.loop ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white/45 hover:bg-white/20 hover:text-white'}`}>
              Loop
            </button>
            <button onClick={onToggleMute} disabled={!isVideo} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30">
              {playbackState.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={onFullscreen} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
