/* ============================================================
   FABLE — Mini-game engine (Canvas)
   Multiplier Gates · Hero Castle Wars · Pull the Pin · Weapon Evolution
   ============================================================ */

(function () {
  "use strict";

  const GAMES = {
    gates: {
      title: "Multiplier Gates",
      blurb: "Steer the crowd through math gates. Beat the boss.",
    },
    castle: {
      title: "Hero Castle Wars",
      blurb: "Fight only when your power is higher — absorb and climb.",
    },
    pin: {
      title: "Pull the Pin",
      blurb: "Pull pins to mix lava & water, drop gold, crush monsters.",
    },
    weapon: {
      title: "Weapon Evolution",
      blurb: "Shoot numbered cubes, grab upgrades, survive the track.",
    },
  };

  let raf = 0;
  let running = false;
  let activeId = null;
  let cleanup = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function toast(msg, type) {
    if (typeof window.toast === "function") window.toast(msg, type);
  }

  function hideHub() {
    const hub = $("#games-hub");
    if (hub) hub.style.display = "none";
    const ms = $("#ms-panel");
    if (ms) ms.classList.remove("active");
  }

  function showArena(id) {
    const arena = $("#mini-arena");
    const title = $("#mini-title");
    const blurb = $("#mini-blurb");
    if (!arena) return null;
    hideHub();
    arena.removeAttribute("hidden");
    arena.classList.add("active");
    if (title) title.textContent = GAMES[id]?.title || "Game";
    if (blurb) blurb.textContent = GAMES[id]?.blurb || "";
    return arena;
  }

  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (typeof cleanup === "function") {
      try {
        cleanup();
      } catch (_) {}
    }
    cleanup = null;
  }

  function open(id) {
    if (!GAMES[id]) {
      toast("Unknown game.", "error");
      return;
    }
    stopLoop();
    activeId = id;
    const arena = showArena(id);
    if (!arena) return;

    const canvas = $("#mini-canvas");
    const hud = $("#mini-hud");
    const hint = $("#mini-hint");
    if (!canvas) return;

    // Responsive canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.min(arena.clientWidth || 360, 480);
    const cssH = Math.round(cssW * 1.35);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const api = { canvas, ctx, w: cssW, h: cssH, hud, hint, dpr };

    if (id === "gates") cleanup = playGates(api);
    else if (id === "castle") cleanup = playCastle(api);
    else if (id === "pin") cleanup = playPin(api);
    else if (id === "weapon") cleanup = playWeapon(api);
  }

  function close() {
    stopLoop();
    activeId = null;
    const arena = $("#mini-arena");
    if (arena) {
      arena.classList.remove("active");
      arena.setAttribute("hidden", "");
    }
  }

  // ---------- shared drawing helpers ----------
  function bg(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#12161f");
    g.addColorStop(0.55, "#0c1018");
    g.addColorStop(1, "#07080c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function pointer(canvas, e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: ((t.clientX - r.left) / r.width) * (canvas.clientWidth || r.width),
      y: ((t.clientY - r.top) / r.height) * (canvas.clientHeight || r.height),
    };
  }

  // =========================================================================
  // 1) Multiplier Gates — lane runner with gates + boss
  // =========================================================================
  function playGates({ canvas, ctx, w, h, hud, hint }) {
    let crowd = 12;
    let x = w / 2;
    let targetX = x;
    let speed = 2.6;
    let dist = 0;
    let over = false;
    let won = false;
    let bossHp = 0;
    let bossMax = 0;
    let phase = "run"; // run | boss | end

    const gates = [];
    for (let i = 0; i < 8; i++) {
      const y = -180 - i * 220;
      const leftMul = Math.random() > 0.45;
      const rightMul = !leftMul || Math.random() > 0.5;
      gates.push({
        y,
        left: leftMul
          ? { op: "x", n: [2, 2, 3][Math.floor(Math.random() * 3)] }
          : { op: "+", n: [15, 25, 40, 50][Math.floor(Math.random() * 4)] },
        right: rightMul
          ? { op: "x", n: [2, 2, 3][Math.floor(Math.random() * 3)] }
          : { op: "+", n: [10, 20, 30, 50][Math.floor(Math.random() * 4)] },
        used: false,
      });
    }

    function applyGate(g) {
      if (g.op === "x") crowd = Math.max(1, Math.floor(crowd * g.n));
      else crowd = Math.max(1, crowd + g.n);
    }

    function label(g) {
      return g.op === "x" ? `×${g.n}` : `+${g.n}`;
    }

    function onMove(e) {
      if (over) return;
      e.preventDefault();
      const p = pointer(canvas, e);
      targetX = Math.max(40, Math.min(w - 40, p.x));
    }

    const opts = { passive: false };
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("touchstart", onMove, opts);
    canvas.addEventListener("touchmove", onMove, opts);

    if (hint) hint.textContent = "Drag left / right · pass through gates · defeat the boss";
    running = true;

    function frame() {
      if (!running) return;
      bg(ctx, w, h);

      // road
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(w * 0.12, 0, w * 0.76, h);
      ctx.strokeStyle = "rgba(46,242,160,0.15)";
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);

      if (phase === "run") {
        dist += speed;
        x += (targetX - x) * 0.18;
        for (const g of gates) {
          g.y += speed;
          if (!g.used && g.y > h * 0.72 && g.y < h * 0.72 + speed + 4) {
            g.used = true;
            const side = x < w / 2 ? g.left : g.right;
            applyGate(side);
          }
          // draw gates
          if (g.y > -60 && g.y < h + 40) {
            drawGate(ctx, w * 0.14, g.y, w * 0.34, 44, label(g.left), "#2ef2a0");
            drawGate(ctx, w * 0.52, g.y, w * 0.34, 44, label(g.right), "#a78bfa");
          }
        }
        if (gates.every((g) => g.used && g.y > h)) {
          phase = "boss";
          bossMax = Math.max(40, Math.floor(crowd * 1.15));
          bossHp = bossMax;
        }
      } else if (phase === "boss") {
        x += (targetX - x) * 0.12;
        // boss body
        const bx = w / 2;
        const by = h * 0.28;
        ctx.fillStyle = "#7f1d1d";
        roundRect(ctx, bx - 70, by - 50, 140, 100, 16);
        ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", bx, by - 8);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px system-ui";
        ctx.fillText(String(Math.ceil(bossHp)), bx, by + 22);

        // hp bar
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(ctx, w * 0.2, 24, w * 0.6, 12, 6);
        ctx.fill();
        ctx.fillStyle = "#fb7185";
        roundRect(ctx, w * 0.2, 24, w * 0.6 * (bossHp / bossMax), 12, 6);
        ctx.fill();

        bossHp -= crowd * 0.035;
        if (bossHp <= 0) {
          phase = "end";
          won = true;
          over = true;
        }
      }

      // crowd
      const n = Math.min(crowd, 60);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const r = 10 + (i % 5) * 4;
        const px = x + Math.cos(ang) * r * 0.6;
        const py = h * 0.78 + Math.sin(ang) * r * 0.25;
        ctx.beginPath();
        ctx.fillStyle = i % 2 ? "#2ef2a0" : "#5eead4";
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#eef2f7";
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(crowd), x, h * 0.78 - 28);

      if (hud) {
        hud.innerHTML = over
          ? won
            ? `<span class="mini-win">Victory!</span> Crowd ${crowd}`
            : `Defeated`
          : phase === "boss"
            ? `Boss fight · Crowd <strong>${crowd}</strong>`
            : `Crowd <strong>${crowd}</strong> · Drag to choose gate`;
      }

      if (over) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = won ? "#2ef2a0" : "#fb7185";
        ctx.font = "bold 28px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(won ? "VICTORY" : "DEFEATED", w / 2, h / 2);
        ctx.fillStyle = "#eef2f7";
        ctx.font = "14px system-ui";
        ctx.fillText("Tap Restart below", w / 2, h / 2 + 28);
        return;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function restart() {
      stopLoop();
      open("gates");
    }
    $("#mini-restart")?.addEventListener("click", restart);

    return () => {
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("touchstart", onMove);
      canvas.removeEventListener("touchmove", onMove);
      $("#mini-restart")?.removeEventListener("click", restart);
    };
  }

  function drawGate(ctx, x, y, w, h, text, color) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, x + w / 2, y + h / 2 + 6);
  }

  // =========================================================================
  // 2) Hero Castle Wars — power compare floors
  // =========================================================================
  function playCastle({ canvas, ctx, w, h, hud, hint }) {
    let power = 10;
    let floor = 1;
    let enemy = 8;
    let state = "idle"; // idle | fight | win | lose
    let anim = 0;

    function nextEnemy() {
      enemy = Math.floor(6 + floor * 4 + Math.random() * floor * 2);
    }
    nextEnemy();

    function fight() {
      if (state !== "idle") return;
      if (power > enemy) {
        power += enemy;
        floor += 1;
        anim = 1;
        state = "fight";
        setTimeout(() => {
          if (floor > 12) {
            state = "win";
          } else {
            nextEnemy();
            state = "idle";
            anim = 0;
          }
        }, 450);
      } else {
        state = "lose";
      }
    }

    function onTap(e) {
      e.preventDefault();
      if (state === "idle") fight();
    }
    canvas.addEventListener("pointerdown", onTap);

    if (hint) hint.textContent = "Tap Fight only if your power > enemy. Absorb and climb floors.";
    running = true;

    function frame() {
      if (!running) return;
      bg(ctx, w, h);

      // castle silhouette
      ctx.fillStyle = "#1e1b4b";
      roundRect(ctx, w * 0.15, h * 0.18, w * 0.7, h * 0.5, 12);
      ctx.fill();
      ctx.fillStyle = "#312e81";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(w * 0.18 + i * (w * 0.13), h * 0.12, w * 0.08, h * 0.08);
      }

      // hero
      const hx = w * 0.32;
      const hy = h * 0.55;
      ctx.beginPath();
      ctx.fillStyle = "#2ef2a0";
      ctx.arc(hx, hy, 28 + anim * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#04120c";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(power), hx, hy + 5);

      // enemy
      const ex = w * 0.68;
      const ey = h * 0.55;
      ctx.beginPath();
      ctx.fillStyle = state === "lose" ? "#7f1d1d" : "#fb7185";
      ctx.arc(ex, ey, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0510";
      ctx.fillText(String(enemy), ex, ey + 5);

      ctx.fillStyle = "#eef2f7";
      ctx.font = "bold 15px system-ui";
      ctx.fillText("YOU", hx, hy + 48);
      ctx.fillText("ENEMY", ex, ey + 48);

      ctx.font = "bold 20px system-ui";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`Floor ${floor} / 12`, w / 2, h * 0.14);

      // fight button
      const bw = 160;
      const bh = 48;
      const bx = (w - bw) / 2;
      const by = h * 0.78;
      const can = power > enemy && state === "idle";
      ctx.fillStyle = can ? "#2ef2a0" : "rgba(255,255,255,0.12)";
      roundRect(ctx, bx, by, bw, bh, 24);
      ctx.fill();
      ctx.fillStyle = can ? "#04120c" : "#94a3b8";
      ctx.font = "bold 16px system-ui";
      ctx.fillText(state === "idle" ? (can ? "FIGHT" : "TOO WEAK") : state.toUpperCase(), w / 2, by + 30);

      if (state === "win" || state === "lose") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = state === "win" ? "#2ef2a0" : "#fb7185";
        ctx.font = "bold 28px system-ui";
        ctx.fillText(state === "win" ? "CASTLE CLEARED" : "DEFEATED", w / 2, h / 2);
      }

      if (hud) {
        hud.innerHTML = `Power <strong>${power}</strong> · Floor <strong>${floor}</strong> · Enemy <strong>${enemy}</strong>`;
      }

      if (anim > 0) anim *= 0.9;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function restart() {
      stopLoop();
      open("castle");
    }
    $("#mini-restart")?.addEventListener("click", restart);

    // Also allow button region tap via coordinates
    function onFightClick(e) {
      const p = pointer(canvas, e);
      if (p.y > h * 0.75) fight();
    }
    canvas.addEventListener("pointerup", onFightClick);

    return () => {
      canvas.removeEventListener("pointerdown", onTap);
      canvas.removeEventListener("pointerup", onFightClick);
      $("#mini-restart")?.removeEventListener("click", restart);
    };
  }

  // =========================================================================
  // 3) Pull the Pin — simplified physics puzzle
  // =========================================================================
  function playPin({ canvas, ctx, w, h, hud, hint }) {
    // Objects: pins hold platforms / liquids; pull to mix
    const pins = [
      { id: 1, x: w * 0.28, y: h * 0.32, r: 16, pulled: false },
      { id: 2, x: w * 0.72, y: h * 0.32, r: 16, pulled: false },
      { id: 3, x: w * 0.5, y: h * 0.52, r: 16, pulled: false },
    ];
    let lava = { x: w * 0.22, y: h * 0.2, released: false, vy: 0 };
    let water = { x: w * 0.78, y: h * 0.2, released: false, vy: 0 };
    let gold = { x: w * 0.5, y: h * 0.42, released: false, vy: 0, caught: false };
    let stone = false;
    let monster = { x: w * 0.7, y: h * 0.78, alive: true };
    let hero = { x: w * 0.3, y: h * 0.8, gold: 0 };
    let won = false;
    let lost = false;

    function pullNearest(px, py) {
      let best = null;
      let bd = 40;
      for (const p of pins) {
        if (p.pulled) continue;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (!best) return;
      best.pulled = true;
      if (best.id === 1) lava.released = true;
      if (best.id === 2) water.released = true;
      if (best.id === 3) gold.released = true;
    }

    function onTap(e) {
      e.preventDefault();
      if (won || lost) return;
      const p = pointer(canvas, e);
      pullNearest(p.x, p.y);
    }
    canvas.addEventListener("pointerdown", onTap);

    if (hint) hint.textContent = "Tap pins · mix lava+water → stone · drop gold to hero · crush monster";
    running = true;

    function frame() {
      if (!running) return;
      bg(ctx, w, h);

      // floor
      ctx.fillStyle = "#1c2230";
      ctx.fillRect(0, h * 0.88, w, h * 0.12);

      // shelves
      ctx.fillStyle = "#2a3344";
      if (!pins[0].pulled) ctx.fillRect(w * 0.1, h * 0.28, w * 0.3, 10);
      if (!pins[1].pulled) ctx.fillRect(w * 0.6, h * 0.28, w * 0.3, 10);
      if (!pins[2].pulled) ctx.fillRect(w * 0.35, h * 0.48, w * 0.3, 10);

      // physics-ish fall
      if (lava.released) {
        lava.vy += 0.35;
        lava.y += lava.vy;
        lava.x += 1.2;
      }
      if (water.released) {
        water.vy += 0.35;
        water.y += water.vy;
        water.x -= 1.2;
      }
      if (gold.released && !gold.caught) {
        gold.vy += 0.3;
        gold.y += gold.vy;
      }

      // mix check
      if (!stone && lava.released && water.released) {
        if (Math.hypot(lava.x - water.x, lava.y - water.y) < 40 || (lava.y > h * 0.7 && water.y > h * 0.7)) {
          stone = true;
        }
      }

      // gold catch
      if (!gold.caught && gold.released && gold.y > hero.y - 20 && Math.abs(gold.x - hero.x) < 40) {
        gold.caught = true;
        hero.gold = 1;
      }

      // stone kills monster
      if (stone && monster.alive && lava.y > h * 0.7) {
        monster.alive = false;
      }

      if (!monster.alive && hero.gold) {
        won = true;
      }
      if (gold.y > h + 40 && !gold.caught) lost = true;

      // draw liquids
      if (!stone) {
        ctx.beginPath();
        ctx.fillStyle = "#ef4444";
        ctx.arc(lava.x, Math.min(lava.y, h * 0.86), 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#38bdf8";
        ctx.arc(water.x, Math.min(water.y, h * 0.86), 18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#78716c";
        roundRect(ctx, w * 0.55, h * 0.72, 70, 50, 8);
        ctx.fill();
        ctx.fillStyle = "#e7e5e4";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("STONE", w * 0.55 + 35, h * 0.72 + 30);
      }

      if (!gold.caught) {
        ctx.beginPath();
        ctx.fillStyle = "#fbbf24";
        ctx.arc(gold.x, gold.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // hero
      ctx.beginPath();
      ctx.fillStyle = "#2ef2a0";
      ctx.arc(hero.x, hero.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#04120c";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(hero.gold ? "★" : "HERO", hero.x, hero.y + 4);

      // monster
      if (monster.alive) {
        ctx.beginPath();
        ctx.fillStyle = "#a78bfa";
        ctx.arc(monster.x, monster.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f0618";
        ctx.fillText("MOB", monster.x, monster.y + 4);
      }

      // pins
      for (const p of pins) {
        if (p.pulled) continue;
        ctx.beginPath();
        ctx.fillStyle = "#fbbf24";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a1000";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("PIN", p.x, p.y + 4);
      }

      if (hud) {
        hud.innerHTML = won
          ? `<span class="mini-win">Puzzle solved!</span>`
          : lost
            ? `Gold lost — restart`
            : `Stone: <strong>${stone ? "yes" : "no"}</strong> · Gold: <strong>${hero.gold ? "got" : "—"}</strong> · Mob: <strong>${monster.alive ? "alive" : "down"}</strong>`;
      }

      if (won || lost) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = won ? "#2ef2a0" : "#fb7185";
        ctx.font = "bold 26px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(won ? "RESCUED!" : "TRY AGAIN", w / 2, h / 2);
        return;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function restart() {
      stopLoop();
      open("pin");
    }
    $("#mini-restart")?.addEventListener("click", restart);

    return () => {
      canvas.removeEventListener("pointerdown", onTap);
      $("#mini-restart")?.removeEventListener("click", restart);
    };
  }

  // =========================================================================
  // 4) Weapon Evolution — auto-shooter runner
  // =========================================================================
  function playWeapon({ canvas, ctx, w, h, hud, hint }) {
    let rof = 1; // shots per second factor
    let range = 160;
    let dmg = 1;
    let score = 0;
    let hp = 3;
    let t = 0;
    let shootCd = 0;
    let over = false;
    let won = false;

    const player = { x: w / 2, y: h * 0.82 };
    const bullets = [];
    const cubes = [];
    const pickups = [];

    function spawnCube() {
      const val = 2 + Math.floor(Math.random() * 6) + Math.floor(score / 20);
      cubes.push({
        x: 40 + Math.random() * (w - 80),
        y: -30,
        v: 1.2 + Math.random() * 1.2 + score * 0.01,
        hp: val,
        max: val,
        s: 28 + Math.min(val, 10),
      });
    }

    function onMove(e) {
      if (over) return;
      e.preventDefault();
      const p = pointer(canvas, e);
      player.x = Math.max(24, Math.min(w - 24, p.x));
    }
    const opts = { passive: false };
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("touchmove", onMove, opts);

    if (hint) hint.textContent = "Drag to aim · auto-fire · grab amber (+RoF) & violet (+Range)";
    running = true;
    let spawnTimer = 0;

    function frame() {
      if (!running) return;
      t += 1 / 60;
      bg(ctx, w, h);

      // track
      ctx.fillStyle = "rgba(251,191,36,0.06)";
      ctx.fillRect(w * 0.08, 0, w * 0.84, h);

      if (!over) {
        spawnTimer += 1 / 60;
        if (spawnTimer > Math.max(0.45, 1.1 - score * 0.01)) {
          spawnTimer = 0;
          spawnCube();
          if (Math.random() < 0.22) {
            pickups.push({
              x: 40 + Math.random() * (w - 80),
              y: -20,
              v: 1.5,
              type: Math.random() > 0.5 ? "rof" : "range",
            });
          }
        }

        // shoot
        shootCd -= 1 / 60;
        if (shootCd <= 0) {
          shootCd = 1 / (2.2 * rof);
          bullets.push({ x: player.x, y: player.y - 20, v: 7, life: range });
        }

        // update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.y -= b.v;
          b.life -= b.v;
          if (b.life <= 0 || b.y < 0) bullets.splice(i, 1);
        }

        // cubes
        for (let i = cubes.length - 1; i >= 0; i--) {
          const c = cubes[i];
          c.y += c.v;
          // bullet hits
          for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.abs(b.x - c.x) < c.s * 0.6 && Math.abs(b.y - c.y) < c.s * 0.6) {
              c.hp -= dmg;
              bullets.splice(j, 1);
              if (c.hp <= 0) {
                score += c.max;
                cubes.splice(i, 1);
                break;
              }
            }
          }
          if (c.y > h * 0.88) {
            cubes.splice(i, 1);
            hp -= 1;
            if (hp <= 0) over = true;
          }
        }

        // pickups
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          p.y += p.v;
          if (Math.hypot(p.x - player.x, p.y - player.y) < 28) {
            if (p.type === "rof") rof = Math.min(4, rof + 0.35);
            else range = Math.min(320, range + 28);
            pickups.splice(i, 1);
            continue;
          }
          if (p.y > h + 20) pickups.splice(i, 1);
        }

        if (score >= 80) {
          won = true;
          over = true;
        }
      }

      // draw pickups
      for (const p of pickups) {
        ctx.beginPath();
        ctx.fillStyle = p.type === "rof" ? "#fbbf24" : "#a78bfa";
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      // cubes
      for (const c of cubes) {
        ctx.fillStyle = "#334155";
        roundRect(ctx, c.x - c.s / 2, c.y - c.s / 2, c.s, c.s, 6);
        ctx.fill();
        ctx.strokeStyle = "#2ef2a0";
        ctx.stroke();
        ctx.fillStyle = "#eef2f7";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(Math.ceil(c.hp)), c.x, c.y + 5);
      }

      // bullets
      ctx.fillStyle = "#fbbf24";
      for (const b of bullets) {
        ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
      }

      // player gun
      ctx.fillStyle = "#2ef2a0";
      roundRect(ctx, player.x - 16, player.y - 12, 32, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(player.x - 3, player.y - 28, 6, 18);

      // range guide
      ctx.strokeStyle = "rgba(167,139,250,0.25)";
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x, player.y - range);
      ctx.stroke();

      if (hud) {
        hud.innerHTML = over
          ? won
            ? `<span class="mini-win">Bonus track cleared!</span> Score ${score}`
            : `Game over · Score ${score}`
          : `Score <strong>${score}</strong> · HP <strong>${hp}</strong> · RoF <strong>${rof.toFixed(1)}</strong> · Range <strong>${Math.round(range)}</strong>`;
      }

      if (over) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = won ? "#2ef2a0" : "#fb7185";
        ctx.font = "bold 26px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(won ? "EVOLVED!" : "DESTROYED", w / 2, h / 2);
        return;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function restart() {
      stopLoop();
      open("weapon");
    }
    $("#mini-restart")?.addEventListener("click", restart);

    return () => {
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("touchmove", onMove);
      $("#mini-restart")?.removeEventListener("click", restart);
    };
  }

  window.MiniGames = { open, close, list: GAMES };
})();
