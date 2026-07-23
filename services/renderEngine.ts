
import { EffectId, GlobalParams } from '../types';

const CHAR_SETS = {
    en: 'abcdefghijklmnopqrstuvwxyz0123456789',
    jp: 'あいうえおかきくけ코サシス세소12345',
    kr: '가나다라마바사아자차카타파하12345',
    cn: '你好世界数字代码计算机数据',
    ar: 'ابجديةعربية١٢٣٤٥',
    numbers: '0123456789'
};

const drawVortex = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
    const ringCount = params.ringCount || 12;
    const speed = params.rotationSpeed || 1;
    const sides = params.shapeSides || 6;
    const complexity = params.complexity || 0.5;
    const expansion = params.expansion || 1.2;

    ctx.strokeStyle = style;
    ctx.lineWidth = 1;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width * width + height * height) * 0.5 * expansion;

    for (let i = 0; i < ringCount; i++) {
        const t = i / ringCount;
        const radius = t * maxRadius;
        const rotation = time * speed * (1 + t * complexity);
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        
        ctx.beginPath();
        for (let s = 0; s < sides; s++) {
            const angle = (s / sides) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.stroke();
        
        // Add technical markers
        if (i % 4 === 0) {
            ctx.font = '8px monospace';
            ctx.fillStyle = style;
            ctx.fillText(`R:${Math.floor(radius)} θ:${(rotation % (Math.PI * 2)).toFixed(2)}`, radius + 5, 0);
        }
        
        ctx.restore();
    }
};

const drawKaleido = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, time: number) => {
    const segments = params.segments || 8;
    const radius = Math.min(width, height) * (params.radius || 0.8);
    const rotation = params.rotation || 0;
    const zoom = params.zoom || 1.5;
    const mirror = params.mirror !== undefined ? params.mirror : true;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(ctx.canvas, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotation + time * 0.2);

    const angleStep = (Math.PI * 2) / segments;

    for (let i = 0; i < segments; i++) {
        ctx.save();
        ctx.rotate(i * angleStep);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, -angleStep / 2, angleStep / 2);
        ctx.closePath();
        ctx.clip();

        if (mirror && i % 2 === 1) {
            ctx.scale(1, -1);
        }

        const s = zoom;
        ctx.drawImage(offscreen, -width / 2 * s, -height / 2 * s, width * s, height * s);
        
        ctx.restore();
    }
    ctx.restore();
};

const drawGeometry = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
    const gridSize = params.gridSize || 25;
    const recursive = params.recursive || 2;
    const wireframe = params.wireframe || false;
    const shapeType = params.shape || 'triangle';
    const displacement = params.displacement || 15;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = style;
    ctx.fillStyle = style;
    ctx.lineWidth = 0.5;

    const drawRecursiveShape = (x: number, y: number, size: number, depth: number) => {
        if (depth <= 0) {
            const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
            const lum = (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]) / 255;
            const d = lum * displacement;
            
            ctx.beginPath();
            if (shapeType === 'triangle') {
                ctx.moveTo(x, y - size - d);
                ctx.lineTo(x - size - d, y + size);
                ctx.lineTo(x + size + d, y + size);
            } else if (shapeType === 'hexagon') {
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const r = size + d;
                    const px = x + Math.cos(angle) * r;
                    const py = y + Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
            } else { // rhombus
                ctx.moveTo(x, y - size - d);
                ctx.lineTo(x + size + d, y);
                ctx.lineTo(x, y + size + d);
                ctx.lineTo(x - size - d, y);
            }
            ctx.closePath();
            
            if (wireframe) {
                ctx.stroke();
            } else if (lum > 0.3) {
                ctx.globalAlpha = lum * 0.8;
                ctx.fill();
            }
            return;
        }

        const half = size / 2;
        drawRecursiveShape(x - half, y - half, half, depth - 1);
        drawRecursiveShape(x + half, y - half, half, depth - 1);
        drawRecursiveShape(x - half, y + half, half, depth - 1);
        drawRecursiveShape(x + half, y + half, half, depth - 1);
    };

    for (let y = gridSize; y < height; y += gridSize * 2) {
        for (let x = gridSize; x < width; x += gridSize * 2) {
            drawRecursiveShape(x, y, gridSize, recursive);
        }
    }
    ctx.globalAlpha = 1.0;
};

