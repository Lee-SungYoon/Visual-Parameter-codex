
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { GlobalParams, EffectDef } from '../types';
import { createShaderRenderer, DetectionBox, disposeShaderRenderer, renderShaderFrame } from '../services/webglShaderEngine';
import { ImageSegmenter, FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';

interface CanvasRendererProps {
  mediaSrc: string | null;
  isVideo: boolean;
  activeEffect: EffectDef;
  effectParams: any;
  globalParams: GlobalParams;
  onUpload: (file: File) => void;
  onExportStateChange?: (isExporting: boolean) => void;
  isCleanFeed?: boolean;
}

export interface CanvasRendererHandle {
  startExport: () => void;
}

const CanvasRenderer = forwardRef<CanvasRendererHandle, CanvasRendererProps>(({
  mediaSrc,
  isVideo,
  activeEffect,
  effectParams,
  globalParams,
  onUpload,
  onExportStateChange,
  isCleanFeed = false
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const trackingCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  const shaderRendererRef = useRef<ReturnType<typeof createShaderRenderer>>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(Date.now());
  const lastMaskRef = useRef<ImageData | null>(null);
  const detectionBoxesRef = useRef<DetectionBox[]>([]);
  const frameCountRef = useRef<number>(0);

  const [unitSize, setUnitSize] = useState({ w: 0, h: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportEta, setExportEta] = useState(0);

  const trackingOffsetRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const MIN_PROC_WIDTH = 960;
  const MAX_PROC_WIDTH = 1800;

  useEffect(() => {
    if (isVideo && mediaLoaded && sourceVideoRef.current) {
        const playVideo = async () => {
            try {
                sourceVideoRef.current!.muted = true;
                await sourceVideoRef.current!.play();
            } catch (err) {
                console.warn("Autoplay blocked.");
            }
        };
        playVideo();
    }
  }, [mediaSrc, mediaLoaded, isVideo]);

  useImperativeHandle(ref, () => ({
    startExport: async () => {
      if (!canvasRef.current || !mediaSrc) return;
      const canvas = canvasRef.current;
      const chunks: Blob[] = [];
      
      const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm'
      ];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      
      const recorder = new MediaRecorder((canvas as any).captureStream(60), { 
        mimeType, 
        videoBitsPerSecond: 15000000 // 고화질을 위해 15Mbps로 상향
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `VisualParameter_Master_${Date.now()}.${extension}`;
        a.click();
        
        setIsExporting(false); 
        setExportProgress(0); 
        setExportEta(0); 
        onExportStateChange?.(false);
        
        if (sourceVideoRef.current) {
          sourceVideoRef.current.muted = true;
          sourceVideoRef.current.loop = true; // 다시 루프 활성화
          sourceVideoRef.current.play();
        }
      };

      setIsExporting(true);
      onExportStateChange?.(true);
      let maxProgress = 0;

      if (isVideo && sourceVideoRef.current) {
        const video = sourceVideoRef.current;
        video.pause();
        video.loop = false; // 중요: 렌더링 중에는 루프를 꺼야 진행률이 0으로 돌아가지 않음
        video.currentTime = 0; 
        
        setTimeout(() => {
          video.play();
          recorder.start();
          
          const totalDuration = video.duration;
          const progressInterval = setInterval(() => {
            if (!video.duration) return;
            
            // 현재 진행률 계산 (역행 방지 처리)
            const currentRawProgress = (video.currentTime / totalDuration) * 100;
            maxProgress = Math.max(maxProgress, currentRawProgress);
            
            // 남은 시간 계산 (보다 정확한 소수점 처리)
            const remaining = Math.max(0, totalDuration - video.currentTime);
            
            setExportProgress(Math.min(maxProgress, 99)); // 99%에서 대기하다가 완료 시 100%
            setExportEta(remaining);

            if (video.ended || video.currentTime >= totalDuration - 0.1) {
              setExportProgress(100);
              recorder.stop();
              clearInterval(progressInterval);
            }
          }, 100);
        }, 1000); // 안정적인 시작을 위해 대기 시간 상향
      } else {
        const duration = 5;
        recorder.start();
        const start = Date.now();
        const progressInterval = setInterval(() => {
          const elapsed = (Date.now() - start) / 1000;
          const prog = (elapsed / duration) * 100;
          setExportProgress(Math.min(prog, 100));
          setExportEta(Math.max(0, duration - elapsed));
          if (elapsed >= duration) {
            recorder.stop();
            clearInterval(progressInterval);
          }
        }, 100);
      }
    }
  }));

  useEffect(() => {
    let active = true;
    async function initAI() {
      if (!globalParams.autoTracking) {
        segmenterRef.current?.close();
        segmenterRef.current = null;
        setAiReady(false);
        return;
      }
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
            delegate: "GPU"
          },
          runningMode: isVideo ? "VIDEO" : "IMAGE",
          outputCategoryMask: true
        });
        if (active) { segmenterRef.current = segmenter; setAiReady(true); } else { segmenter.close(); }
      } catch (err) {}
    }
    initAI();
    return () => { active = false; segmenterRef.current?.close(); };
  }, [isVideo, globalParams.autoTracking]);

  useEffect(() => {
    let active = true;
    async function initObjectDetector() {
      if (activeEffect.id !== 'kinetic_avoid') {
        objectDetectorRef.current?.close();
        objectDetectorRef.current = null;
        detectionBoxesRef.current = [];
        return;
      }
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.tflite",
            delegate: "GPU"
          },
          runningMode: isVideo ? "VIDEO" : "IMAGE",
          maxResults: 8,
          scoreThreshold: 0.35
        });
        if (active) {
          objectDetectorRef.current = detector;
        } else {
          detector.close();
        }
      } catch (err) {
        detectionBoxesRef.current = [];
      }
    }
    initObjectDetector();
    return () => {
      active = false;
      objectDetectorRef.current?.close();
      objectDetectorRef.current = null;
    };
  }, [activeEffect.id, isVideo]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;
      if (isCleanFeed && mediaLoaded) {
        const source = isVideo ? sourceVideoRef.current : sourceImageRef.current;
        if (source) {
          const sw = isVideo ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth;
          const sh = isVideo ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight;
          if (sw === 0) return;
          const sAspect = sw / sh;
          const uH = windowH;
          const uW = windowH * sAspect;
          setUnitSize({ w: Math.floor(uW), h: Math.floor(uH) });
          setCanvasSize({ w: windowW, h: windowH });
          return;
        }
      }
      const w = isCleanFeed ? windowW : Math.floor(windowW / 2);
      const h = windowH;
      setUnitSize({ w, h });
      setCanvasSize({ w, h });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isCleanFeed, mediaLoaded, isVideo, mediaSrc]);

  const animate = () => {
    if (canvasRef.current && mediaLoaded && unitSize.w > 0) {
      const displayCtx = canvasRef.current.getContext('2d');
      const internalCanvas = internalCanvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const procW = Math.round(Math.min(MAX_PROC_WIDTH, Math.max(MIN_PROC_WIDTH, unitSize.w * dpr)));
      const scale = procW / unitSize.w;
      const procH = Math.floor(unitSize.h * scale);
      const source = isVideo ? sourceVideoRef.current : sourceImageRef.current;
      if (internalCanvas.width !== procW || internalCanvas.height !== procH) {
        disposeShaderRenderer(shaderRendererRef.current);
        shaderRendererRef.current = null;
        internalCanvas.width = procW;
        internalCanvas.height = procH;
      }
      if (!shaderRendererRef.current) {
        shaderRendererRef.current = createShaderRenderer(internalCanvas);
      }
      if (displayCtx && source && shaderRendererRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          frameCountRef.current++;
          const shouldUpdateMask = globalParams.autoTracking && segmenterRef.current && (!isVideo || frameCountRef.current % 6 === 0);
          if (shouldUpdateMask) {
              try {
                const result = isVideo 
                  ? segmenterRef.current!.segmentForVideo(source as HTMLVideoElement, Date.now()) 
                  : segmenterRef.current!.segment(source as HTMLImageElement);
                if (result?.categoryMask) {
                   const maskData = result.categoryMask.getAsUint8Array();
                   const mw = result.categoryMask.width; const mh = result.categoryMask.height;
                   let sumX = 0; let sumY = 0; let count = 0;
                   for (let i = 0; i < maskData.length; i++) {
                      if (maskData[i] > 0) { sumX += i % mw; sumY += Math.floor(i / mw); count++; }
                   }
                   if (count > 100) {
                       const centerX = (sumX / count) / mw; const centerY = (sumY / count) / mh;
                       const targetX = (0.5 - centerX) * procW * 0.5; const targetY = (0.5 - centerY) * procH * 0.5;
                       const areaFraction = count / (mw * mh);
                       const targetScale = 1.1 + Math.max(0, (0.25 - areaFraction) * 1.5);
                       trackingOffsetRef.current.x += (targetX - trackingOffsetRef.current.x) * 0.08;
                       trackingOffsetRef.current.y += (targetY - trackingOffsetRef.current.y) * 0.08;
                       trackingOffsetRef.current.scale += (targetScale - trackingOffsetRef.current.scale) * 0.05;
                   }
                   result.categoryMask.close();
                }
              } catch (e) {}
          } else if (!globalParams.autoTracking) {
              trackingOffsetRef.current.x *= 0.9;
              trackingOffsetRef.current.y *= 0.9;
              trackingOffsetRef.current.scale += (1.0 - trackingOffsetRef.current.scale) * 0.1;
          }
          if (activeEffect.id === 'kinetic_avoid' && objectDetectorRef.current && (!isVideo || frameCountRef.current % 10 === 0)) {
            try {
              const result = isVideo
                ? objectDetectorRef.current.detectForVideo(source as HTMLVideoElement, Date.now())
                : objectDetectorRef.current.detect(source as HTMLImageElement);
              const sourceW = isVideo ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth;
              const sourceH = isVideo ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight;
              detectionBoxesRef.current = result.detections
                .map((d) => d.boundingBox)
                .filter((box): box is NonNullable<typeof box> => Boolean(box))
                .map((box) => ({
                  x: Math.max(0, Math.min(1, box.originX / sourceW)),
                  y: Math.max(0, Math.min(1, box.originY / sourceH)),
                  width: Math.max(0, Math.min(1, box.width / sourceW)),
                  height: Math.max(0, Math.min(1, box.height / sourceH)),
                }));
            } catch (e) {}
          } else if (activeEffect.id !== 'kinetic_avoid') {
            detectionBoxesRef.current = [];
          }
          renderShaderFrame(shaderRendererRef.current, source, activeEffect.id, effectParams, globalParams, elapsed, detectionBoxesRef.current);
          displayCtx.clearRect(0, 0, canvasSize.w, canvasSize.h);
          displayCtx.save();
          if (trackingOffsetRef.current.scale > 1.01) {
            displayCtx.translate(trackingOffsetRef.current.x / scale, trackingOffsetRef.current.y / scale);
            displayCtx.translate(canvasSize.w / 2, canvasSize.h / 2);
            displayCtx.scale(trackingOffsetRef.current.scale, trackingOffsetRef.current.scale);
            displayCtx.translate(-canvasSize.w / 2, -canvasSize.h / 2);
          }
          if (isCleanFeed) {
            const centerX = canvasSize.w / 2;
            const unitW = unitSize.w;
            const unitH = unitSize.h;
            const centralStartX = centerX - unitW / 2;
            let currentX = centralStartX;
            while (currentX + unitW > 0) {
              displayCtx.drawImage(internalCanvas, 0, 0, procW, procH, currentX, 0, unitW, unitH);
              currentX -= unitW;
            }
            currentX = centralStartX + unitW;
            while (currentX < canvasSize.w) {
              displayCtx.drawImage(internalCanvas, 0, 0, procW, procH, currentX, 0, unitW, unitH);
              currentX += unitW;
            }
            displayCtx.drawImage(internalCanvas, 0, 0, procW, procH, centralStartX, 0, unitW, unitH);
          } else {
            displayCtx.drawImage(internalCanvas, 0, 0, procW, procH, 0, 0, unitSize.w, unitSize.h);
          }
          displayCtx.restore();
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(requestRef.current!);
      disposeShaderRenderer(shaderRendererRef.current);
      shaderRendererRef.current = null;
    };
  }, [activeEffect, effectParams, globalParams, mediaLoaded, canvasSize, unitSize, aiReady]);

  if (isCleanFeed) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden" ref={containerRef}>
        {mediaSrc && isVideo && (
            <video ref={sourceVideoRef} src={mediaSrc} className="hidden" muted loop playsInline autoPlay onLoadedMetadata={() => setMediaLoaded(true)} />
        )}
        {mediaSrc && !isVideo && (
            <img ref={sourceImageRef} src={mediaSrc} className="hidden" onLoad={() => setMediaLoaded(true)} />
        )}
        <canvas 
          ref={canvasRef} 
          width={canvasSize.w} 
          height={canvasSize.h} 
          style={{ width: canvasSize.w, height: canvasSize.h }}
          className="shadow-2xl"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-white" ref={containerRef}>
      {isExporting && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white p-10 select-none">
          <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
            {/* Progress Circle Decoration */}
            <div className="absolute inset-0 border-[8px] border-white/5 rounded-full"></div>
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="96" cy="96" r="88" stroke="white" strokeWidth="8" fill="transparent" 
                strokeDasharray={553} 
                strokeDashoffset={553 - (553 * exportProgress) / 100} 
                strokeLinecap="round" 
                className="transition-all duration-500 ease-out" 
              />
            </svg>
            <div className="flex flex-col items-center">
               <span className="text-[44px] font-black leading-none tabular-nums">{Math.floor(exportProgress)}%</span>
               <span className="text-[10px] font-bold text-white/40 mt-3 tracking-[0.3em] uppercase">Processing</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-[18px] font-black uppercase tracking-[0.5em] animate-pulse">Rendering H.264 Master</span>
            
            <div className="flex items-center gap-12 mt-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Remaining</span>
                  <span className="text-[20px] font-mono font-bold text-white tracking-wider tabular-nums">
                    {exportEta.toFixed(1)}<span className="text-[12px] ml-1">SEC</span>
                  </span>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Status</span>
                  <span className="text-[14px] font-bold text-indigo-400 tracking-widest uppercase">Recording</span>
                </div>
            </div>
          </div>

          <div className="mt-16 max-w-md w-full px-4">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_20px_rgba(255,255,255,0.6)]" style={{ width: `${exportProgress}%` }}></div>
            </div>
          </div>
          
          <p className="mt-10 text-[10px] font-bold text-white/20 uppercase tracking-[0.25em] max-w-sm text-center leading-loose">
            High-Quality Realtime Capture. <br/> 
            The render time is exactly proportional to the video length. <br/>
            Please wait until the process is 100% complete.
          </p>
        </div>
      )}
      
      <div 
        className={`relative w-1/2 h-full flex items-center justify-center transition-opacity duration-700 ${isDragging ? 'opacity-50' : 'opacity-100'}`}
        onDragOver={(e) => {e.preventDefault(); setIsDragging(true);}}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) onUpload(e.dataTransfer.files[0]);}}
      >
        {!mediaSrc && (
          <div className="flex flex-col items-center gap-4 text-zinc-100 pointer-events-none">
             <span className="text-[9px] font-black uppercase tracking-[0.4em]">Initialize_Input (Drop File)</span>
          </div>
        )}
        {mediaSrc && isVideo && (
            <video ref={sourceVideoRef} src={mediaSrc} className="w-full h-full object-cover" muted loop playsInline autoPlay onLoadedMetadata={() => setMediaLoaded(true)} />
        )}
        {mediaSrc && !isVideo && (
            <img ref={sourceImageRef} src={mediaSrc} className="w-full h-full object-cover" onLoad={() => setMediaLoaded(true)} />
        )}
      </div>

      <div className="relative w-1/2 h-full bg-white flex items-center justify-center">
        <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h} className={`w-full h-full transition-all duration-1000 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`} />
      </div>
    </div>
  );
});

export default CanvasRenderer;
