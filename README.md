# Visual-Parameter-codex

업로드한 이미지와 영상을 WebGL 셰이더 기반으로 실시간 변형하는 제너러티브 비주얼 앱입니다.

Vortex, Kaleido, Geometry, Pixel, Halftone, Matrix, Glitch 같은 효과를 GPU fragment shader로 처리해 부드럽게 적용하며, 색상 믹스, 노출, 대비, 비네트, 그레인, 반전/열화상 스타일 보정도 함께 조절할 수 있습니다. `KINETIC AVOID` 메뉴는 MediaPipe 오브젝트 인식으로 업로드 영상 속 오브젝트 위치를 감지하고, 작은 키네틱 블록들이 감지 영역을 피해 흐르는 전시형 효과를 만듭니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run lint
npm run build
```
