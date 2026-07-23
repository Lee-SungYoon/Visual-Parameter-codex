
import React from 'react';
import { GlobalParams, EffectDef, ParamConfig } from '../types';
import { hslToHex } from '../services/utils';
import { 
  CheckSquare, 
  Square, 
  Zap, 
  Target, 
  SlidersHorizontal, 
  MousePointer2, 
  Circle, 
  Square as SquareIcon,
  Hash,
  Type,
  Triangle,
  Hexagon,
  Diamond
} from 'lucide-react';

interface ControlPanelProps {
  globalParams: GlobalParams;
  setGlobalParams: (p: GlobalParams) => void;
  activeEffect: EffectDef;
  effectParams: any;
  setEffectParams: (p: any) => void;
  allEffects: EffectDef[];
  onSelectEffect: (e: EffectDef) => void;
  isVideo: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  globalParams, setGlobalParams, activeEffect, effectParams, setEffectParams, allEffects, onSelectEffect
}) => {
  const updateGlobal = (key: keyof GlobalParams, val: any) => setGlobalParams({ ...globalParams, [key]: val });
  const updateEffect = (key: string, val: any) => setEffectParams({ ...effectParams, [key]: val });

  const handleHSLChange = (key: 'hue' | 'saturation' | 'lightness', val: number) => {
      const nextParams = { ...globalParams, [key]: val };
      const hex = hslToHex(nextParams.hue, nextParams.saturation, nextParams.lightness);
      setGlobalParams({ ...nextParams, effectColor: hex, gradientPreset: 0 });
  };

  const renderOptionContent = (key: string, option: string) => {
    if (key === 'shapeType') {
      if (option === 'arrow') return <MousePointer2 size={12} />;
      if (option === 'dot') return <Circle size={8} className="fill-current" />;
      if (option === 'square') return <SquareIcon size={10} className="fill-current" />;
      if (option === 'number') return <Hash size={12} />;
      if (option === 'alphabet') return <Type size={12} />;
    }
    if (key === 'shape') {
        if (option === 'triangle') return <Triangle size={12} className="fill-current" />;
        if (option === 'hexagon') return <Hexagon size={12} className="fill-current" />;
        if (option === 'rhombus') return <Diamond size={12} className="fill-current" />;
    }
    return option;
  };

  return (
    <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Parameters Panel */}
      <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 px-10 flex flex-col gap-6 shadow-2xl shadow-black/40">
         {/* Effect Selection Tabs - Left Aligned */}
         <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
            {allEffects.map((eff) => (
                <button
                    key={eff.id} onClick={() => onSelectEffect(eff)}
                    className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeEffect.id === eff.id ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                >
                    {eff.name}
                </button>
            ))}
         </div>

         {/* Parameters Horizontal Alignment - Left Aligned */}
         <div className="flex flex-row flex-wrap justify-start items-start gap-x-10 gap-y-6">
             {(Object.entries(activeEffect.paramConfig) as [string, ParamConfig][]).map(([key, config]) => {
                 const isShapeType = key === 'shapeType';
                 const isShowNumbers = key === 'showNumbers';
                 const isNumeric = config.type === 'slider';
                 const isLanguage = key === 'language';

                 return (
                    <div key={key} className={`relative flex flex-col items-start ${isLanguage ? 'min-w-[230px]' : 'min-w-[130px]'}`}>
                        {/* Label Container - Left Aligned */}
                        <div className="h-4 flex items-center justify-start mb-2 w-full">
                            {!isShapeType && !isShowNumbers && (
                                <div className="flex items-center justify-start gap-2 text-[8px] font-black text-white/40 uppercase tracking-widest">
                                    <span>{key}</span>
                                    {isNumeric ? (
                                      <input 
                                        type="number"
                                        step={config.step || 0.1}
                                        min={config.min}
                                        max={config.max}
                                        value={effectParams[key]}
                                        onChange={(e) => updateEffect(key, parseFloat(e.target.value) || 0)}
                                        className="bg-transparent border-none text-white/80 w-12 p-0 focus:outline-none focus:text-white transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-black"
                                      />
                                    ) : (
                                      <span className="text-white/80">{typeof effectParams[key] === 'boolean' ? '' : effectParams[key]}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Control Elements - Left Aligned */}
                        <div className="flex items-center justify-start w-full h-8">
                            {config.type === 'slider' ? (
                                <input 
                                    type="range" 
                                    min={config.min} 
                                    max={config.max} 
                                    step={config.step} 
                                    value={effectParams[key]} 
                                    onChange={(e) => updateEffect(key, parseFloat(e.target.value))} 
                                    className="w-full h-1 bg-white/20 rounded-full appearance-none accent-white cursor-pointer" 
                                />
                            ) : config.type === 'select' ? (
                                <div className="flex w-full gap-1 bg-black/40 p-1 rounded-full border border-white/10 overflow-hidden">
                                    {config.options?.map(o => (
                                        <button
                                            key={o}
                                            onClick={() => updateEffect(key, o)}
                                            className={`flex-1 flex items-center justify-center h-6 rounded-full text-[8px] font-black uppercase transition-all ${effectParams[key] === o ? 'bg-white text-zinc-900' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {renderOptionContent(key, o)}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => updateEffect(key, !effectParams[key])} 
                                    className={`flex items-center justify-start gap-2 px-4 py-2 rounded-full text-[9px] font-bold uppercase transition-all border ${effectParams[key] ? 'bg-white/10 text-white border-white/20' : 'text-white/40 border-transparent hover:text-white'}`}
                                >
                                    {effectParams[key] ? <CheckSquare size={14} className="fill-white text-zinc-900" /> : <Square size={14}/>} 
                                    <span className="ml-1">{key}</span>
                                </button>
                            )}
                        </div>
                    </div>
                 );
             })}
         </div>
      </div>

      {/* Global Toolbar */}
      <div className="flex flex-col gap-2">
          {/* Row 1: Primary Color & State Controls */}
          <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-full p-2 px-10 flex items-center justify-between gap-8 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-6">
                        <SlidersHorizontal size={14} className="text-white/40" />
                        
                        {/* Hue */}
                        <div className="flex flex-col gap-1 w-32">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Hue</span>
                                <input 
                                  type="number" min="0" max="360" value={Math.round(globalParams.hue)}
                                  onChange={(e) => handleHSLChange('hue', parseInt(e.target.value) || 0)}
                                  className="bg-transparent border-none text-white w-8 text-right p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-black"
                                />
                            </div>
                            <input 
                                type="range" min="0" max="360" value={globalParams.hue} 
                                onChange={(e) => handleHSLChange('hue', parseInt(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                            />
                        </div>

                        {/* Saturation */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Sat</span>
                                <input 
                                  type="number" min="0" max="100" value={Math.round(globalParams.saturation)}
                                  onChange={(e) => handleHSLChange('saturation', parseInt(e.target.value) || 0)}
                                  className="bg-transparent border-none text-white w-8 text-right p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-black"
                                />
                            </div>
                            <input 
                                type="range" min="0" max="100" value={globalParams.saturation} 
                                onChange={(e) => handleHSLChange('saturation', parseInt(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10"
                            />
                        </div>

                        {/* Lightness */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Lum</span>
                                <input 
                                  type="number" min="0" max="100" value={Math.round(globalParams.lightness)}
                                  onChange={(e) => handleHSLChange('lightness', parseInt(e.target.value) || 0)}
                                  className="bg-transparent border-none text-white w-8 text-right p-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-black"
                                />
                            </div>
                            <input 
                                type="range" min="0" max="100" value={globalParams.lightness} 
                                onChange={(e) => handleHSLChange('lightness', parseInt(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10"
                            />
                        </div>

                        {/* Color MIX Button */}
                        <button 
                          onClick={() => updateGlobal('colorMix', !globalParams.colorMix)} 
                          className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${globalParams.colorMix ? 'bg-white text-zinc-900 border-white animate-pulse' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                        >
                          Color MIX
                        </button>
                    </div>
                    
                    <div className="h-6 w-px bg-white/10" />

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 ">
                            {[
                              { key: 'bw', label: 'B&W' },
                              { key: 'xray', label: 'Ray' },
                              { key: 'thermal', label: 'Thermal' },
                              { key: 'invert', label: 'Invert' },
                            ].map((f) => (
                              <button 
                                key={f.key}
                                onClick={() => updateGlobal(f.key as keyof GlobalParams, !globalParams[f.key as keyof GlobalParams])} 
                                className={`px-5 py-2 rounded-full text-[9px] font-black transition-all border ${globalParams[f.key as keyof GlobalParams] ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white border-white/10 hover:border-white/40 hover:bg-white/20'}`}
                              >
                                {f.label}
                              </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button 
                      onClick={() => updateGlobal('autoTracking', !globalParams.autoTracking)} 
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[9px] font-black uppercase transition-all border ${globalParams.autoTracking ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
                    >
                      <Target size={14} className={globalParams.autoTracking ? 'text-indigo-400 animate-pulse' : ''}/>
                      Tracking
                    </button>

                    <div className="flex bg-white/10 rounded-full p-1 border border-white/10">
                        {['subject', 'background', 'both'].map(m => (
                            <button 
                              key={m} 
                              onClick={() => updateGlobal('applyTo', m)} 
                              className={`px-6 py-2 rounded-full text-[8px] font-black uppercase transition-all ${globalParams.applyTo === m ? 'bg-white text-zinc-900 border border-white/10 shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                              {m === 'background' ? 'BG' : m}
                            </button>
                        ))}
                    </div>
                    <button 
                      onClick={() => updateGlobal('mixMode', !globalParams.mixMode)} 
                      className={`flex items-center gap-3 px-6 py-2.5 rounded-full text-[9px] font-black uppercase transition-all ${globalParams.mixMode ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
                    >
                      <Zap size={14} className={globalParams.mixMode ? 'animate-pulse text-yellow-400 fill-yellow-400' : ''}/>
                      Mix
                    </button>
                </div>
          </div>

          {/* Row 2: Advanced Post-Processing */}
          <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-full p-2 px-10 flex items-center justify-between gap-8 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-8">
                        <Zap size={12} className="text-white/20" />
                        
                        {/* Exposure */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Exposure</span>
                                <span className="text-white/80">{globalParams.exposure.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" min="-1" max="1" step="0.1" value={globalParams.exposure} 
                                onChange={(e) => updateGlobal('exposure', parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                            />
                        </div>

                        {/* Contrast */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Contrast</span>
                                <span className="text-white/80">{globalParams.contrast.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="2" step="0.1" value={globalParams.contrast} 
                                onChange={(e) => updateGlobal('contrast', parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                            />
                        </div>

                        {/* Vignette */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Vignette</span>
                                <span className="text-white/80">{Math.round(globalParams.vignette * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05" value={globalParams.vignette} 
                                onChange={(e) => updateGlobal('vignette', parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                            />
                        </div>

                        {/* Grain */}
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Grain</span>
                                <span className="text-white/80">{Math.round(globalParams.grain * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05" value={globalParams.grain} 
                                onChange={(e) => updateGlobal('grain', parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                            />
                        </div>

                        {/* Chromatic Aberration */}
                        <div className="flex flex-col gap-1 w-28">
                            <div className="flex justify-between items-center text-[7px] font-black text-white/40 uppercase tracking-widest">
                                <span>Abberation</span>
                                <span className="text-white/80">{globalParams.chromaticAberration}px</span>
                            </div>
                            <input 
                                type="range" min="0" max="10" step="0.5" value={globalParams.chromaticAberration} 
                                onChange={(e) => updateGlobal('chromaticAberration', parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-white cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                      onClick={() => updateGlobal('duotone', !globalParams.duotone)} 
                      className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${globalParams.duotone ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                    >
                      Duotone
                    </button>
                    
                    <div className="h-6 w-px bg-white/10" />

                    <div className="flex items-center gap-1.5">
                        {[
                          { key: 'dramaticWarm', label: 'Warm' },
                          { key: 'dramaticCool', label: 'Cool' }
                        ].map((f) => (
                          <button 
                            key={f.key}
                            onClick={() => updateGlobal(f.key as keyof GlobalParams, !globalParams[f.key as keyof GlobalParams])} 
                            className={`px-5 py-2 rounded-full text-[9px] font-black transition-all border ${globalParams[f.key as keyof GlobalParams] ? 'bg-white text-zinc-900 border-white' : 'bg-white/10 text-white border-white/10 hover:border-white/40 hover:bg-white/20'}`}
                          >
                            {f.label}
                          </button>
                        ))}
                    </div>
                </div>
          </div>
      </div>
    </div>
  );
};

export default ControlPanel;