const getChar = (lang: string, onlyNumbers: boolean = false) => {
    let charset = CHAR_SETS.en;
    if (onlyNumbers) {
        charset = CHAR_SETS.numbers;
    } else if (lang === 'random') {
        const keys = Object.keys(CHAR_SETS).filter(k => k !== 'numbers');
        charset = CHAR_SETS[keys[Math.floor(Math.random() * keys.length)] as keyof typeof CHAR_SETS];
    } else {
        charset = CHAR_SETS[lang as keyof typeof CHAR_SETS] || CHAR_SETS.en;
    }
    return charset[Math.floor(Math.random() * charset.length)];
};

const drawArrowCursor = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(x, y);
    ctx.scale(size / 10, size / 10);
    ctx.rotate(-Math.PI / 8); 
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(4, 11);
    ctx.lineTo(7, 17);
    ctx.lineTo(9, 16);
    ctx.lineTo(6, 10);
    ctx.lineTo(11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

const getEffectStyle = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string, presetIdx: number) => {
    if (presetIdx === 0) return color;
    const presets = [
        null,
        ['#ff00ff', '#00ffff'],
        ['#ff5f6d', '#ffc371'],
        ['#11998e', '#38ef7d'],
        ['#2193b0', '#6dd5ed'],
        ['#6441A5', '#2a0845']
    ];
    const colors = presets[presetIdx];
    if (!colors) return color;
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    return grad;
};

const drawPixel = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, time: number) => {
  const baseSize = params.pixelSize || 8;
  const variance = params.sizeVariance || 0;
  const wave = (Math.sin(time * 5.0) + Math.sin(time * 2.3) * 0.5) / 1.5;
  const maxSteps = 5;
  const currentStep = Math.round(wave * (variance * maxSteps));
  const offset = currentStep * 4;
  let size = baseSize + offset;
  size = Math.max(4, Math.round(size / 4) * 4);
  const w = Math.ceil(width / size);
  const h = Math.ceil(height / size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, w, h);
  ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, width, height);
};

