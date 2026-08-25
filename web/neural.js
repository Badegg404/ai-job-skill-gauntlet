/* ===== neural.js — 粒子连接背景（AI 元素 · 交互版）=====
 * 经典粒子系统：
 * - 漂浮粒子：大小不一、呼吸发光（teal / indigo / emerald）
 * - 距离连线：粒子间距离近时连细线（亮度随距离衰减）
 * - 鼠标交互：鼠标移动时粒子与鼠标连线，鼠标附近粒子被轻轻吸引
 * - 深景深：粒子有 z 深度（越大越近越大越快），营造空间感
 */
(function () {
  "use strict";
  const canvas = document.getElementById("neural-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, particles = [], raf = null;
  const mouse = { x: -9999, y: -9999, active: false };

  const COLORS = ["0,229,255", "255,61,240", "176,38,255", "0,255,200"];  // cyan / magenta / violet / aqua
  const COUNT = 60;          // 粒子数量（性能优化：原 110 → 60，GPU 负载约减半）
  const LINK_DIST = 120;     // 连线距离（性能优化：减少连线数量）
  const MOUSE_LINK = 200;    // 鼠标连线距离
  const MOUSE_PULL = 0.25;   // 鼠标引力系数

  function resize() {
    // 性能优化：canvas 渲染分辨率 1x（粒子是小光点，retina 下视觉几乎无差；像素量比 2x 减 75%）
    const dpr = 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    particles = [];
    // 粒子数量随面积微调
    const target = Math.min(COUNT, Math.floor((W * H) / 18000));
    for (let i = 0; i < target; i++) {
      const z = 0.4 + Math.random() * 0.9;  // 深度：近的大而快
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35 * z,
        vy: (Math.random() - 0.5) * 0.35 * z,
        r: (1.2 + Math.random() * 2.6) * z,
        z,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        phase: Math.random() * Math.PI * 2,   // 呼吸相位
        speed: 0.01 + Math.random() * 0.03,
      });
    }
  }

  let lastT = 0;
  function step(t) {
    // 性能优化：帧率封顶 24fps；运动按时间差缩放，速度不随帧率变化
    // BUG-FIX：首帧 lastT=0 时必须先画（原实现首帧 dt 恒 <41 导致粒子永不绘制）
    const dt = lastT ? Math.min(t - lastT, 100) : 41;
    const speedK = dt / 16.7;
    if (dt < 41) { raf = requestAnimationFrame(step); return; }
    lastT = t;
    ctx.clearRect(0, 0, W, H);

    // ---- 连线（底层）：按 颜色×透明度级别 分组，Path2D 合并，stroke 从数百次降到 ≤20 次（性能优化）----
    const lineGroups = {};   // "color|lv" -> Path2D（lv: 0-4 透明度级别，视觉保持连续感）
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const lv = Math.min(4, (((1 - dist / LINK_DIST) * Math.min(a.z, b.z) * 12) | 0));
          const key = a.color + "|" + lv;
          let g = lineGroups[key];
          if (!g) { g = lineGroups[key] = new Path2D(); }
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
        }
      }
    }
    // 分组一次性绘制：每 颜色×级别 一次 stroke（原每对连线一次 stroke）
    ctx.lineWidth = 0.7;
    for (const key in lineGroups) {
      const sep = key.indexOf("|");
      const alpha = 0.02 + (parseInt(key.slice(sep + 1), 10) + 1) * 0.024;
      ctx.strokeStyle = `rgba(${key.slice(0, sep)},${alpha})`;
      ctx.stroke(lineGroups[key]);
    }

    // ---- 鼠标连线 + 引力（半透明，鼠标附近）----
    if (mouse.active) {
      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_LINK) {
          const alpha = (1 - dist / MOUSE_LINK) * 0.35;
          ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
          // 引力：靠近鼠标时轻微拉向鼠标
          const pull = (1 - dist / MOUSE_LINK) * MOUSE_PULL;
          p.vx += (-dx / dist) * pull * 0.05;
          p.vy += (-dy / dist) * pull * 0.05;
        }
      }
    }

    // ---- 粒子 ----
    for (const p of particles) {
      p.x += p.vx * speedK;
      p.y += p.vy * speedK;
      // 阻尼：让引力效果平缓回落（按帧率缩放）
      p.vx *= Math.pow(0.985, speedK);
      p.vy *= Math.pow(0.985, speedK);
      // 边界回弹
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // 呼吸发光
      p.phase += p.speed;
      const glow = 0.55 + 0.35 * Math.sin(p.phase);
      const r = p.r;

      // 光晕（柔和径向渐变：中心亮边缘透明，避免硬边光圈感；canvas 已 1x+24fps，开销可接受）
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
      halo.addColorStop(0, `rgba(${p.color},${0.26 * glow * p.z})`);
      halo.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
      ctx.fill();

      // 核心亮点
      ctx.fillStyle = `rgba(${p.color},${(0.45 + 0.55 * glow) * p.z})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(step);
  }

  // 鼠标跟踪
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mouseleave", () => { mouse.active = false; });

  window.addEventListener("resize", resize);
  resize();
  step();

  // 页面隐藏时暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
    else if (!document.hidden && !raf) { step(); }
  });
})();
