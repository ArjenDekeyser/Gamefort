(() => {
    'use strict';
    const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
    const map = document.getElementById('minimapCanvas'), mctx = map.getContext('2d');
    const hud = document.getElementById('hud'), menu = document.getElementById('mainMenu'), endScreen = document.getElementById('gameOverScreen');
    const SIZE = 3000, keys = new Set(), weapons = [
        { name: 'Ranger', kind: 'AR', damage: 24, rate: 160, reload: 1250, mag: 24, speed: 780, spread: .05, color: '#87d8a7', rarity: 'ONGEWOON' },
        { name: 'Stuiter', kind: 'POMP', damage: 12, rate: 690, reload: 1500, mag: 6, speed: 650, spread: .23, pellets: 7, color: '#d793e2', rarity: 'ZELDZAAM' },
        { name: 'Lange arm', kind: 'DMR', damage: 58, rate: 850, reload: 1750, mag: 5, speed: 1200, spread: .012, color: '#79c4ee', rarity: 'EPISCH' },
        { name: 'Ratel', kind: 'SMG', damage: 13, rate: 85, reload: 1350, mag: 32, speed: 850, spread: .1, color: '#f2c96c', rarity: 'ONGEWOON' }
    ];
    const places = [{ name: 'KOPERHAVEN', x: 430, y: 480 }, { name: 'MOSMARKT', x: 2060, y: 520 }, { name: 'OUDE DAM', x: 1280, y: 1290 }, { name: 'ZONNEVELD', x: 480, y: 2210 }, { name: 'KRATERPARK', x: 2110, y: 2220 }, { name: 'RADARPOST', x: 1370, y: 2610 }];
    let state = 'menu', player, bots = [], bullets = [], loot = [], walls = [], trees = [], buildings = [], storm = { x: 1500, y: 1500, r: 1460, phase: 0, next: 25 }, cam = { x: 0, y: 0 };
    let last = 0, time = 0, kills = 0, dealt = 0, slot = 0, reloadAt = 0, lastShot = 0, material = 90, medkits = 2, reserve = 144;
    let mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false }, toastUntil = 0, toastText = '', feed = [], difficulty = 'Normaal', sound = true, audio;
    let stick = { x: 0, y: 0 }, touchFire = false;
    const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    function resize() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const size = map.clientWidth || 150; map.width = size * dpr; map.height = size * dpr; mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function buildWorld() {
        trees = []; buildings = [];
        places.forEach((p, index) => {
            for (let i = 0; i < 13; i++) buildings.push({ x: p.x + (i % 4) * 90, y: p.y + Math.floor(i / 4) * 80, w: 58 + Math.random() * 22, h: 45 + Math.random() * 24, color: ['#c89b71', '#b9765e', '#d6c08d', '#8baf94'][i % 4] });
        });
        for (let i = 0; i < 210; i++) {
            const x = rand(30, SIZE - 30), y = rand(30, SIZE - 30);
            if (places.some(p => Math.abs(x - p.x) < 240 && Math.abs(y - p.y) < 220)) continue;
            trees.push({ x, y, r: rand(12, 28), green: Math.random() > .5 });
        }
    }
    function startGame() {
        difficulty = document.getElementById('difficultySelect')?.value || 'Normaal';
        const spawn = places[Math.floor(Math.random() * places.length)];
        player = { x: spawn.x + 100, y: spawn.y + 100, hp: 100, shield: 50, angle: 0, speed: 245, invulnerable: 0, weapons: [{ ...weapons[0], ammo: 24 }] };
        const count = difficulty === 'Rustig' ? 15 : difficulty === 'Heftig' ? 28 : 22;
        bots = Array.from({ length: count }, (_, id) => {
            let x, y; do { x = rand(80, SIZE - 80); y = rand(80, SIZE - 80); } while (Math.hypot(x - player.x, y - player.y) < 450);
            return { id, name: ['Koraal', 'Bram', 'Pixel', 'Vonk', 'Riff', 'Nova', 'Maan', 'Flint', 'Echo', 'Sproet'][id % 10], x, y, hp: 100, shield: Math.random() > .5 ? 25 : 0, angle: 0, speed: rand(78, 110), nextShot: rand(500, 1600), dir: rand(-3, 3), alive: true };
        });
        bullets = []; walls = []; loot = [];
        for (let i = 0; i < 58; i++) loot.push({ x: rand(60, SIZE - 60), y: rand(60, SIZE - 60), type: Math.random() < .18 ? 'kist' : ['munitie', 'schild', 'hout', 'ehbo'][Math.floor(Math.random() * 4)], open: false });
        storm = { x: 1500, y: 1500, r: 1460, phase: 0, next: 25 };
        material = 90; medkits = 2; reserve = 144; slot = 0; reloadAt = 0; lastShot = 0; time = 0; kills = 0; dealt = 0; feed = []; buildWorld(); cam = { x: player.x, y: player.y };
        menu.classList.add('hidden'); endScreen.classList.remove('active', 'hidden'); endScreen.classList.add('hidden');
        hud.style.display = 'block'; state = 'playing'; last = performance.now(); announce('LAND, VIND UITRUSTING EN BLIJF IN DE ZONE');
        document.getElementById('touchControls').classList.toggle('visible', innerWidth < 760); resize(); requestAnimationFrame(loop);
    }
    function draw() {
        const w = innerWidth, h = innerHeight; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#718d57'; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
        ctx.strokeStyle = '#c2ad7c'; ctx.lineWidth = 34; ctx.globalAlpha = .72; ctx.beginPath(); ctx.moveTo(-20, 1120); ctx.bezierCurveTo(750, 1000, 1110, 1570, 1810, 1480); ctx.bezierCurveTo(2210, 1430, 2510, 850, 3020, 950); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1250, -20); ctx.bezierCurveTo(1420, 650, 960, 1080, 1270, 1640); ctx.bezierCurveTo(1460, 2040, 1550, 2360, 1730, 3020); ctx.stroke(); ctx.globalAlpha = 1;
        places.forEach(p => { ctx.fillStyle = '#f5e9c2'; ctx.font = 'bold 12px sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText(p.name, p.x, p.y - 22); });
        buildings.forEach(b => { ctx.fillStyle = 'rgba(25,45,39,.2)'; ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h); ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = '#6b5947'; ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h - 14, 9, 14); });
        trees.forEach(t => { if (Math.abs(t.x - cam.x) > w / 2 + 100 || Math.abs(t.y - cam.y) > h / 2 + 100) return; ctx.fillStyle = '#3f7452'; ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 7, t.r, t.r * .7, 0, 0, 7); ctx.fill(); ctx.fillStyle = t.green ? '#527e52' : '#47774f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill(); });
        loot.forEach(a => { if (a.open) return; ctx.save(); ctx.translate(a.x, a.y + Math.sin(time * 3 + a.x) * 2); const color = ({ kist: '#ffd57b', munitie: '#e8cc72', schild: '#77cfee', hout: '#dda76b', ehbo: '#ec8275' })[a.type]; ctx.shadowColor = color; ctx.shadowBlur = a.type === 'kist' ? 14 : 8; ctx.fillStyle = color; ctx.fillRect(-8, -8, 16, 16); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(a.type === 'kist' ? '◆' : '+', 0, 3); ctx.restore(); });
        walls.forEach(a => { ctx.fillStyle = '#bd8f61'; ctx.fillRect(a.x - 25, a.y - 8, 50, 16); ctx.strokeStyle = '#67472f'; ctx.strokeRect(a.x - 25, a.y - 8, 50, 16); });
        bullets.forEach(b => { ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x - b.vx * .02, b.y - b.vy * .02); ctx.lineTo(b.x, b.y); ctx.stroke(); });
        bots.forEach(b => { if (b.alive) drawFighter(b, false); }); if (state === 'playing') drawFighter(player, true);
        ctx.fillStyle = 'rgba(102,137,200,.29)'; ctx.beginPath(); ctx.rect(0, 0, SIZE, SIZE); ctx.arc(storm.x, storm.y, storm.r, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.strokeStyle = '#bfeeff'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.arc(storm.x, storm.y, storm.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore(); drawMap();
    }
    function drawFighter(a, own) {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle); ctx.fillStyle = '#f1f0d8'; ctx.beginPath(); ctx.arc(0, 2, 15, 0, 7); ctx.fill(); ctx.fillStyle = own ? '#197e72' : '#b85c4b'; ctx.beginPath(); ctx.arc(-2, 3, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#f0c6a0'; ctx.beginPath(); ctx.arc(1, -4, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#35443d'; ctx.fillRect(8, -3, 20, 6); ctx.restore();
        if (!own && dist(a, player) < 320) { ctx.fillStyle = '#253830'; ctx.fillRect(a.x - 19, a.y - 27, 38, 4); ctx.fillStyle = '#e97c69'; ctx.fillRect(a.x - 19, a.y - 27, 38 * Math.max(0, a.hp) / 100, 4); ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(a.name, a.x, a.y - 33); }
    }
    function drawMap() {
        const size = map.clientWidth || 150, s = size / SIZE; mctx.clearRect(0, 0, size, size); mctx.fillStyle = '#71865b'; mctx.fillRect(0, 0, size, size); mctx.fillStyle = '#c7b78d'; places.forEach(p => mctx.fillRect(p.x * s, p.y * s, 80 * s, 65 * s)); mctx.strokeStyle = '#c8eeff'; mctx.beginPath(); mctx.arc(storm.x * s, storm.y * s, storm.r * s, 0, 7); mctx.stroke(); bots.forEach(b => { if (b.alive) { mctx.fillStyle = '#f1846d'; mctx.fillRect(b.x * s - 1, b.y * s - 1, 2, 2); } }); if (player) { mctx.fillStyle = '#fff1cf'; mctx.beginPath(); mctx.arc(player.x * s, player.y * s, 3, 0, 7); mctx.fill(); }
    }
    function loop(now) {
        if (state !== 'playing') return;
        const dt = Math.min((now - last) / 1000, .04); last = now; time += dt; update(dt, now); draw(); requestAnimationFrame(loop);
    }
    function update(dt, now) {
        storm.next -= dt; if (storm.next <= 0 && storm.phase < 5) { storm.phase++; storm.next = 28; storm.r = Math.max(170, storm.r * .75); announce(`STORMFASE ${storm.phase} · VEILIGE ZONE KRIMPT`); }
        const mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + stick.x;
        const my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + stick.y, len = Math.hypot(mx, my) || 1;
        const sprint = keys.has('shift') ? 1.4 : 1; player.x = clamp(player.x + mx / len * 245 * sprint * dt, 20, SIZE - 20); player.y = clamp(player.y + my / len * 245 * sprint * dt, 20, SIZE - 20);
        cam.x += (player.x - cam.x) * Math.min(1, dt * 8); cam.y += (player.y - cam.y) * Math.min(1, dt * 8);
        player.angle = Math.atan2(mouse.y + cam.y - innerHeight / 2 - player.y, mouse.x + cam.x - innerWidth / 2 - player.x);
        if (mouse.down || touchFire) shoot(now); if (player.invulnerable > 0) player.invulnerable -= dt;
        if (player.reloading && now >= reloadAt) finishReload();
        bots.forEach(b => {
            if (!b.alive) return;
            let target = dist(b, player) < 420 ? player : null, d = target ? dist(b, target) : Infinity;
            bots.forEach(other => { if (!other.alive || other === b) return; const nextDistance = dist(b, other); if (nextDistance < d) { target = other; d = nextDistance; } });
            if (target && d < 540) {
                b.angle = Math.atan2(target.y - b.y, target.x - b.x);
                if (d > 185) { b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt; }
                if (now > b.nextShot && d < 390) {
                    b.nextShot = now + rand(1100, difficulty === 'Heftig' ? 1450 : 2100);
                    const angle = b.angle + rand(-.3, .3);
                    bullets.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 520, vy: Math.sin(angle) * 520, life: .9, damage: difficulty === 'Heftig' ? 8 : 5, owner: b, color: '#ef9b7a' });
                }
            } else { b.dir += rand(-.02, .02); b.x += Math.cos(b.dir) * b.speed * .45 * dt; b.y += Math.sin(b.dir) * b.speed * .45 * dt; }
            if (dist(b, storm) > storm.r) { b.hp -= 4 * dt; if (b.hp <= 0) eliminate(b, 'de storm'); }
        });
        bullets.forEach((b, i) => {
            b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; let hit = b.life <= 0;
            const wall = !hit && walls.find(a => a.owner !== b.owner && Math.abs(b.x - a.x) < 26 && Math.abs(b.y - a.y) < 13);
            if (wall) { wall.hp -= b.damage; hit = true; if (wall.hp <= 0) walls.splice(walls.indexOf(wall), 1); }
            if (!hit && b.owner === player) { const target = bots.find(a => a.alive && dist(a, b) < 16); if (target) { hurtBot(target, b.damage, true); hit = true; } }
            else if (!hit) { const target = bots.find(a => a.alive && a !== b.owner && dist(a, b) < 16); if (target) { hurtBot(target, b.damage, false); hit = true; } else if (dist(player, b) < 17) { hurtPlayer(b.damage); hit = true; } }
            if (hit) bullets.splice(i, 1);
        });
        for (let i = walls.length - 1; i >= 0; i--) { walls[i].life -= dt; if (walls[i].life <= 0) walls.splice(i, 1); }
        if (dist(player, storm) > storm.r) hurtPlayer(5 * dt);
        loot.forEach(a => { if (a.open || dist(player, a) > 30) return; a.open = true; if (a.type === 'kist') { material += 25; reserve += 42; player.shield = Math.min(50, player.shield + 15); player.weapons.push({ ...weapons[Math.floor(Math.random() * weapons.length)], ammo: 18 }); if (player.weapons.length > 5) player.weapons.shift(); announce('VOORRAADKIST · UITRUSTING VERZAMELD'); } else if (a.type === 'munitie') { reserve += 30; announce('+30 MUNITIE'); } else if (a.type === 'schild') { player.shield = Math.min(50, player.shield + 20); announce('+20 SCHILD'); } else if (a.type === 'hout') { material += 25; announce('+25 MATERIAAL'); } else { medkits++; announce('+1 EHBO-SET'); } });
        if (!bots.some(b => b.alive)) finish(true);
        text('healthValue', Math.ceil(player.hp)); text('shieldValue', Math.ceil(player.shield)); document.getElementById('healthBar').style.width = `${player.hp}%`; document.getElementById('shieldBar').style.width = `${player.shield * 2}%`;
        const remaining = bots.filter(b => b.alive).length + 1; text('playersLeft', remaining); text('playersLeftTop', remaining); text('killValue', kills); text('materialsValue', material); text('stormTimer', `${Math.ceil(storm.next)}s`);
        document.getElementById('stormWarning').classList.toggle('active', dist(player, storm) > storm.r); document.getElementById('stormWarning').querySelector('.storm-warning-text').textContent = dist(player, storm) > storm.r ? 'STORM · VIND DE VEILIGE ZONE' : `VEILIGE ZONE · ${Math.ceil(storm.next)}s`;
        document.getElementById('inventoryList').innerHTML = player.weapons.map((a, i) => `<div class="inventory-item ${i === slot ? 'selected' : ''}" data-slot="${i}"><span class="slot-num">${i + 1}</span><span class="inventory-item-name"><b>${a.name}</b><small>${a.rarity}</small></span><span class="inventory-item-count">${a.ammo}</span></div>`).join('') + `<div class="inventory-item utility-row"><span>EHBO</span><span class="inventory-item-count">${medkits} ×</span></div>`;
        const weapon = player.weapons[slot]; document.getElementById('weaponInfo').innerHTML = `<span>${weapon.kind}</span><strong>${weapon.ammo}</strong><i>/ ${reserve}</i>${player.reloading ? '<em>HERLADEN</em>' : ''}`;
        const toast = document.getElementById('gameToast'); toast.textContent = toastText; toast.classList.toggle('visible', now < toastUntil); document.getElementById('buildMode').classList.toggle('active', keys.has('e'));
        feed = feed.filter(a => (a.time -= dt) > 0); document.getElementById('killFeed').innerHTML = feed.map(a => `<div class="kill-entry">${a.text}</div>`).join('');
    }
    function shoot(now) { const w = player.weapons[slot]; if (now - lastShot < w.rate || now < reloadAt) return; if (!w.ammo) { reload(); return; } lastShot = now; w.ammo--; for (let n = 0; n < (w.pellets || 1); n++) { const a = player.angle + rand(-w.spread, w.spread); bullets.push({ x: player.x + Math.cos(a) * 26, y: player.y + Math.sin(a) * 26, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.2, damage: w.damage, owner: player, color: w.color }); } tone(w.kind === 'POMP' ? 90 : 180, .05); if (!w.ammo) reload(); }
    function hurtBot(b, amount, byPlayer = true) { let rest = amount; if (b.shield) { const absorbed = Math.min(b.shield, rest); b.shield -= absorbed; rest -= absorbed; } b.hp -= rest; if (byPlayer) dealt += amount; if (b.hp <= 0) eliminate(b, byPlayer ? 'jij' : 'een tegenstander'); }
    function eliminate(b, cause) { if (!b.alive) return; b.alive = false; if (cause === 'jij') { kills++; feed.unshift({ text: `Jij schakelde ${b.name} uit`, time: 5 }); loot.push({ x: b.x, y: b.y, type: 'munitie', open: false }); if (kills % 3 === 0) material += 20; } else feed.unshift({ text: `${b.name} viel door ${cause}`, time: 5 }); feed = feed.slice(0, 4); }
    function hurtPlayer(amount) { if (player.invulnerable > 0) return; let rest = amount; if (player.shield) { const absorbed = Math.min(player.shield, rest); player.shield -= absorbed; rest -= absorbed; } player.hp = Math.max(0, player.hp - rest); if (!player.hp) finish(false); }
    function reload() { const w = player.weapons[slot]; if (player.reloading || w.ammo >= w.mag || !reserve) return; player.reloading = true; reloadAt = performance.now() + w.reload; announce('HERLADEN...'); }
    function finishReload() { const w = player.weapons[slot], amount = Math.min(w.mag - w.ammo, reserve); w.ammo += amount; reserve -= amount; player.reloading = false; reloadAt = 0; }
    function heal() { if (!medkits || player.hp >= 100) { announce(medkits ? 'GEZONDHEID IS VOL' : 'GEEN EHBO-SETS'); return; } medkits--; player.hp = Math.min(100, player.hp + 45); announce('EHBO GEBRUIKT · +45 HP'); tone(520, .14); }
    function build() { if (material < 10) { announce('NIET GENOEG MATERIAAL'); return; } walls.push({ x: player.x + Math.cos(player.angle) * 58, y: player.y + Math.sin(player.angle) * 58, hp: 100, life: 40, owner: player }); material -= 10; tone(260, .07); }
    function announce(value) { toastText = value; toastUntil = performance.now() + 2100; }
    function tone(freq, seconds) { if (!sound) return; try { audio ||= new AudioContext(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.value = freq; gain.gain.setValueAtTime(.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + seconds); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + seconds); } catch (_) { sound = false; } }
    function finish(won) { if (state !== 'playing') return; state = 'ended'; const place = bots.filter(b => b.alive).length + 1; text('gameOverTitle', won ? 'OVERWINNING!' : 'EINDE VAN DE RUN'); text('finalPlace', won ? '1e' : `${place}e`); text('finalKills', kills); text('finalDamage', Math.floor(dealt)); endScreen.classList.remove('hidden'); requestAnimationFrame(() => endScreen.classList.add('active')); }
    function returnToMenu() { state = 'menu'; endScreen.classList.remove('active'); endScreen.classList.add('hidden'); menu.classList.remove('hidden'); hud.style.display = 'none'; player = undefined; bots = []; bullets = []; walls = []; loot = []; storm = { x: 1500, y: 1500, r: 1460, phase: 0, next: 25 }; cam = { x: SIZE / 2, y: SIZE / 2 }; requestAnimationFrame(idle); }
    function toggleSound() { sound = !sound; const el = document.getElementById('soundToggle'); if (el) el.textContent = sound ? '♫ GELUID AAN' : '♫ GELUID UIT'; if (sound) tone(540, .08); }
    function setupInterface() {
        document.title = 'GAMEFORT | Laatste Zone';
        document.querySelector('#mainMenu .menu-content').innerHTML = `<div class="menu-kicker"><i></i> SEIZOEN 01 · DE GROENE GRENS</div><h1 class="game-title">GAMEFORT</h1><p class="menu-subtitle">LAATSTE ZONE</p><div class="menu-rule"></div><p class="menu-description">Een eiland. Een storm. Blijf als laatste over.</p><div class="menu-form"><label for="difficultySelect">TEGENSTANDERS</label><select id="difficultySelect"><option>Rustig</option><option selected>Normaal</option><option>Heftig</option></select></div><button class="menu-button primary-button" onclick="startGame()"><span>DROP HET EILAND OP</span><b>→</b></button><button class="sound-button" id="soundToggle" onclick="toggleSound()">♫ GELUID AAN</button><div class="menu-foot">22 TEGENSTANDERS　·　6 LANDINGSZONES　·　1 KAMPIOEN</div>`;
        document.querySelector('#gameOverScreen .game-over-content').innerHTML = `<div class="menu-kicker">RUN VOLTOOID</div><div class="game-over-title" id="gameOverTitle">EINDE VAN DE RUN</div><div class="game-over-stats"><div><span>PLAATS</span><strong id="finalPlace">-</strong></div><div><span>UITGESCHAKELD</span><strong id="finalKills">0</strong></div><div><span>SCHADE</span><strong id="finalDamage">0</strong></div></div><button class="game-over-button" onclick="startGame()">OPNIEUW DROPPEN　→</button><button class="sound-button" onclick="returnToMenu()">TERUG NAAR MENU</button>`;
        document.querySelector('.players-left').innerHTML = '<div class="eyebrow">OVERLEVENDEN</div><div class="players-count" id="playersLeft">23</div>';
        document.querySelector('.inventory-title').textContent = 'UITRUSTING';
        document.querySelector('.controls-display').innerHTML = '<div class="control-heading">VELDHANDLEIDING　<span>01</span></div><div class="control-item"><span class="control-key">W A S D</span> Verplaatsen</div><div class="control-item"><span class="control-key">SHIFT</span> Sprinten</div><div class="control-item"><span class="control-key">MUIS</span> Richten / vuren</div><div class="control-item"><span class="control-key">1 — 5</span> Wapen kiezen</div><div class="control-item"><span class="control-key">R</span> Herladen　<span class="control-key">Q</span> EHBO</div><div class="control-item"><span class="control-key">E</span> Houten muur</div>';
        document.querySelectorAll('.stat-label')[0].textContent = 'GEZONDHEID'; document.querySelectorAll('.stat-label')[1].textContent = 'SCHILD';
        const bar = document.createElement('div'); bar.className = 'match-bar'; bar.innerHTML = '<div class="match-brand">GF <span>/ VELDOPERATIE</span></div><div class="match-stats"><span><i></i> OVERLEVENDEN <b id="playersLeftTop">23</b></span><span>ELIMINATIES <b id="killValue">0</b></span><span>MATERIAAL <b id="materialsValue">90</b></span></div><div class="match-zone">STORM SLUIT OVER <b id="stormTimer">25s</b></div>'; hud.appendChild(bar);
        [['weaponInfo', 'weapon-info'], ['gameToast', 'game-toast'], ['buildMode', 'build-mode']].forEach(([id, cls]) => { const div = document.createElement('div'); div.id = id; div.className = cls; hud.appendChild(div); });
        document.getElementById('buildMode').textContent = 'BOUWEN · HOUTEN MUUR';
        const touch = document.createElement('div'); touch.id = 'touchControls'; touch.innerHTML = '<div class="touch-stick" id="touchStick"><span></span></div><button class="touch-action touch-fire" id="touchFire">VUUR</button><button class="touch-action touch-build" id="touchBuild">BOUW</button><button class="touch-action touch-heal" id="touchHeal">EHBO</button>'; hud.appendChild(touch);
        document.getElementById('touchFire').addEventListener('pointerdown', e => { e.preventDefault(); touchFire = true; }); document.getElementById('touchFire').addEventListener('pointerup', () => touchFire = false); document.getElementById('touchBuild').addEventListener('click', build); document.getElementById('touchHeal').addEventListener('click', heal);
        const pad = document.getElementById('touchStick'); pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); moveStick(e); }); pad.addEventListener('pointermove', e => { if (e.buttons) moveStick(e); }); pad.addEventListener('pointerup', () => { stick = { x: 0, y: 0 }; pad.style.setProperty('--sx', '0px'); pad.style.setProperty('--sy', '0px'); });
        function moveStick(e) { const r = pad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, l = Math.max(1, Math.hypot(x, y)), k = Math.min(1, 38 / l); stick = { x: clamp(x / 38, -1, 1), y: clamp(y / 38, -1, 1) }; pad.style.setProperty('--sx', `${x * k}px`); pad.style.setProperty('--sy', `${y * k}px`); }
        document.getElementById('inventoryList').addEventListener('click', e => { const item = e.target.closest('[data-slot]'); if (item) slot = Number(item.dataset.slot); });
    }
    window.startGame = startGame; window.returnToMenu = returnToMenu; window.toggleSound = toggleSound;
    addEventListener('resize', resize); addEventListener('keydown', e => {
        const k = e.key.toLowerCase(); keys.add(k);
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
        if (e.repeat) return;
        if (state === 'paused' && k === 'enter') { state = 'playing'; last = performance.now(); requestAnimationFrame(loop); return; }
        if (state !== 'playing') return;
        if (k === 'r') reload(); else if (k === 'q') heal(); else if (k === 'e') build();
        else if (k >= '1' && k <= '5') { slot = Math.min(+k - 1, player.weapons.length - 1); player.reloading = false; reloadAt = 0; }
        else if (k === ' ') { player.invulnerable = .22; player.x = clamp(player.x + Math.cos(player.angle) * 60, 15, SIZE - 15); player.y = clamp(player.y + Math.sin(player.angle) * 60, 15, SIZE - 15); }
        else if (k === 'escape') { state = 'paused'; announce('PAUZE · DRUK OP ENTER OM VERDER TE SPELEN'); }
    });
    addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => { keys.clear(); mouse.down = false; touchFire = false; }); addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }); addEventListener('pointerdown', e => { if (e.button === 0 && state === 'playing' && e.target.tagName !== 'BUTTON') mouse.down = true; }); addEventListener('pointerup', () => mouse.down = false); addEventListener('contextmenu', e => e.preventDefault());
    setupInterface(); resize(); buildWorld(); cam = { x: SIZE / 2, y: SIZE / 2 }; endScreen.classList.add('hidden');
    function idle() { if (state === 'menu') { draw(); requestAnimationFrame(idle); } } requestAnimationFrame(idle);
})();