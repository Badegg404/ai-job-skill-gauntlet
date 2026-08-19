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
  const COUNT = 110;         // 粒子数量（根据屏幕大小自适应）
  const LINK_DIST = 150;     // 连线距离
  const MOUSE_LINK = 200;    // 鼠标连线距离
  const MOUSE_PULL = 0.25;   // 鼠标引力系数

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
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

  function step() {
    ctx.clearRect(0, 0, W, H);

    // ---- 连线（底层）----
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.14 * Math.min(a.z, b.z);
          ctx.strokeStyle = `rgba(${a.color},${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
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
      p.x += p.vx;
      p.y += p.vy;
      // 阻尼：让引力效果平缓回落
      p.vx *= 0.985;
      p.vy *= 0.985;
      // 边界回弹
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // 呼吸发光
      p.phase += p.speed;
      const glow = 0.55 + 0.35 * Math.sin(p.phase);
      const r = p.r;

      // 光晕
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
      halo.addColorStop(0, `rgba(${p.color},${0.32 * glow * p.z})`);
      halo.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
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
