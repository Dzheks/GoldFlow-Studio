/**
 * Procedural visual generator for video scenes and thumbnails
 * Draws rich atmospheric visuals directly to Canvas without external broken image dependencies
 */

export interface RenderFrameOptions {
  sceneId: number;
  title: string;
  subtitle?: string;
  timeSec: number;
  durationSec: number;
  motionType: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
  transitionProgress?: number; // 0 to 1 during transition
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  styleTheme?: string;
  activeSubtitle?: string;
  stickerOverlay?: string;
  imageUrl?: string;
  inFrameCaption?: string;
}

const imageCache = new Map<string, HTMLImageElement>();

export function drawProceduralScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: RenderFrameOptions
) {
  const { sceneId, timeSec, durationSec, motionType, transitionProgress, activeSubtitle, stickerOverlay, imageUrl } = options;
  const progress = Math.max(0, Math.min(1, timeSec / Math.max(0.1, durationSec)));

  ctx.save();

  // Motion transform (Ken Burns effect)
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;

  if (motionType === 'zoom-in') {
    scale = 1.0 + progress * 0.18;
  } else if (motionType === 'zoom-out') {
    scale = 1.2 - progress * 0.18;
  } else if (motionType === 'pan-left') {
    scale = 1.15;
    translateX = (progress - 0.5) * 40;
  } else if (motionType === 'pan-right') {
    scale = 1.15;
    translateX = (0.5 - progress) * 40;
  }

  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2 + translateX, -height / 2 + translateY);

  let drawnImage = false;
  if (imageUrl) {
    let img = imageCache.get(imageUrl);
    if (!img) {
      img = new Image();
      img.src = imageUrl;
      imageCache.set(imageUrl, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, width, height);
      drawnImage = true;
    }
  }

  if (!drawnImage) {
    // Background gradient based on scene id
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      50,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.85
    );

    switch (sceneId % 6) {
      case 1: // Atmospheric dusk city
        grad.addColorStop(0, '#382414');
        grad.addColorStop(0.5, '#1e140d');
        grad.addColorStop(1, '#0b0805');
        break;
      case 2: // Mahogany dark office
        grad.addColorStop(0, '#2d1f14');
        grad.addColorStop(0.5, '#15100c');
        grad.addColorStop(1, '#080605');
        break;
      case 3: // Cold neon & ledger table
        grad.addColorStop(0, '#1c2834');
        grad.addColorStop(0.5, '#101720');
        grad.addColorStop(1, '#060a0f');
        break;
      case 4: // Golden antique clock
        grad.addColorStop(0, '#42280d');
        grad.addColorStop(0.5, '#221406');
        grad.addColorStop(1, '#0a0703');
        break;
      case 5: // Wet asphalt street
        grad.addColorStop(0, '#26282b');
        grad.addColorStop(0.5, '#15171a');
        grad.addColorStop(1, '#0a0a0c');
        break;
      default: // Amber mystery
        grad.addColorStop(0, '#3a1f10');
        grad.addColorStop(0.5, '#1c0f08');
        grad.addColorStop(1, '#090503');
        break;
    }

    ctx.fillStyle = grad;
    ctx.fillRect(-50, -50, width + 100, height + 100);

    // Draw architectural silhouettes & shapes
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw scene focal art (silhouette buildings / interior arches / storefront)
    drawSceneSubject(ctx, width, height, sceneId, progress);
  }

  // Cinematic film grain / noise overlay
  ctx.fillStyle = 'rgba(255, 230, 180, 0.03)';
  for (let i = 0; i < 40; i++) {
    const rx = ((sceneId * 137 + i * 29) % width);
    const ry = ((sceneId * 97 + i * 43) % height);
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Vignette
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.4,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  // Scene Title Watermark / HUD indicator
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(234, 179, 8, 0.8)';
  ctx.fillText(`SCENE 0${sceneId} · 4K UHD`, 30, 38);

  ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(options.title, 30, 56);

  // Active Subtitles bar if present
  if (activeSubtitle) {
    drawSubtitlesBanner(ctx, width, height, activeSubtitle);
  }

  // Sticker or callout overlay if active
  if (stickerOverlay) {
    drawStickerBadge(ctx, width, height, stickerOverlay);
  }

  // Cinematic In-Frame Caption (Dates, numbers, places in project language)
  if (options.inFrameCaption) {
    drawInFrameCaption(ctx, width, height, options.inFrameCaption);
  }

  // Transition overlay (Fade or Dip to Black)
  if (transitionProgress !== undefined && transitionProgress > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${transitionProgress})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawInFrameCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  captionText: string
) {
  ctx.save();
  ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  const paddingX = 14;
  const paddingY = 7;
  const textWidth = ctx.measureText(captionText).width;
  const posX = 24;
  const posY = 32;

  // Background subtle glass badge
  ctx.fillStyle = 'rgba(15, 12, 8, 0.82)';
  ctx.fillRect(posX, posY, textWidth + paddingX * 2, 26);

  // Amber accent border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(posX, posY, textWidth + paddingX * 2, 26);

  // Text
  ctx.fillStyle = '#fef3c7';
  ctx.textAlign = 'left';
  ctx.fillText(captionText, posX + paddingX, posY + 17);
  ctx.restore();
}