const drawHalftone = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
  const dotSize = Math.max(2, params.dotSize);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = style;
  ctx.imageSmoothingEnabled = true;
  const randParam = params.dotSizeRandom || 0;
  const slowTime = time * 1.5; 

  for (let y = 0; y < height; y += dotSize) {
    for (let x = 0; x < width; x += dotSize) {
      const i = (Math.floor(y) * width + Math.floor(x)) * 4;
      if (i < len) {
        const lum = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 255;
        const noise = Math.sin(slowTime + (x * 0.05) + (y * 0.03)) * 0.5 + 0.5;
        const rFactor = 1 - (noise * randParam);
        const radius = (dotSize * 0.5) * lum * rFactor;
        if (radius > 0.5) {
          ctx.beginPath();
          ctx.arc(x + dotSize * 0.5, y + dotSize * 0.5, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
};

const matrixCols: { x: number, y: number, speed: number, lastUpdate: number }[] = [];

const drawMatrix = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
    ctx.fillStyle = style;
    ctx.imageSmoothingEnabled = true;
    const fSize = params.fontSize || 10;
    const charSpacingX = fSize * 0.6; 
    const charSpacingY = fSize * 0.5; 
    ctx.font = `bold ${fSize}px monospace`;
    
    const requiredCols = Math.floor(width / charSpacingX) + 1;
    
    if (matrixCols.length !== requiredCols) {
        matrixCols.length = 0;
        for (let i = 0; i < requiredCols; i++) {
            matrixCols.push({
                x: i * charSpacingX,
                y: Math.random() * height,
                speed: (0.5 + Math.random()) * (params.fallSpeed * 5),
                lastUpdate: time
            });
        }
    }

    const tailLength = 15;
    const densityThreshold = 1 - (params.density / 500);

    matrixCols.forEach((col, i) => {
        const deltaTime = 0.016;
        col.y = (col.y + col.speed * deltaTime) % height;
        const columnSeed = (i * 123.456) % 1;
        if (columnSeed > densityThreshold) {
            for (let j = 0; j < tailLength; j++) {
                const charY = (col.y - j * charSpacingY + height) % height;
                const alpha = Math.pow(0.85, j); 
                ctx.globalAlpha = j === 0 ? 1 : alpha * 0.7;
                const char = getChar(params.language, params.showNumbers);
                ctx.fillText(char, col.x, charY);
            }
        }
    });
    ctx.globalAlpha = 1;
};

// 실시간 픽셀 소팅 글리치 로직 (두께 지원 강화 버전)
const drawGlitch = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
    const density = params.density || 45;
    const maxSize = params.size || 350;
    const thickness = Math.max(1, Math.floor(params.thickness || 8));
    const threshold = params.threshold || 80;
    
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const getLum = (idx: number) => (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);

    for (let i = 0; i < density; i++) {
        // 무작위 기준 행 선택
        const startY = Math.floor(Math.random() * (height - thickness));
        let startX = Math.floor(Math.random() * (width * 0.7));
        const currentSize = Math.floor(Math.random() * maxSize) + 20;
        const endX = Math.min(startX + currentSize, width);

        // 두께(Thickness)만큼 반복하여 블록 단위 소팅 수행
        for (let t = 0; t < thickness; t++) {
            const y = startY + t;
            const pixels: {r: number, g: number, b: number, a: number, lum: number}[] = [];
            
            for (let targetX = startX; targetX < endX; targetX++) {
                const idx = (y * width + targetX) * 4;
                const lum = getLum(idx);
                
                if (lum > threshold) {
                    pixels.push({
                        r: data[idx],
                        g: data[idx+1],
                        b: data[idx+2],
                        a: data[idx+3],
                        lum: lum
                    });
                }
            }

            // 명도순 정렬
            pixels.sort((a, b) => b.lum - a.lum);

            // 데이터 갱신
            for (let j = 0; j < pixels.length; j++) {
                const idx = (y * width + startX + j) * 4;
                data[idx] = pixels[j].r;
                data[idx+1] = pixels[j].g;
                data[idx+2] = pixels[j].b;
                data[idx+3] = pixels[j].a;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    
    // 색수차 효과 (간헐적으로 발생시켜 긴장감 유지)
    if (time % 0.3 > 0.25) { 
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.4;
        const shift = 4 + Math.sin(time * 10) * 4;
        ctx.drawImage(ctx.canvas, shift, 0);
        ctx.restore();
    }
};

const plexusParticles: {x: number, y: number, vx: number, vy: number, noise: number, id: string, sizeFactor: number, char: string}[] = [];

const drawPlexus = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, mask: ImageData | null, time: number) => {
  const count = params.pointCount;
  const linkDistSq = params.linkDistance * params.linkDistance;
  const shape = params.shapeType || 'square';
  const alphabets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  ctx.imageSmoothingEnabled = true;
  
  const getSpawn = () => {
    for(let k=0; k<20; k++) {
        const rx = Math.random() * width; const ry = Math.random() * height;
        if (mask) {
            const mx = Math.floor((rx/width)*mask.width); const my = Math.floor((ry/height)*mask.height);
            const midx = (my * mask.width + mx) * 4;
            if (mask.data[midx] > 128) return {x: rx, y: ry};
        } else return {x: rx, y: ry};
    }
    return {x: Math.random() * width, y: Math.random() * height};
  };

  if (plexusParticles.length !== count) {
    plexusParticles.length = 0;
    for(let i=0; i<count; i++) {
        const p = getSpawn();
        const baseSpeed = 0.5;
        plexusParticles.push({ 
            ...p, 
            vx: (Math.random()-0.5)*baseSpeed, 
            vy: (Math.random()-0.5)*baseSpeed, 
            noise: Math.random()*100, 
            id: Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
            sizeFactor: 0.5 + Math.random(),
            char: alphabets[Math.floor(Math.random() * alphabets.length)]
        });
    }
  }

  ctx.strokeStyle = style;
  ctx.fillStyle = style;

  for(let i=0; i<count; i++) {
    const p = plexusParticles[i];
    p.x += p.vx; p.y += p.vy;
    let needsReset = false;
    if (mask) {
        const mx = Math.floor((p.x/width)*mask.width); const my = Math.floor((p.y/height)*mask.height);
        const midx = (my * mask.width + mx) * 4;
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || (mask.data && mask.data[midx] < 128)) needsReset = true;
    } else {
        if (p.x < 0 || p.x > width) p.vx *= -1; if (p.y < 0 || p.y > height) p.vy *= -1;
    }
    if (needsReset) { const s = getSpawn(); p.x = s.x; p.y = s.y; }
    
    const rx = p.x + Math.sin(time + p.noise)*params.jitter;
    const ry = p.y + Math.cos(time + p.noise)*params.jitter;

    for(let j=i+1; j<Math.min(i+15, count); j++) {
        const p2 = plexusParticles[j];
        const p2rx = p2.x + Math.sin(time + p2.noise)*params.jitter;
        const p2ry = p2.y + Math.cos(time + p2.noise)*params.jitter;
        const dx = rx - p2rx; const dy = ry - p2ry;
        const d2 = dx*dx + dy*dy;
        if (d2 < linkDistSq) {
            const alpha = 1 - (d2/linkDistSq);
            ctx.globalAlpha = alpha * 0.7;
            ctx.lineWidth = params.lineWidth * (1.5 - (d2/linkDistSq));
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(p2rx, p2ry);
            ctx.stroke();
        }
    }
    
    ctx.globalAlpha = 1.0;
    const pSize = params.pointSize * (1 + (p.sizeFactor - 1) * params.pointSizeRandom);
    
    if (shape === 'dot') {
        ctx.beginPath();
        ctx.arc(rx, ry, pSize / 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (shape === 'number') {
        ctx.font = `bold ${pSize * 1.5}px monospace`;
        ctx.fillText(p.id[0], rx - pSize/2, ry + pSize/2);
    } else if (shape === 'alphabet') {
        ctx.font = `bold ${pSize * 1.5}px monospace`;
        ctx.fillText(p.char, rx - pSize/2, ry + pSize/2);
    } else if (shape === 'arrow') {
        drawArrowCursor(ctx, rx, ry, pSize * 1.5);
    } else {
        ctx.fillRect(rx - pSize / 2, ry - pSize / 2, pSize, pSize);
    }

    if (i % 12 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.5;
        const chSize = pSize * 5;
        ctx.beginPath();
        ctx.moveTo(rx - chSize, ry); ctx.lineTo(rx + chSize, ry);
        ctx.moveTo(rx, ry - chSize); ctx.lineTo(rx, ry + chSize);
        ctx.stroke();
        ctx.restore();
    }

    if (params.showNumbers) {
        ctx.save();
        ctx.font = 'bold 8px monospace';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`ID:${p.id}`, rx + 8, ry - 8);
        ctx.restore();
    }
  }
  ctx.globalAlpha = 1.0;
};

const drawLine = (ctx: CanvasRenderingContext2D, width: number, height: number, params: any, style: string | CanvasGradient, time: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const bgData = new Uint8ClampedArray(data);
    ctx.imageSmoothingEnabled = true;
    
    for (let i = 0; i < bgData.length; i += 4) {
        bgData[i] = 255 - data[i];
        bgData[i+1] = 255 - data[i+1];
        bgData[i+2] = 255 - data[i+2];
    }
    ctx.putImageData(new ImageData(bgData, width, height), 0, 0);

    ctx.fillStyle = style;
    const r = params.dotRandom || 0;
    const step = 4; 
    const threshold = params.threshold;
    const cSize = params.dotSize || 2.5;
    const shape = params.shapeType || 'arrow';
    const alphabets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const slowTime = time * 0.8; 

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            const iNext = (y * width + (x+1)) * 4;
            if (iNext < data.length) {
                const l1 = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
                const l2 = (0.299 * data[iNext] + 0.587 * data[iNext+1] + 0.114 * data[iNext+2]);
                
                if (Math.abs(l1 - l2) > threshold) {
                    const noise = Math.sin(slowTime + (x * 0.04) + (y * 0.04)) * 0.5 + 0.5;
                    const finalSize = cSize * (1.5 + noise * r * 4); 
                    
                    if (shape === 'dot') {
                        ctx.beginPath();
                        ctx.arc(x, y, finalSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (shape === 'square') {
                        ctx.fillRect(x - finalSize/2, y - finalSize/2, finalSize, finalSize);
                    } else if (shape === 'number') {
                        ctx.font = `bold ${finalSize * 1.5}px monospace`;
                        const num = Math.floor((slowTime * 5 + x + y) % 10);
                        ctx.fillText(num.toString(), x, y);
                    } else if (shape === 'alphabet') {
                        ctx.font = `bold ${finalSize * 1.5}px monospace`;
                        const charIdx = Math.floor((slowTime * 4 + x + y) % alphabets.length);
                        ctx.fillText(alphabets[charIdx], x, y);
                    } else {
                        drawArrowCursor(ctx, x, y, finalSize);
                    }
                }
            }
        }
    }
};

const applyEnhancedColorEffects = (ctx: CanvasRenderingContext2D, width: number, height: number, global: GlobalParams, time: number) => {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const len = d.length;
    
    // Exposure and Contrast
    const exposureFactor = Math.pow(2, global.exposure);
    const contrastFactor = global.contrast;
    
    // Duotone preparations
    let color1R = 0, color1G = 0, color1B = 0;
    let color2R = 0, color2G = 0, color2B = 0;
    if (global.duotone) {
        // Use global effect color as high point
        const hex = global.effectColor.replace('#', '');
        color1R = parseInt(hex.substring(0, 2), 16);
        color1G = parseInt(hex.substring(2, 4), 16);
        color1B = parseInt(hex.substring(4, 6), 16);
        // Use a much darker version or black for low point
        color2R = color1R * 0.1;
        color2G = color1G * 0.1;
        color2B = color1B * 0.1;
    }

    for (let i = 0; i < len; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];

        // Exposure
        r *= exposureFactor;
        g *= exposureFactor;
        b *= exposureFactor;

        // Contrast
        r = (r / 255 - 0.5) * contrastFactor + 0.5;
        g = (g / 255 - 0.5) * contrastFactor + 0.5;
        b = (b / 255 - 0.5) * contrastFactor + 0.5;
        r *= 255; g *= 255; b *= 255;

        // B&W after exposure/contrast for better range
        if (global.bw) {
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = l;
        }

        // Duotone
        if (global.duotone) {
            const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            r = color2R + l * (color1R - color2R);
            g = color2G + l * (color1G - color2G);
            b = color2B + l * (color1B - color2B);
        }

        // Thermal / Xray / etc (existing logic slightly improved)
        if (global.xray) { r = 255 - r; g = 255 - g; b = 255 - b; }
        if (global.thermal) {
            const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (l < 0.33) { r = 0; g = 0; b = l * 765; }
            else if (l < 0.66) { r = (l - 0.33) * 765; g = 255; b = 255 - (l - 0.33) * 765; }
            else { r = 255; g = 255 - (l - 0.66) * 765; b = 0; }
        }
        if (global.dramaticWarm) { r *= 1.15; b *= 0.85; }
        if (global.dramaticCool) { r *= 0.85; b *= 1.15; }
        if (global.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }

        d[i] = Math.min(255, Math.max(0, r));
        d[i+1] = Math.min(255, Math.max(0, g));
        d[i+2] = Math.min(255, Math.max(0, b));
    }

    ctx.putImageData(img, 0, 0);

    // Chromatic Aberration (Channel shifting)
    if (global.chromaticAberration > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const shift = global.chromaticAberration;
        
        // Use temporary canvas for shifts
        const temp = document.createElement('canvas');
        temp.width = width; temp.height = height;
        const tctx = temp.getContext('2d')!;
        tctx.drawImage(ctx.canvas, 0, 0);

        ctx.clearRect(0, 0, width, height);
        
        // Red shift
        ctx.globalAlpha = 1.0;
        ctx.drawImage(temp, shift, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, width, height);

        // Green/Blue original or slightly shifted
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(temp, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(0, 0, width, height);
        
        ctx.restore();
    }

    // Vignette
    if (global.vignette > 0) {
        const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.sqrt(width*width + height*height)/2);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, `rgba(0,0,0,${global.vignette})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    // Grain
    if (global.grain > 0) {
        ctx.save();
        const grainIntensity = global.grain * 0.15;
        for (let i = 0; i < 5000 * global.grain; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const val = Math.random() * 255;
            ctx.fillStyle = `rgba(${val},${val},${val},${grainIntensity})`;
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.restore();
    }
};

export const renderFrame = (ctx: CanvasRenderingContext2D, source: HTMLImageElement | HTMLVideoElement, effectId: EffectId, params: any, global: GlobalParams, time: number, aiMask?: ImageData | null) => {
    const width = ctx.canvas.width; const height = ctx.canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;

    const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    const sAspect = sw / sh; const dAspect = width / height;
    let drawW, drawH, drawX, drawY;
    if (sAspect > dAspect) { drawH = height; drawW = height * sAspect; drawX = (width - drawW) / 2; drawY = 0; }
    else { drawW = width; drawH = width / sAspect; drawX = 0; drawY = (height - drawH) / 2; }
    
    ctx.drawImage(source, drawX, drawY, drawW, drawH);
    applyEnhancedColorEffects(ctx, width, height, global, time);

    if (effectId === 'none') return;

    let filteredBgSnapshot: ImageData | null = null;
    if (global.applyTo !== 'both') {
        filteredBgSnapshot = ctx.getImageData(0, 0, width, height);
    }

    const effectCanvas = document.createElement('canvas');
    effectCanvas.width = width; effectCanvas.height = height;
    const effectCtx = effectCanvas.getContext('2d')!;
    effectCtx.imageSmoothingEnabled = true;
    effectCtx.drawImage(ctx.canvas, 0, 0);

    const style = getEffectStyle(effectCtx, width, height, global.effectColor, global.gradientPreset);

    switch(effectId) {
        case 'vortex': drawVortex(effectCtx, width, height, params, style, time); break;
        case 'kaleido': drawKaleido(effectCtx, width, height, params, time); break;
        case 'geometry': drawGeometry(effectCtx, width, height, params, style, time); break;
        case 'pixel': drawPixel(effectCtx, width, height, params, time); break;
        case 'halftone': drawHalftone(effectCtx, width, height, params, style, time); break;
        case 'matrix': drawMatrix(effectCtx, width, height, params, style, time); break;
        case 'glitch': drawGlitch(effectCtx, width, height, params, style, time); break;
        case 'plexus': drawPlexus(effectCtx, width, height, params, style, aiMask || null, time); break;
        case 'line': drawLine(effectCtx, width, height, params, style, time); break;
    }

    if (global.applyTo !== 'both' && aiMask && filteredBgSnapshot) {
        const effectImg = effectCtx.getImageData(0, 0, width, height);
        const out = ctx.createImageData(width, height);
        const ed = effectImg.data;
        const bd = filteredBgSnapshot.data;
        const od = out.data;
        const mw = aiMask.width; const mh = aiMask.height; const md = aiMask.data;

        for(let y=0; y<height; y++) {
            const rowIdx = y * width;
            const mRowIdx = Math.floor((y/height)*mh) * mw;
            for(let x=0; x<width; x++) {
                const i = (rowIdx + x) * 4;
                const mi = (mRowIdx + Math.floor((x/width)*mw)) * 4;
                const isSub = md[mi] > 128;
                const useEffect = global.applyTo === 'subject' ? isSub : !isSub;
                if (useEffect) { od[i]=ed[i]; od[i+1]=ed[i+1]; od[i+2]=ed[i+2]; od[i+3]=255; }
                else { od[i]=bd[i]; od[i+1]=bd[i+1]; od[i+2]=bd[i+2]; od[i+3]=255; }
            }
        }
        ctx.putImageData(out, 0, 0);
    } else {
        ctx.drawImage(effectCanvas, 0, 0);
    }
};
