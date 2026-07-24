import React from 'react';
import { EffectDef, GlobalParams, ParamConfig, PlaybackState, PreviewMode } from '../types';
import {
  CheckSquare,
  Circle,
  Hash,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Square,
  Target,
  Type,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { hslToHex } from '../services/utils';

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

const formatParamLabel = (key: string) => key.toUpperCase();

const formatParamValue = (value: number | string | boolean, config?: ParamConfig) => {
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (typeof value === 'string') return value.toUpperCase();
  const step = config?.step || 1;
  const decimalPlaces = step < 1 ? Math.min(step.toString().split('.')[1]?.length || 0, 3) : 0;
  return value.toFixed(decimalPlaces).replace(/\.?0+$/, '');
};

const renderOptionIcon = (option: string) => {
  if (option === 'arrow') return <MousePointer2 size={15} />;
  if (option === 'dot') return <Circle size={12} fill="currentColor" strokeWidth={0} />;
  if (option === 'square') return <Square size={12} fill="currentColor" strokeWidth={0} />;
  if (option === 'number') return <Hash size={14} />;
  if (option === 'alphabet') return <Type size={14} />;
  if (option === 'triangle') return <span className="h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-current" />;
  if (option === 'hexagon') return <span className="h-4 w-4 bg-current [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]" />;
  if (option === 'rhombus') return <span className="h-4 w-4 rotate-45 rounded-[2px] bg-current" />;
  return <span className="px-2">{option}</span>;
};

const MODE_BUTTONS = [
  { label: 'B&W', key: 'bw' },
  { label: 'Ray', key: 'xray' },
  { label: 'Thermal', key: 'thermal' },
  { label: 'Invert', key: 'invert' },
] as const;

const PRESET_BUTTONS = [
  { label: 'Solar', key: 'dramaticWarm' },
  { label: 'Chrome', key: 'dramaticCool' },
] as const;

const TARGET_BUTTONS = [
  { label: 'SUBJECT', value: 'subject' },
  { label: 'BG', value: 'background' },
  { label: 'BOTH', value: 'both' },
] as const;

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

  const updateColorParam = (key: 'hue' | 'saturation' | 'lightness', value: number) => {
    const next = {
      ...globalParams,
      [key]: value,
      stylePreset: 'custom' as const,
    };
    setGlobalParams({
      ...next,
      effectColor: hslToHex(next.hue, next.saturation, next.lightness),
    });
  };

  const renderEffectMenu = () => (
    <div className="flex w-full max-w-[calc(100vw-25.6px)] items-center gap-2 overflow-hidden whitespace-nowrap">
      {allEffects.map((effect) => {
        const isActive = activeEffect.id === effect.id;
        return (
          <button
            key={effect.id}
            onClick={() => onSelectEffect(effect)}
            className={`h-10 min-w-0 flex-1 rounded-[18px] border px-2 text-[9px] font-black uppercase transition sm:text-[10px] ${isActive ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white/55 hover:border-white/35 hover:bg-white/15 hover:text-white'}`}
          >
            {effect.name}
          </button>
        );
      })}
    </div>
  );

  const renderColorSlider = (
    key: 'hue' | 'saturation' | 'lightness',
    label: string,
    min: number,
    max: number,
    gradientClass?: string,
  ) => {
    const value = globalParams[key];
    return (
      <div className="min-w-0 flex-1 basis-[clamp(96px,9vw,132px)]">
        <div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase text-white/45">
          <span>{label}</span>
          <span className="tabular-nums text-white/80">{Math.round(value)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => updateColorParam(key, parseFloat(event.target.value))}
          className={`h-1 w-full appearance-none rounded-full accent-white ${gradientClass || 'bg-white/15'}`}
        />
      </div>
    );
  };

  const renderModeButton = ({ label, key }: (typeof MODE_BUTTONS)[number]) => {
    const active = Boolean(globalParams[key]);
    return (
      <button
        key={key}
        onClick={() => setGlobalParams({
          ...globalParams,
          bw: false,
          xray: false,
          thermal: false,
          invert: false,
          dramaticWarm: false,
          dramaticCool: false,
          [key]: !active,
        })}
        className={`h-9 rounded-full border px-6 text-[9px] font-black transition ${
          active ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white/70 hover:border-white/35 hover:bg-white/15'
        }`}
      >
        {label}
      </button>
    );
  };

  const renderPresetButton = ({ label, key }: (typeof PRESET_BUTTONS)[number]) => {
    const active = Boolean(globalParams[key]);
    const otherKey = key === 'dramaticWarm' ? 'dramaticCool' : 'dramaticWarm';
    return (
      <button
        key={key}
        onClick={() => setGlobalParams({
          ...globalParams,
          bw: false,
          xray: false,
          thermal: false,
          invert: false,
          [otherKey]: false,
          [key]: !active,
        })}
        className={`h-9 rounded-full border px-5 text-[9px] font-black transition ${
          active ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white/70 hover:border-white/35 hover:bg-white/15'
        }`}
      >
        {label}
      </button>
    );
  };

  const renderGlobalMenu = () => (
    <div className="flex w-full max-w-[calc(100vw-25.6px)] items-center justify-between gap-x-4 overflow-hidden whitespace-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-x-4">
        <SlidersHorizontal size={16} className="text-white/35" />
        {renderColorSlider('hue', 'HUE', 0, 360, 'bg-[linear-gradient(90deg,#ff003c,#ffee00,#00ff73,#00d5ff,#332cff,#ff00c8,#ff003c)]')}
        {renderColorSlider('saturation', 'SAT', 0, 100)}
        {renderColorSlider('lightness', 'LUM', 0, 100)}
        <button
          onClick={() => updateGlobal('colorMix', !globalParams.colorMix)}
          className={`h-10 min-w-[132px] rounded-full border px-5 text-[10px] font-black uppercase transition ${
            globalParams.colorMix ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white hover:border-white/35 hover:bg-white/15'
          }`}
        >
          Color Mix
        </button>
        <div className="hidden h-9 w-px bg-white/10 lg:block" />
        <div className="flex items-center gap-2">
          {MODE_BUTTONS.map(renderModeButton)}
          {PRESET_BUTTONS.map(renderPresetButton)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button
          onClick={() => updateGlobal('autoTracking', !globalParams.autoTracking)}
          className={`flex h-10 items-center gap-2 rounded-full border px-5 text-[10px] font-black uppercase transition ${
            globalParams.autoTracking ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white hover:border-white/35 hover:bg-white/15'
          }`}
        >
          <Target size={14} />
          Tracking
        </button>

        <div className="flex rounded-full border border-white/10 bg-black/25 p-1">
          {TARGET_BUTTONS.map((target) => (
            <button
              key={target.value}
              onClick={() => updateGlobal('target', target.value)}
              className={`h-8 min-w-[68px] rounded-full px-3 text-[8px] font-black uppercase transition ${
                globalParams.target === target.value ? 'bg-white text-zinc-950' : 'text-white/45 hover:bg-white/10 hover:text-white'
              }`}
            >
              {target.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => updateGlobal('mixMode', !globalParams.mixMode)}
          className={`flex h-10 items-center gap-2 rounded-full border px-5 text-[10px] font-black uppercase transition ${
            globalParams.mixMode ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/10 text-white hover:border-white/35 hover:bg-white/15'
          }`}
        >
          <Zap size={15} />
          Mix
        </button>
      </div>
    </div>
  );

  const renderParamControl = ([key, config]: [string, ParamConfig]) => {
    const value = effectParams[key];
    const label = formatParamLabel(key);

    if (config.type === 'slider') {
      const numericValue = typeof value === 'number' ? value : Number(value) || 0;
      return (
        <div key={key} className="min-w-0 flex-1 basis-[clamp(128px,13vw,216px)]">
          <div className="flex items-center justify-between gap-3 text-[8px] font-black text-white/45">
            <span>{label}</span>
            <span className="tabular-nums text-white/75">{formatParamValue(numericValue, config)}</span>
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
      const isIconSelect = config.options?.every((option) => ['arrow', 'dot', 'square', 'number', 'alphabet', 'triangle', 'hexagon', 'rhombus'].includes(option));
      const hideLabel = key === 'direction';
      return (
        <div key={key} className={isIconSelect ? 'flex min-w-0 flex-1 basis-[clamp(176px,14vw,232px)] items-center' : 'flex min-w-0 flex-1 basis-[clamp(184px,15vw,248px)] flex-col justify-center'}>
          {!isIconSelect && !hideLabel && <div className="mb-2 text-[8px] font-black uppercase text-white/45">{label}</div>}
          <div className="flex rounded-[18px] border border-white/10 bg-black/35 p-1">
            {config.options?.map((option) => (
              <button
                key={option}
                title={`${label}: ${option}`}
                onClick={() => updateEffect(key, option)}
                className={`flex h-8 min-w-0 items-center justify-center rounded-full text-[8px] font-black uppercase transition ${isIconSelect ? 'flex-1 px-2' : 'flex-1 px-2'} ${value === option ? 'bg-white text-zinc-900' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
              >
                {isIconSelect ? renderOptionIcon(option) : option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (config.type === 'color') {
      return (
        <div key={key} className="min-w-0 flex-1 basis-[clamp(128px,12vw,180px)]">
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
        className={`flex h-9 min-w-0 flex-1 basis-[clamp(132px,12vw,168px)] items-center justify-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase transition ${value ? 'border-white bg-white text-zinc-900' : 'border-white/10 bg-white/10 text-white/55 hover:bg-white/20 hover:text-white'}`}
      >
        {value ? <CheckSquare size={14} /> : <Square size={14} />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex w-full flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="h-[76px] max-w-[calc(100vw-25.6px)] overflow-hidden rounded-[18px] border border-white/10 bg-zinc-950/55 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="flex h-full w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {(Object.entries(activeEffect.paramConfig) as [string, ParamConfig][]).map(renderParamControl)}
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
            <div className="flex min-w-[154px] items-center gap-2">
              <span className="w-9 text-right text-[9px] font-black text-white/45">{formatTime(playbackState.currentTime)}</span>
              <input type="range" min="0" max={playbackState.duration || 0} step="0.01" value={Math.min(playbackState.currentTime, playbackState.duration || 0)} onChange={(e) => onSeek(parseFloat(e.target.value))} disabled={!isVideo || !playbackState.duration} className="h-1 w-16 appearance-none rounded-full bg-white/15 accent-white disabled:opacity-30" />
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

      <div className="rounded-[18px] border border-white/10 bg-zinc-950/55 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        {renderEffectMenu()}
      </div>

      <div className="rounded-[18px] border border-white/10 bg-zinc-950/75 p-4 shadow-2xl shadow-black/50 backdrop-blur-2xl">
        {renderGlobalMenu()}
      </div>
    </div>
  );
};

export default ControlPanel;