function drawSceneSubject(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneId: number,
  progress: number
) {
  const cx = width / 2;
  const cy = height * 0.55;

  ctx.save();

  if (sceneId % 4 === 1) {
    // Glowing Storefront / Street
    ctx.fillStyle = '#0f0c08';
    ctx.fillRect(cx - 180, cy - 80, 360, 160);

    // Warm shop window
    const winGrad = ctx.createLinearGradient(cx - 140, cy - 60, cx + 140, cy + 60);
    winGrad.addColorStop(0, '#f59e0b');
    winGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = winGrad;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
    ctx.shadowBlur = 35;
    ctx.fillRect(cx - 120, cy - 40, 240, 90);
    ctx.shadowBlur = 0;

    // Window frame bars
    ctx.strokeStyle = '#1a140d';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 120, cy - 40, 240, 90);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx, cy + 50);
    ctx.moveTo(cx - 120, cy + 5);
    ctx.lineTo(cx + 120, cy + 5);
    ctx.stroke();

    // Silhouetted figure passing by
    const figX = cx - 180 + progress * 240;
    ctx.fillStyle = '#080604';
    ctx.beginPath();
    ctx.arc(figX, cy + 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(figX - 10, cy + 22, 20, 48);

  } else if (sceneId % 4 === 2) {
    // Banker Desk & Glowing Green Desk Lamp
    ctx.fillStyle = '#1c130b';
    ctx.fillRect(cx - 240, cy + 10, 480, 100);

    // Green glass lamp
    ctx.fillStyle = '#065f46';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 40, 50, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Brass lamp base
    ctx.fillStyle = '#d97706';
    ctx.fillRect(cx - 3, cy - 40, 6, 50);
    ctx.beginPath();
    ctx.arc(cx, cy + 10, 20, 0, Math.PI);
    ctx.fill();

    // Ledger sheets on desk
    ctx.fillStyle = '#fef3c7';
    ctx.save();
    ctx.translate(cx - 80, cy + 20);
    ctx.rotate(-0.08);
    ctx.fillRect(0, 0, 70, 90);
    ctx.restore();

  } else if (sceneId % 4 === 3) {
    // Mechanical Clockwork & Gears
    const angle = progress * Math.PI;
    ctx.save();
    ctx.translate(cx, cy - 20);

    // Outer brass ring
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Gear teeth
    ctx.rotate(angle);
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(66, -6, 12, 12);
    }
    // Inner clock hands
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -45);
    ctx.moveTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.restore();

  } else {
    // Neon alley sign
    ctx.save();
    ctx.translate(cx, cy - 30);
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 30;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(-100, -40, 200, 80);

    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fee2e2';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN 24/7', 0, 8);
    ctx.restore();
  }

  ctx.restore();
}

function drawSubtitlesBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
) {
  ctx.save();
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  const textMetrics = ctx.measureText(text);
  const textWidth = Math.min(width - 80, textMetrics.width);
  const bannerY = height - 70;

  // Background dark glass bar
  ctx.fillStyle = 'rgba(10, 8, 6, 0.85)';
  ctx.fillRect(width / 2 - textWidth / 2 - 20, bannerY - 24, textWidth + 40, 44);

  // Gold accent left border
  ctx.fillStyle = '#eab308';
  ctx.fillRect(width / 2 - textWidth / 2 - 20, bannerY - 24, 4, 44);

  // Subtitle text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, bannerY + 4, width - 100);
  ctx.restore();
}

function drawStickerBadge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sticker: string
) {
  ctx.save();
  ctx.translate(width - 150, 70);
  ctx.rotate(0.04);

  // Red badge background
  ctx.fillStyle = '#dc2626';
  ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
  ctx.shadowBlur = 15;
  ctx.fillRect(-100, -20, 200, 40);
  ctx.shadowBlur = 0;

  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(sticker.toUpperCase(), 0, 6);
  ctx.restore();
}

/**
 * Creates a static Data URL for a given scene with procedural cinematic art
 */
export function generateSceneThumbnailDataUrl(
  sceneId: number,
  title: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' = '16:9',
  styleTheme: string = 'cinematic'
): string {
  const canvas = document.createElement('canvas');
  const width = aspectRatio === '9:16' ? 270 : aspectRatio === '1:1' ? 360 : aspectRatio === '3:4' ? 300 : aspectRatio === '4:3' ? 400 : 480;
  const height = aspectRatio === '9:16' ? 480 : aspectRatio === '1:1' ? 360 : aspectRatio === '3:4' ? 400 : aspectRatio === '4:3' ? 300 : 270;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawProceduralScene(ctx, width, height, {
    sceneId,
    title,
    timeSec: 1.5,
    durationSec: 4.0,
    motionType: 'static',
    aspectRatio,
    styleTheme,
  });

  return canvas.toDataURL('image/jpeg', 0.85);
}
