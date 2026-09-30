(() => {
    'use strict';
    if (!window.THREE) {
        document.querySelector('#mainMenu .menu-content').innerHTML = '<h1 class="game-title">GAMEFORT</h1><p>Three.js kon niet worden geladen. Controleer je internetverbinding.</p>';
        return;
    }

    const T = THREE, canvas = document.getElementById('canvas'), mapCanvas = document.getElementById('minimapCanvas');
    const mapCtx = mapCanvas.getContext('2d'), menu = document.getElementById('mainMenu'), hud = document.getElementById('hud'), endScreen = document.getElementById('gameOverScreen');
    const HALF = 110, keys = new Set(), clock = new T.Clock(), raycaster = new T.Raycaster();
    const scene = new T.Scene(); scene.background = new T.Color('#7da9bd'); scene.fog = new T.Fog('#d1c9ab', 78, 178);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7)); renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
    const camera = new T.PerspectiveCamera(76, innerWidth / innerHeight, .1, 240); camera.rotation.order = 'YXZ'; scene.add(camera);
    scene.add(new T.HemisphereLight('#e7f0e4', '#536844', 1.45));
    const sun = new T.DirectionalLight('#ffe9bd', 2.2); sun.position.set(-35, 62, 28); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.left = -100; sun.shadow.camera.right = 100; sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100; scene.add(sun);

    const guns = [
        { name: 'Ranger', kind: 'AR', damage: 28, rate: 180, reload: 1300, mag: 24, spread: .01, color: '#8cdaa9', rarity: 'ONGEWOON' },
        { name: 'Stuiter', kind: 'POMP', damage: 13, rate: 720, reload: 1550, mag: 6, spread: .055, pellets: 7, color: '#d998e4', rarity: 'ZELDZAAM' },
        { name: 'Lange arm', kind: 'DMR', damage: 62, rate: 850, reload: 1750, mag: 5, spread: .003, color: '#7ac6ef', rarity: 'EPISCH' },
        { name: 'Ratel', kind: 'SMG', damage: 15, rate: 95, reload: 1400, mag: 32, spread: .022, color: '#f2c96c', rarity: 'ONGEWOON' }
    ];
    const places = [
        { name: 'KOPERHAVEN', x: -59, z: -50, color: '#c78f70' }, { name: 'MOSMARKT', x: 55, z: -52, color: '#a98b69' },
        { name: 'OUDE DAM', x: 0, z: 0, color: '#c6a778' }, { name: 'ZONNEVELD', x: -56, z: 54, color: '#ceab72' },
        { name: 'KRATERPARK', x: 59, z: 54, color: '#9ca67b' }, { name: 'RADARPOST', x: 0, z: 83, color: '#8b9d91' }
    ];
    const mat = {
        ground: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
        wood: new T.MeshStandardMaterial({ color: '#b9875b', roughness: .92 }),
        woodLight: new T.MeshStandardMaterial({ color: '#d0a16b', roughness: .9 }),
        roof: new T.MeshStandardMaterial({ color: '#66584a', roughness: .95 }),
        trunk: new T.MeshStandardMaterial({ color: '#72553a', roughness: 1 }),
        leaf: new T.MeshStandardMaterial({ color: '#47744c', roughness: 1 }),
        leaf2: new T.MeshStandardMaterial({ color: '#6d8d54', roughness: 1 }),
        player: new T.MeshStandardMaterial({ color: '#248b7d', roughness: .7 }),
        skin: new T.MeshStandardMaterial({ color: '#e4b995', roughness: .85 })
    };
    const groundCanvas = document.createElement('canvas'); groundCanvas.width = groundCanvas.height = 512;
    const groundCtx = groundCanvas.getContext('2d'); groundCtx.fillStyle = '#718451'; groundCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1500; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, radius = 2 + Math.random() * 12;
        groundCtx.fillStyle = ['rgba(181,177,105,.10)', 'rgba(41,80,47,.10)', 'rgba(210,194,128,.08)'][i % 3];
        groundCtx.beginPath(); groundCtx.ellipse(x, y, radius * 1.5, radius, Math.random() * Math.PI, 0, Math.PI * 2); groundCtx.fill();
    }
    const groundTexture = new T.CanvasTexture(groundCanvas); groundTexture.encoding = T.sRGBEncoding; mat.ground.map = groundTexture; mat.ground.needsUpdate = true;
    let state = 'menu', player, bots = [], botParts = [], loot = [], walls = [], obstacles = [], tracers = [];
    let storm = { x: 0, z: 0, radius: 92, timer: 30, phase: 0 }, stormRing;
    let yaw = 0, pitch = 0, firing = false, touchFiring = false, touchLook = null, stick = { x: 0, y: 0 };
    let selected = 0, buildIndex = 0, buildModeUntil = 0, dashReadyAt = 0, reserve = 144, materials = 90, medkits = 2, kills = 0, damageTotal = 0, lastShot = 0, reloadUntil = 0;
    const buildPieces = [
        { label: 'MUUR', cost: 10, size: [5.4, 3.2, .55], height: 1.6, blocksMovement: true },
        { label: 'LAGE MUUR', cost: 8, size: [5.4, 1.6, .5], height: .8, blocksMovement: true },
        { label: 'VLOER', cost: 12, size: [5.4, .3, 5.4], height: .15 },
        { label: 'HELLING', cost: 15, size: [5.4, .3, 5.4], height: 1.35, tilt: Math.PI / 6 }
    ];
    let difficulty = 'Normaal', soundOn = true, audio, toast = '', toastUntil = 0, feed = [], inventoryKey = '';
    const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    function requestLock() { try { const result = canvas.requestPointerLock?.(); result?.catch?.(() => {}); } catch (_) { /* Pointer lock is optional. */ } }

    function mesh(geometry, material, parent, x, y, z, cast = true) {
        const object = new T.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = cast; object.receiveShadow = true; parent.add(object); return object;
    }
    function createSky() {
        const skyCanvas = document.createElement('canvas'); skyCanvas.width = 1024; skyCanvas.height = 512;
        const context = skyCanvas.getContext('2d'), gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#4e83a7'); gradient.addColorStop(.5, '#89b2c0'); gradient.addColorStop(.78, '#d5cfb3'); gradient.addColorStop(1, '#dfc29c');
        context.fillStyle = gradient; context.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * 1024, y = 95 + Math.random() * 220, rx = 24 + Math.random() * 100, ry = 8 + Math.random() * 22;
            const cloud = context.createRadialGradient(x, y, 1, x, y, rx);
            cloud.addColorStop(0, 'rgba(255,250,230,.19)'); cloud.addColorStop(.55, 'rgba(255,250,230,.09)'); cloud.addColorStop(1, 'rgba(255,250,230,0)');
            context.fillStyle = cloud; context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fill();
        }
        const texture = new T.CanvasTexture(skyCanvas); texture.encoding = T.sRGBEncoding;
        const dome = new T.Mesh(new T.SphereGeometry(220, 48, 32), new T.MeshBasicMaterial({ map: texture, side: T.BackSide, fog: false, depthWrite: false }));
        scene.add(dome);
    }
    function label(text, x, z) {
        const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
        g.fillStyle = 'rgba(20,38,32,.8)'; g.fillRect(8, 14, 496, 100); g.strokeStyle = '#b9d9a9'; g.lineWidth = 4; g.strokeRect(8, 14, 496, 100);
        g.fillStyle = '#f3efdb'; g.font = 'bold 42px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 65);
        const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
        sprite.position.set(x, 8, z); sprite.scale.set(14, 3.5, 1); scene.add(sprite);
    }
    function building(x, z, color, w, d, h) {
        const group = new T.Group(); group.position.set(x, 0, z); scene.add(group);
        mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, roughness: .94 }), group, 0, h / 2, 0);
        const roof = mesh(new T.ConeGeometry(Math.max(w, d) * .76, 1.8, 4), mat.roof, group, 0, h + .85, 0);
        roof.rotation.y = Math.PI / 4;
        for (let i = 0; i < 3; i++) {
            const wx = (i - 1) * w / 3;
            mesh(new T.BoxGeometry(.9, 1.05, .12), new T.MeshStandardMaterial({ color: '#9bc4c1', roughness: .55 }), group, wx, h * .6, d / 2 + .08, false);
            mesh(new T.BoxGeometry(.9, 1.05, .12), new T.MeshStandardMaterial({ color: '#9bc4c1', roughness: .55 }), group, wx, h * .6, -d / 2 - .08, false);
        }
        obstacles.push({ x, z, hx: w / 2 + .5, hz: d / 2 + .5 });
    }
    function tree(x, z, scale) {
        const group = new T.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); scene.add(group);
        mesh(new T.CylinderGeometry(.22, .38, 3, 7), mat.trunk, group, 0, 1.5, 0);
        const crown = mesh(new T.SphereGeometry(1, 12, 10), mat.leaf, group, 0, 3.55, 0); crown.scale.set(1.6, 1.35, 1.45);
        const crownTop = mesh(new T.SphereGeometry(1, 12, 10), mat.leaf2, group, -.35, 4.35, -.12); crownTop.scale.set(1.12, .95, 1.08);
        obstacles.push({ x, z, hx: .85 * scale, hz: .85 * scale });
    }
    function createGunModel() {
        const gun = new T.Group();
        const metal = new T.MeshStandardMaterial({ color: '#344239', metalness: .45, roughness: .45 });
        const trim = new T.MeshStandardMaterial({ color: '#8a9b84', metalness: .4, roughness: .42 });
        mesh(new T.BoxGeometry(.17, .18, .68), metal, gun, 0, 0, -.24, false);
        mesh(new T.CylinderGeometry(.045, .055, .58, 10), trim, gun, 0, .025, -.82, false).rotation.x = Math.PI / 2;
        mesh(new T.BoxGeometry(.1, .25, .17), new T.MeshStandardMaterial({ color: '#9a7350' }), gun, 0, -.18, -.24, false);
        mesh(new T.BoxGeometry(.13, .29, .16), metal, gun, 0, -.22, -.02, false);
        mesh(new T.BoxGeometry(.12, .1, .2), trim, gun, 0, .13, -.25, false);
        mesh(new T.CylinderGeometry(.09, .09, .07, 12), metal, gun, 0, .15, -.27, false);
        gun.position.set(.38, -.31, -.62); camera.add(gun);
    }
    function createWorld() {
        createSky();
        const floor = mesh(new T.PlaneGeometry(220, 220), mat.ground, scene, 0, -.13, 0, false); floor.rotation.x = -Math.PI / 2;
        places.forEach((p, index) => {
            label(p.name, p.x, p.z - 11);
            for (let i = 0; i < 5; i++) building(p.x + (i % 3 - 1) * 8.5 + rand(-1, 1), p.z + (Math.floor(i / 3) - .5) * 8 + rand(-1, 1), i % 2 ? p.color : ['#c58f6d', '#b47b62', '#d0b781'][index % 3], rand(5.5, 8), rand(5, 7), rand(3.8, 6));
        });
        for (let i = 0; i < 150; i++) {
            const x = rand(-103, 103), z = rand(-103, 103);
            if (places.some(p => Math.abs(x - p.x) < 15 && Math.abs(z - p.z) < 13) || Math.abs(x) < 4 || Math.abs(z) < 4) continue;
            tree(x, z, rand(.7, 1.25));
        }
        const pond = mesh(new T.CircleGeometry(17, 48), new T.MeshStandardMaterial({ color: '#4d9297', roughness: .25, metalness: .12 }), scene, 33, .015, 4, false); pond.rotation.x = -Math.PI / 2;
        stormRing = new T.Mesh(new T.TorusGeometry(1, .14, 8, 160), new T.MeshBasicMaterial({ color: '#b9efff', transparent: true, opacity: .9 }));
        stormRing.rotation.x = Math.PI / 2; stormRing.position.y = .3; scene.add(stormRing); createGunModel();
    }
    function makeBot(bot) {
        const group = new T.Group(); group.position.set(bot.x, 0, bot.z); scene.add(group); bot.mesh = group;
        const shirt = new T.MeshStandardMaterial({ color: bot.color, roughness: .75 }), pants = new T.MeshStandardMaterial({ color: '#39453e', roughness: .9 });
        const torso = mesh(new T.CylinderGeometry(.47, .55, 1.12, 14), shirt, group, 0, 1.28, 0);
        const head = mesh(new T.SphereGeometry(.34, 16, 12), mat.skin, group, 0, 2.08, 0);
        for (const side of [-1, 1]) {
            mesh(new T.SphereGeometry(.25, 10, 8), shirt, group, side * .43, 1.61, 0);
            const arm = mesh(new T.CylinderGeometry(.13, .18, .66, 10), shirt, group, side * .49, 1.29, .23); arm.rotation.x = Math.PI / 2; arm.rotation.z = side * -.1;
            mesh(new T.CylinderGeometry(.17, .22, .72, 10), pants, group, side * .24, .47, 0);
            mesh(new T.BoxGeometry(.32, .18, .48), pants, group, side * .24, .12, .08);
        }
        mesh(new T.BoxGeometry(.72, .57, .18), new T.MeshStandardMaterial({ color: '#59654a', roughness: .85 }), group, 0, 1.3, .39);
        mesh(new T.BoxGeometry(.46, .62, .3), pants, group, 0, 1.36, -.4);
        const helmet = mesh(new T.SphereGeometry(.38, 14, 10), new T.MeshStandardMaterial({ color: '#c29d5d', roughness: .6 }), group, 0, 2.34, 0); helmet.scale.set(1.12, .44, 1.1);
        mesh(new T.BoxGeometry(.13, .13, .68), new T.MeshStandardMaterial({ color: '#303a35', metalness: .35, roughness: .55 }), group, 0, 1.08, .68);
        mesh(new T.CylinderGeometry(.035, .045, .46, 8), pants, group, 0, 1.1, 1.2).rotation.x = Math.PI / 2;
        torso.userData.bot = bot; head.userData.bot = bot; bot.hitParts = [torso, head]; botParts.push(torso, head);
        const bar = new T.Group(); bar.position.set(0, 2.7, 0); group.add(bar); bot.bar = bar;
        mesh(new T.PlaneGeometry(1.1, .12), new T.MeshBasicMaterial({ color: '#24352e', side: T.DoubleSide }), bar, 0, 0, 0, false);
        bot.fill = mesh(new T.PlaneGeometry(1.04, .07), new T.MeshBasicMaterial({ color: '#e9826c', side: T.DoubleSide }), bar, 0, 0, .01, false);
    }
    function createLoot() {
        loot.forEach(item => scene.remove(item.mesh)); loot = [];
        const types = ['munitie', 'schild', 'hout', 'ehbo'];
        for (let i = 0; i < 65; i++) {
            let x = rand(-99, 99), z = rand(-99, 99);
            const type = Math.random() < .2 ? 'kist' : types[Math.floor(Math.random() * types.length)];
            const color = ({ kist: '#ffd16c', munitie: '#f0c870', schild: '#69d0ed', hout: '#dba36d', ehbo: '#e98376' })[type];
            const object = new T.Mesh(type === 'kist' ? new T.BoxGeometry(1.15, .78, .85) : new T.OctahedronGeometry(.48), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .28, roughness: .4 }));
            object.position.set(x, type === 'kist' ? .48 : .9, z); object.castShadow = true; scene.add(object); loot.push({ x, z, type, mesh: object, phase: rand(0, 6), taken: false });
        }
    }
    function clearMatch() {
        bots.forEach(bot => scene.remove(bot.mesh)); botParts = [];
        tracers.forEach(tracer => scene.remove(tracer.mesh)); tracers = [];
        walls.forEach(w => scene.remove(w.mesh)); walls = [];
    }
    function startGame() {
        difficulty = document.getElementById('difficultySelect')?.value || 'Normaal'; clearMatch(); createLoot();
        storm = { x: 0, z: 0, radius: 92, timer: 30, phase: 0 };
        const drop = places[Math.floor(Math.random() * places.length)];
        let spawn;
        for (let attempt = 0; attempt < 100 && !spawn; attempt++) {
            const angle = rand(0, Math.PI * 2), radius = rand(13, 19);
            const candidate = { x: drop.x + Math.cos(angle) * radius, z: drop.z + Math.sin(angle) * radius };
            if (Math.hypot(candidate.x, candidate.z) < storm.radius - 5 && canMove(candidate.x, candidate.z)) spawn = candidate;
        }
        for (let attempt = 0; attempt < 200 && !spawn; attempt++) {
            const candidate = { x: rand(-65, 65), z: rand(-65, 65) };
            if (canMove(candidate.x, candidate.z)) spawn = candidate;
        }
        spawn ||= { x: -17, z: 18 };
        player = { x: spawn.x, z: spawn.z, hp: 100, shield: 50, invulnerable: 0, jumpHeight: 0, jumpVelocity: 0, grounded: true, weapons: [{ ...guns[0], ammo: 24 }], reloading: false };
        const count = difficulty === 'Rustig' ? 12 : difficulty === 'Heftig' ? 20 : 16;
        for (let i = 0; i < count; i++) {
            let x, z; do { x = rand(-98, 98); z = rand(-98, 98); } while (Math.hypot(x - player.x, z - player.z) < 30);
            const bot = { name: ['Koraal', 'Bram', 'Pixel', 'Vonk', 'Riff', 'Nova', 'Maan', 'Flint', 'Echo', 'Sproet'][i % 10], x, z, hp: 100, shield: Math.random() > .5 ? 25 : 0, speed: rand(2.1, 3), nextShot: rand(1, 3), alive: true, dir: rand(-3, 3), strafe: Math.random() < .5 ? -1 : 1, phase: rand(0, 6), color: ['#bb6956', '#8673ae', '#4d8991', '#a47a44'][i % 4] };
            bots.push(bot); makeBot(bot);
        }
        stormRing.position.set(0, .3, 0); stormRing.scale.setScalar(storm.radius);
        selected = 0; buildIndex = 0; dashReadyAt = 0; reserve = 144; materials = 90; medkits = 2; kills = 0; damageTotal = 0; feed = []; inventoryKey = ''; lastShot = 0; reloadUntil = 0;
        yaw = 0; pitch = -.035; camera.position.set(player.x, 1.72, player.z); camera.rotation.set(pitch, yaw, 0);
        menu.classList.add('hidden'); endScreen.classList.add('hidden'); endScreen.classList.remove('active'); document.getElementById('pauseScreen').classList.add('hidden'); hud.style.display = 'block'; state = 'playing';
        document.getElementById('touchControls').classList.toggle('visible', innerWidth < 760); announce('VERZAMEL UITRUSTING · BLIJF BINNEN DE ZONE');
        requestLock();
        clock.getDelta();
    }
    function frame() {
        const dt = Math.min(clock.getDelta(), .045), now = performance.now() / 1000;
        if (state === 'playing') update(dt, now);
        const seconds = performance.now() / 1000;
        loot.forEach(item => { if (!item.taken) { item.mesh.rotation.y += dt * .65; item.mesh.position.y = (item.type === 'kist' ? .48 : .9) + Math.sin(seconds * 2 + item.phase) * .12; } });
        renderer.render(scene, camera); requestAnimationFrame(frame);
    }
    function update(dt, now) {
        movePlayer(dt);
        bots.forEach(bot => updateBot(bot, dt, now));
        updateStorm(dt); updateBullets(dt, now); collectLoot();
        if (state !== 'playing') return;
        updateHud(now, dt); drawMap();
        if (!bots.some(bot => bot.alive)) finish(true);
    }
    function movePlayer(dt) {
        const f = (keys.has('w') || keys.has('z') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - stick.y;
        const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('q') || keys.has('arrowleft') ? 1 : 0) + stick.x;
        const length = Math.hypot(f, s) || 1, speed = (keys.has('shift') ? 10 : 6.6) * dt;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const x = player.x + (fx * f + rx * s) / length * speed, z = player.z + (fz * f + rz * s) / length * speed;
        if (canMove(x, player.z)) player.x = x; if (canMove(player.x, z)) player.z = z;
        player.x = clamp(player.x, -108, 108); player.z = clamp(player.z, -108, 108);
        if (!player.grounded) {
            player.jumpVelocity -= 20 * dt; player.jumpHeight = Math.max(0, player.jumpHeight + player.jumpVelocity * dt);
            if (player.jumpHeight === 0) { player.grounded = true; player.jumpVelocity = 0; }
        }
        camera.position.set(player.x, 1.72 + player.jumpHeight, player.z); camera.rotation.set(pitch, yaw, 0);
        if (firing || touchFiring) shoot(performance.now());
        if (player.reloading && performance.now() >= reloadUntil) finishReload();
        if (player.invulnerable > 0) player.invulnerable -= dt;
    }
    function jump() { if (!player.grounded) return; player.grounded = false; player.jumpVelocity = 8; }
    function dash() {
        const now = performance.now(); if (state !== 'playing' || now < dashReadyAt) return;
        dashReadyAt = now + 1500; const steps = 20, dx = -Math.sin(yaw) * 8 / steps, dz = -Math.cos(yaw) * 8 / steps;
        for (let i = 0; i < steps; i++) { if (!canMove(player.x + dx, player.z + dz)) break; player.x = clamp(player.x + dx, -108, 108); player.z = clamp(player.z + dz, -108, 108); }
        player.invulnerable = Math.max(player.invulnerable, .2); tone(280, .07); announce('DASH');
    }
    function insideWall(wall, x, z) {
        if (!wall.blocksMovement) return false;
        const dx = x - wall.x, dz = z - wall.z, cosine = Math.cos(wall.yaw), sine = Math.sin(wall.yaw);
        return Math.abs(dx * cosine - dz * sine) < wall.hx && Math.abs(dx * sine + dz * cosine) < wall.hz;
    }
    function canMove(x, z) { return !obstacles.some(o => Math.abs(x - o.x) < o.hx + .4 && Math.abs(z - o.z) < o.hz + .4) && !walls.some(w => insideWall(w, x, z)); }
    function canSeeTarget(from, to) {
        const length = distance(from, to), steps = Math.ceil(length / 2);
        for (let i = 2; i < steps; i++) {
            const x = from.x + (to.x - from.x) * i / steps, z = from.z + (to.z - from.z) * i / steps;
            if (obstacles.some(obstacle => Math.abs(x - obstacle.x) < obstacle.hx && Math.abs(z - obstacle.z) < obstacle.hz) || walls.some(wall => insideWall(wall, x, z))) return false;
        }
        return true;
    }
    function moveBot(bot, dx, dz) {
        if (canMove(bot.x + dx, bot.z + dz)) { bot.x += dx; bot.z += dz; }
        else if (canMove(bot.x + dx, bot.z)) bot.x += dx;
        else if (canMove(bot.x, bot.z + dz)) bot.z += dz;
        else bot.strafe *= -1;
    }
    function updateBot(bot, dt, now) {
        if (!bot.alive) return;
        const pd = distance(bot, player); let target = pd < 48 ? player : null, d = target ? pd : Infinity;
        bots.forEach(other => { if (!other.alive || other === bot) return; const nd = distance(bot, other); if (nd < d) { target = other; d = nd; } });
        if (target && d < 54) {
            const dx = target.x - bot.x, dz = target.z - bot.z, invDistance = 1 / Math.max(d, .01); bot.mesh.rotation.y = Math.atan2(dx, dz);
            const desired = target === player ? 18 : 9, retreatAt = bot.hp < 35 ? desired + 5 : desired - 4;
            const forward = d > desired + 4 ? 1 : d < retreatAt ? -.8 : 0, strafe = bot.strafe * (.28 + Math.sin(now * 1.8 + bot.phase) * .38);
            moveBot(bot, (dx * invDistance * forward - dz * invDistance * strafe) * bot.speed * dt, (dz * invDistance * forward + dx * invDistance * strafe) * bot.speed * dt);
            if (now > bot.nextShot) {
                bot.nextShot = now + rand(.9, difficulty === 'Heftig' ? 1.35 : 1.9);
                const range = difficulty === 'Heftig' ? 38 : 31, accuracy = difficulty === 'Heftig' ? .7 : difficulty === 'Rustig' ? .38 : .52;
                if (d < range && canSeeTarget(bot, target) && Math.random() < accuracy) {
                    if (target === player) hurtPlayer(difficulty === 'Heftig' ? 8 : 5); else damageBot(target, 12, false);
                }
            }
        } else { bot.dir += rand(-.035, .035); const x = bot.x + Math.sin(bot.dir) * bot.speed * .4 * dt, z = bot.z + Math.cos(bot.dir) * bot.speed * .4 * dt; if (canMove(x, z)) { bot.x = x; bot.z = z; } else bot.dir += 2; }
        bot.mesh.position.set(bot.x, 0, bot.z); bot.bar.lookAt(camera.position);
        bot.fill.scale.x = Math.max(.01, bot.hp / 100); bot.fill.position.x = -.52 * (1 - bot.hp / 100);
        if (distance(bot, storm) > storm.radius) { bot.hp -= 4 * dt; if (bot.hp <= 0) eliminate(bot, 'de storm', false); }
    }
    function shoot(now) {
        const gun = player.weapons[selected]; if (!gun || player.reloading || now - lastShot < gun.rate) return;
        if (gun.ammo <= 0) { reload(); return; } lastShot = now; gun.ammo--;
        for (let i = 0; i < (gun.pellets || 1); i++) {
            const direction = new T.Vector3(rand(-gun.spread, gun.spread), rand(-gun.spread, gun.spread), -1).applyQuaternion(camera.quaternion).normalize();
            raycaster.set(camera.position, direction); const hits = raycaster.intersectObjects([...botParts.filter(part => part.userData.bot?.alive), ...walls.map(w => w.mesh)], true);
            const end = hits.length && hits[0].distance < 85 ? hits[0].point : camera.position.clone().addScaledVector(direction, 65);
            const tracer = new T.Line(new T.BufferGeometry().setFromPoints([camera.position.clone(), end]), new T.LineBasicMaterial({ color: gun.color, transparent: true, opacity: .84 })); scene.add(tracer); tracers.push({ mesh: tracer, life: .075 });
            const target = hits.length && hits[0].distance < 85 ? hits[0].object.userData.bot : null;
            if (target) damageBot(target, gun.damage, true);
        }
        tone(gun.kind === 'POMP' ? 100 : 180, .05); if (!gun.ammo) reload();
    }
    function damageBot(bot, amount, byPlayer) {
        if (!bot?.alive) return;
        let rest = amount; if (bot.shield > 0) { const absorbed = Math.min(bot.shield, rest); bot.shield -= absorbed; rest -= absorbed; }
        bot.hp -= rest; if (byPlayer) damageTotal += amount;
        if (bot.hp <= 0) eliminate(bot, byPlayer ? 'jij' : 'een tegenstander', byPlayer);
    }
    function eliminate(bot, cause, byPlayer) {
        if (!bot.alive) return; bot.alive = false; scene.remove(bot.mesh); botParts = botParts.filter(part => part.userData.bot !== bot);
        if (byPlayer) { kills++; feed.unshift({ text: `Jij schakelde ${bot.name || 'tegenstander'} uit`, time: 5 }); addPickup(bot.x, bot.z, 'munitie'); if (kills % 3 === 0) materials += 20; }
        else feed.unshift({ text: `${bot.name || 'Tegenstander'} viel door ${cause}`, time: 5 }); feed = feed.slice(0, 4);
    }
    function addPickup(x, z, type) {
        const color = type === 'schild' ? '#69d0ed' : '#f0c870', object = new T.Mesh(new T.OctahedronGeometry(.46), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .25 }));
        object.position.set(x, .9, z); scene.add(object); loot.push({ x, z, type, mesh: object, phase: rand(0, 6), taken: false });
    }
    function updateStorm(dt) {
        storm.timer -= dt;
        if (storm.timer <= 0 && storm.phase < 5) { storm.phase++; storm.timer = 36; storm.radius = Math.max(11, storm.radius * .75); stormRing.scale.setScalar(storm.radius); announce(`STORMFASE ${storm.phase} · ZONE KRIMPT`); }
        if (distance(player, storm) > storm.radius) hurtPlayer(5 * dt);
    }
    function updateBullets(dt, now) {
        for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; tracers[i].mesh.material.opacity = Math.max(0, tracers[i].life / .075); if (tracers[i].life <= 0) { scene.remove(tracers[i].mesh); tracers.splice(i, 1); } }
        walls.forEach((wall, i) => { wall.life -= dt; if (wall.life <= 0) { scene.remove(wall.mesh); walls.splice(i, 1); } });
    }
    function collectLoot() {
        loot.forEach(item => {
            if (item.taken || Math.hypot(player.x - item.x, player.z - item.z) > 2.2) return;
            item.taken = true; scene.remove(item.mesh);
            if (item.type === 'kist') { materials += 25; reserve += 42; player.shield = Math.min(50, player.shield + 15); const gun = guns[Math.floor(Math.random() * guns.length)]; player.weapons.length < 5 ? player.weapons.push({ ...gun, ammo: gun.mag }) : player.weapons[selected] = { ...gun, ammo: gun.mag }; inventoryKey = ''; announce(`VOORRAADKIST · ${gun.name}`); }
            else if (item.type === 'munitie') { reserve += 30; announce('+30 MUNITIE'); }
            else if (item.type === 'schild') { player.shield = Math.min(50, player.shield + 20); announce('+20 SCHILD'); }
            else if (item.type === 'hout') { materials += 25; announce('+25 MATERIAAL'); }
            else { medkits++; announce('+1 EHBO-SET'); }
        });
    }
    function buildWall() {
        const piece = buildPieces[buildIndex];
        if (materials < piece.cost) { announce('NIET GENOEG MATERIAAL'); return; }
        const x = player.x - Math.sin(yaw) * 3.8, z = player.z - Math.cos(yaw) * 3.8, group = new T.Group();
        group.position.set(x, piece.height, z); group.rotation.set(piece.tilt || 0, yaw, 0);
        const base = mesh(new T.BoxGeometry(...piece.size), mat.wood, group, 0, 0, 0); base.castShadow = true;
        if (piece.blocksMovement) {
            const plankCount = piece.label === 'MUUR' ? 6 : 3, plankHeight = piece.size[1] / plankCount;
            for (let i = 0; i < plankCount; i++) mesh(new T.BoxGeometry(piece.size[0] - .18, plankHeight - .035, piece.size[2] + .04), i % 2 ? mat.wood : mat.woodLight, group, 0, -piece.size[1] / 2 + plankHeight * (i + .5), 0, false);
            for (const side of [-1, 1]) mesh(new T.BoxGeometry(.16, piece.size[1] + .08, piece.size[2] + .12), mat.woodLight, group, side * (piece.size[0] / 2 - .12), 0, 0, false);
        } else if (piece.label === 'VLOER') {
            for (let i = -2; i <= 2; i++) mesh(new T.BoxGeometry(.98, .1, piece.size[2] - .12), i % 2 ? mat.woodLight : mat.wood, group, i * 1.04, .2, 0, false);
        } else {
            for (let i = -2; i <= 2; i++) mesh(new T.BoxGeometry(piece.size[0] - .12, .1, .16), mat.woodLight, group, 0, .2, i * 1.04, false);
        }
        scene.add(group); walls.push({ mesh: group, x, z, hp: 130, owner: player, life: 45, blocksMovement: !!piece.blocksMovement, hx: piece.size[0] / 2 + .2, hz: piece.size[2] / 2 + .2, yaw });
        materials -= piece.cost; tone(260, .07);
    }
    function cycleBuild() { buildIndex = (buildIndex + 1) % buildPieces.length; buildModeUntil = performance.now() + 1400; announce(`BOUWTYPE · ${buildPieces[buildIndex].label}`); }
    function reload() { const gun = player.weapons[selected]; if (!gun || player.reloading || gun.ammo >= gun.mag || !reserve) return; player.reloading = true; reloadUntil = performance.now() + gun.reload; announce('HERLADEN...'); }
    function finishReload() { const gun = player.weapons[selected], count = Math.min(gun.mag - gun.ammo, reserve); gun.ammo += count; reserve -= count; player.reloading = false; reloadUntil = 0; }
    function heal() { if (!medkits || player.hp >= 100) { announce(medkits ? 'GEZONDHEID IS VOL' : 'GEEN EHBO-SETS'); return; } medkits--; player.hp = Math.min(100, player.hp + 45); announce('EHBO GEBRUIKT · +45 HP'); tone(520, .13); }
    function hurtPlayer(amount) { if (state !== 'playing' || player.invulnerable > 0) return; let rest = amount; if (player.shield) { const absorbed = Math.min(player.shield, rest); player.shield -= absorbed; rest -= absorbed; } player.hp = Math.max(0, player.hp - rest); if (!player.hp) finish(false); }
    function updateHud(now, dt) {
        setText('healthValue', Math.ceil(player.hp)); setText('shieldValue', Math.ceil(player.shield)); document.getElementById('healthBar').style.width = `${player.hp}%`; document.getElementById('shieldBar').style.width = `${player.shield * 2}%`;
        const left = bots.filter(bot => bot.alive).length + 1; setText('playersLeft', left); setText('playersLeftTop', left); setText('killValue', kills); setText('materialsValue', materials); setText('stormTimer', `${Math.ceil(storm.timer)}s`);
        const outside = distance(player, storm) > storm.radius, warning = document.getElementById('stormWarning'); warning.classList.toggle('active', outside); warning.querySelector('.storm-warning-text').textContent = outside ? 'STORM · VIND DE VEILIGE ZONE' : `VEILIGE ZONE · ${Math.ceil(storm.timer)}s`;
        const key = player.weapons.map((gun, i) => `${i}:${gun.name}:${gun.ammo}`).join('|') + `:${medkits}:${selected}`;
        if (inventoryKey !== key) { inventoryKey = key; document.getElementById('inventoryList').innerHTML = player.weapons.map((gun, i) => `<div class="inventory-item ${i === selected ? 'selected' : ''}" data-slot="${i}"><span class="slot-num">${i + 1}</span><span class="inventory-item-name"><b>${gun.name}</b><small>${gun.rarity}</small></span><span class="inventory-item-count">${gun.ammo}</span></div>`).join('') + `<div class="inventory-item utility-row"><span>EHBO</span><span class="inventory-item-count">${medkits} ×</span></div>`; }
        const gun = player.weapons[selected]; document.getElementById('weaponInfo').innerHTML = `<span>${gun.kind}</span><strong>${gun.ammo}</strong><i>/ ${reserve}</i>${player.reloading ? '<em>HERLADEN</em>' : ''}`;
        const pop = document.getElementById('gameToast'); pop.textContent = toast; pop.classList.toggle('visible', now * 1000 < toastUntil); document.getElementById('touchHeal').textContent = `EHBO ${medkits}`;
        const buildMode = document.getElementById('buildMode'); buildMode.textContent = `BOUW · ${buildPieces[buildIndex].label}`; buildMode.classList.toggle('active', keys.has('e') || now * 1000 < buildModeUntil);
        feed = feed.filter(item => (item.time -= dt) > 0); document.getElementById('killFeed').innerHTML = feed.map(item => `<div class="kill-entry">${item.text}</div>`).join('');
    }
    function drawMap() {
        const size = mapCanvas.clientWidth || 150, scale = size / 220, pos = n => (n + HALF) * scale;
        mapCtx.clearRect(0, 0, size, size); mapCtx.fillStyle = '#71865b'; mapCtx.fillRect(0, 0, size, size); mapCtx.fillStyle = '#c9b78d';
        places.forEach(p => mapCtx.fillRect(pos(p.x) - 4, pos(p.z) - 4, 8, 8)); mapCtx.strokeStyle = '#c8eeff'; mapCtx.beginPath(); mapCtx.arc(pos(storm.x), pos(storm.z), storm.radius * scale, 0, Math.PI * 2); mapCtx.stroke();
        bots.forEach(bot => { if (bot.alive) { mapCtx.fillStyle = '#f1846d'; mapCtx.fillRect(pos(bot.x) - 1.5, pos(bot.z) - 1.5, 3, 3); } }); mapCtx.fillStyle = '#fff1cf'; mapCtx.beginPath(); mapCtx.arc(pos(player.x), pos(player.z), 3, 0, Math.PI * 2); mapCtx.fill();
    }
    function updateInterface() {
        document.querySelector('.inventory-title').textContent = 'UITRUSTING'; document.querySelectorAll('.stat-label')[0].textContent = 'GEZONDHEID'; document.querySelectorAll('.stat-label')[1].textContent = 'SCHILD';
        document.querySelector('.players-left').innerHTML = '<div class="eyebrow">OVERLEVENDEN</div><div class="players-count" id="playersLeft">17</div>';
        document.querySelector('.controls-display').innerHTML = '<div class="control-heading">VELDHANDLEIDING <span>01</span></div><div class="control-item"><span class="control-key">WASD / ZQSD</span> Bewegen</div><div class="control-item"><span class="control-key">SHIFT</span> Sprinten</div><div class="control-item"><span class="control-key">MUIS</span> Kijken / vuren</div><div class="control-item"><span class="control-key">1 — 5</span> Wapen kiezen</div><div class="control-item"><span class="control-key">R / H</span> Herladen / EHBO</div><div class="control-item"><span class="control-key">B / E</span> Bouwdeel / plaatsen</div><div class="control-item"><span class="control-key">SPATIE</span> Springen</div><div class="control-item"><span class="control-key">R-MUIS</span> Dash</div><div class="control-item"><span class="control-key">ESC</span> Pauze</div>';
        document.querySelector('#mainMenu .menu-content').innerHTML = '<div class="menu-kicker"><i></i> SEIZOEN 01 · DE GROENE GRENS</div><h1 class="game-title">GAMEFORT</h1><p class="menu-subtitle">LAATSTE ZONE</p><div class="menu-rule"></div><p class="menu-description">Een eiland. Een storm. Blijf als laatste over.</p><div class="menu-form"><label for="difficultySelect">TEGENSTANDERS</label><select id="difficultySelect"><option>Rustig</option><option selected>Normaal</option><option>Heftig</option></select></div><button class="menu-button primary-button" onclick="startGame()"><span>DROP HET EILAND OP</span><b>→</b></button><button class="sound-button" id="soundToggle" onclick="toggleSound()">♫ GELUID AAN</button><div class="menu-foot">16 TEGENSTANDERS · 6 LANDINGSZONES · 1 KAMPIOEN</div>';
        document.querySelector('#gameOverScreen .game-over-content').innerHTML = '<div class="menu-kicker">RUN VOLTOOID</div><div class="game-over-title" id="gameOverTitle">EINDE VAN DE RUN</div><div class="game-over-stats"><div><span>PLAATS</span><strong id="finalPlace">-</strong></div><div><span>UITGESCHAKELD</span><strong id="finalKills">0</strong></div><div><span>SCHADE</span><strong id="finalDamage">0</strong></div></div><button class="game-over-button" onclick="startGame()">OPNIEUW DROPPEN →</button><button class="sound-button" onclick="returnToMenu()">TERUG NAAR MENU</button>';
        const bar = document.createElement('div'); bar.className = 'match-bar'; bar.innerHTML = '<div class="match-brand">GF <span>/ VELDOPERATIE</span></div><div class="match-stats"><span><i></i> OVERLEVENDEN <b id="playersLeftTop">17</b></span><span>ELIMINATIES <b id="killValue">0</b></span><span>MATERIAAL <b id="materialsValue">90</b></span></div><div class="match-zone">STORM SLUIT OVER <b id="stormTimer">30s</b></div>'; hud.appendChild(bar);
        [['weaponInfo', 'weapon-info'], ['gameToast', 'game-toast'], ['buildMode', 'build-mode']].forEach(([id, cls]) => { const el = document.createElement('div'); el.id = id; el.className = cls; hud.appendChild(el); }); document.getElementById('buildMode').textContent = 'BOUWEN · HOUTEN MUUR';
        const touch = document.createElement('div'); touch.id = 'touchControls'; touch.innerHTML = '<div class="touch-stick" id="touchStick"><span></span></div><button class="touch-action touch-fire" id="touchFire">VUUR</button><button class="touch-action touch-build" id="touchBuild">BOUW</button><button class="touch-action touch-cycle" id="touchCycleBuild">MODE</button><button class="touch-action touch-heal" id="touchHeal">EHBO</button><button class="touch-action touch-jump" id="touchJump">SPRING</button><button class="touch-action touch-dash" id="touchDash">DASH</button>'; hud.appendChild(touch);
        const pause = document.createElement('div'); pause.id = 'pauseScreen'; pause.className = 'pause-screen hidden';
        pause.innerHTML = '<div class="pause-content"><div class="menu-kicker">VELDOPERATIE ONDERBROKEN</div><h2>PAUZE</h2><p>Je run staat stil.</p><button class="menu-button primary-button" id="resumeButton"><span>VERDER SPELEN</span><b>→</b></button><button class="pause-secondary" id="restartButton">RUN OPNIEUW STARTEN</button><button class="pause-secondary" id="leaveButton">TERUG NAAR MENU</button></div>';
        document.getElementById('gameContainer').appendChild(pause);
        document.getElementById('resumeButton').addEventListener('click', resumeGame);
        document.getElementById('restartButton').addEventListener('click', startGame);
        document.getElementById('leaveButton').addEventListener('click', returnToMenu);
        const fire = document.getElementById('touchFire'); fire.addEventListener('pointerdown', e => { e.preventDefault(); touchFiring = true; }); fire.addEventListener('pointerup', () => touchFiring = false);
        document.getElementById('touchBuild').addEventListener('click', buildWall); document.getElementById('touchCycleBuild').addEventListener('click', cycleBuild); document.getElementById('touchHeal').addEventListener('click', heal);
        document.getElementById('touchJump').addEventListener('click', jump); document.getElementById('touchDash').addEventListener('click', dash);
        const pad = document.getElementById('touchStick'); pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); moveStick(e); }); pad.addEventListener('pointermove', e => { if (e.buttons) moveStick(e); }); pad.addEventListener('pointerup', () => { stick = { x: 0, y: 0 }; pad.style.setProperty('--sx', '0px'); pad.style.setProperty('--sy', '0px'); });
        function moveStick(e) { const r = pad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, l = Math.max(1, Math.hypot(x, y)), m = Math.min(1, 38 / l); stick = { x: clamp(x / 38, -1, 1), y: clamp(y / 38, -1, 1) }; pad.style.setProperty('--sx', `${x * m}px`); pad.style.setProperty('--sy', `${y * m}px`); }
        document.getElementById('inventoryList').addEventListener('click', e => { const item = e.target.closest('[data-slot]'); if (item) { selected = Number(item.dataset.slot); inventoryKey = ''; } });
    }
    function finish(won) {
        if (state !== 'playing') return; state = 'ended'; document.exitPointerLock?.(); const place = bots.filter(bot => bot.alive).length + 1;
        setText('gameOverTitle', won ? 'OVERWINNING!' : 'EINDE VAN DE RUN'); setText('finalPlace', won ? '1e' : `${place}e`); setText('finalKills', kills); setText('finalDamage', Math.floor(damageTotal));
        endScreen.classList.remove('hidden'); requestAnimationFrame(() => endScreen.classList.add('active'));
    }
    function pauseGame() { if (state !== 'playing') return; state = 'paused'; keys.clear(); document.exitPointerLock?.(); document.getElementById('pauseScreen').classList.remove('hidden'); }
    function resumeGame() { if (state !== 'paused') return; state = 'playing'; keys.clear(); document.getElementById('pauseScreen').classList.add('hidden'); clock.getDelta(); requestLock(); }
    function returnToMenu() { state = 'menu'; document.exitPointerLock?.(); document.getElementById('pauseScreen')?.classList.add('hidden'); endScreen.classList.remove('active'); endScreen.classList.add('hidden'); menu.classList.remove('hidden'); hud.style.display = 'none'; clearMatch(); loot.forEach(item => scene.remove(item.mesh)); loot = []; }
    function announce(message) { toast = message; toastUntil = performance.now() + 2100; const popup = document.getElementById('gameToast'); if (popup) { popup.textContent = message; popup.classList.add('visible'); } }
    function toggleSound() { soundOn = !soundOn; const button = document.getElementById('soundToggle'); if (button) button.textContent = soundOn ? '♫ GELUID AAN' : '♫ GELUID UIT'; if (soundOn) tone(540, .08); }
    function tone(frequency, duration) { if (!soundOn) return; try { audio ||= new AudioContext(); const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'triangle'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration); } catch (_) { soundOn = false; } }

    window.startGame = startGame; window.returnToMenu = returnToMenu; window.toggleSound = toggleSound; window.resumeGame = resumeGame;
    window.addEventListener('resize', () => { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7)); renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const dpr = Math.min(devicePixelRatio || 1, 2), size = mapCanvas.clientWidth || 150; mapCanvas.width = size * dpr; mapCanvas.height = size * dpr; mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0); document.getElementById('touchControls')?.classList.toggle('visible', innerWidth < 760); });
    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase(); keys.add(key); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault(); if (e.repeat) return;
        if (state === 'paused' && (key === 'enter' || key === 'escape')) { resumeGame(); return; }
        if (state !== 'playing') return;
        if (key === 'escape') { pauseGame(); }
        else if (key === 'r') reload(); else if (key === 'h') heal(); else if (key === 'e') buildWall(); else if (key === 'b') cycleBuild();
        else if (key >= '1' && key <= '5') { selected = Math.min(Number(key) - 1, player.weapons.length - 1); player.reloading = false; reloadUntil = 0; inventoryKey = ''; }
        else if (key === ' ') jump();
    });
    window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); window.addEventListener('blur', () => { keys.clear(); firing = false; touchFiring = false; });
    window.addEventListener('mousemove', e => { if (state !== 'playing' || e.target.closest?.('#touchControls')) return; yaw -= (e.movementX || 0) * .0022; pitch = clamp(pitch - (e.movementY || 0) * .0018, -1, .78); });
    canvas.addEventListener('click', () => { if (state === 'playing' && !document.pointerLockElement) requestLock(); });
    window.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') { if (!e.target.closest?.('#touchControls')) touchLook = { x: e.clientX, y: e.clientY }; return; }
        if (state === 'playing' && !e.target.closest?.('button, .inventory, .minimap')) { if (e.button === 2) dash(); else if (e.button === 0) firing = true; }
    });
    window.addEventListener('pointermove', e => {
        if (e.pointerType !== 'touch' || !touchLook || state !== 'playing') return;
        yaw -= (e.clientX - touchLook.x) * .006; pitch = clamp(pitch - (e.clientY - touchLook.y) * .0045, -1, .78); touchLook = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => { firing = false; touchFiring = false; touchLook = null; }); window.addEventListener('contextmenu', e => e.preventDefault());
    updateInterface(); createWorld(); stormRing.scale.setScalar(storm.radius); camera.position.set(0, 32, 58); camera.lookAt(0, 0, 0);
    endScreen.classList.add('hidden'); const dpr = Math.min(devicePixelRatio || 1, 2), mapSize = mapCanvas.clientWidth || 150; mapCanvas.width = mapSize * dpr; mapCanvas.height = mapSize * dpr; mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.render(scene, camera); requestAnimationFrame(frame);
})();