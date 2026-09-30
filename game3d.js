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
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    const camera = new T.PerspectiveCamera(76, innerWidth / innerHeight, .1, 240); camera.rotation.order = 'YXZ'; scene.add(camera);
    scene.add(new T.HemisphereLight('#e3f5ff', '#495b3e', 1.65));
    const sun = new T.DirectionalLight('#ffe0a8', 2.65); sun.position.set(-35, 62, 28); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -100; sun.shadow.camera.right = 100; sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100; sun.shadow.bias = -.00025; scene.add(sun);
    const fillLight = new T.DirectionalLight('#a8dcff', .62); fillLight.position.set(42, 24, -48); scene.add(fillLight);
    const warmBounce = new T.AmbientLight('#ffd8a0', .18); scene.add(warmBounce);

    const guns = [
        { name: 'Ranger', kind: 'AR', damage: 28, rate: 180, reload: 1300, mag: 24, spread: .01, color: '#8cdaa9', rarity: 'ONGEWOON' },
        { name: 'Stuiter', kind: 'POMP', damage: 13, rate: 720, reload: 1550, mag: 6, spread: .055, pellets: 7, color: '#d998e4', rarity: 'ZELDZAAM' },
        { name: 'Lange arm', kind: 'DMR', damage: 62, rate: 850, reload: 1750, mag: 5, spread: .003, color: '#7ac6ef', rarity: 'EPISCH' },
        { name: 'Ratel', kind: 'SMG', damage: 15, rate: 95, reload: 1400, mag: 32, spread: .022, color: '#f2c96c', rarity: 'ONGEWOON' }
    ];
    const rarities = [
        { name: 'GEWOON', color: '#c4cec6', multiplier: 1, weight: 38 },
        { name: 'ONGEWOON', color: '#75d795', multiplier: 1.2, weight: 29 },
        { name: 'ZELDZAAM', color: '#65b9ff', multiplier: 1.45, weight: 19 },
        { name: 'EPISCH', color: '#cb83f2', multiplier: 1.75, weight: 10 },
        { name: 'LEGENDARISCH', color: '#ffbd59', multiplier: 2.15, weight: 4 }
    ];
    const verdantPlaces = [
        { name: 'KOPERHAVEN', x: -59, z: -50, color: '#c78f70' }, { name: 'MOSMARKT', x: 55, z: -52, color: '#a98b69' },
        { name: 'OUDE DAM', x: 0, z: 0, color: '#c6a778' }, { name: 'ZONNEVELD', x: -56, z: 54, color: '#ceab72' },
        { name: 'KRATERPARK', x: 59, z: 54, color: '#9ca67b' }, { name: 'RADARPOST', x: 0, z: 83, color: '#8b9d91' }
    ];
    const mapPresets = {
        verdant: { name: 'De Groene Grens', ground: '#ffffff', soil: '#718451', marks: ['rgba(181,177,105,.12)', 'rgba(41,80,47,.14)', 'rgba(210,194,128,.1)'], leaf: '#47744c', leaf2: '#6d8d54', roof: '#66584a', water: '#4d9297', sky: '#7da9bd', fog: '#d1c9ab', trees: 150, pond: [33, 4, 17], places: verdantPlaces },
        alpine: { name: 'IJsvallei', ground: '#ffffff', soil: '#cbd9d9', marks: ['rgba(255,255,255,.42)', 'rgba(111,146,153,.12)', 'rgba(225,237,236,.34)'], leaf: '#365a59', leaf2: '#91aca1', roof: '#46575d', water: '#78b9c8', sky: '#9fc6da', fog: '#c9d7d7', trees: 115, pond: [-35, 28, 22], places: [
            { name: 'WACHTPOST', x: -68, z: -55, color: '#8c9c99' }, { name: 'SNEEUWVELD', x: 55, z: -59, color: '#b5a58e' }, { name: 'IJSKLOOF', x: 4, z: 4, color: '#8da6aa' },
            { name: 'BERGHOEVE', x: -58, z: 53, color: '#a99b89' }, { name: 'BEVROREN HAVEN', x: 62, z: 49, color: '#8caaa7' }, { name: 'RADARPIEK', x: 12, z: 82, color: '#87949a' }
        ] },
        badlands: { name: 'Rode Woestenij', ground: '#ffffff', soil: '#b9855d', marks: ['rgba(232,190,133,.15)', 'rgba(111,67,48,.11)', 'rgba(208,155,102,.16)'], leaf: '#506349', leaf2: '#8b8a50', roof: '#76513b', water: '#54858a', sky: '#d29b72', fog: '#d5b28e', trees: 85, pond: [42, -34, 13], places: [
            { name: 'ROESTHAVEN', x: -64, z: -58, color: '#ad7052' }, { name: 'KOPERGROEF', x: 57, z: -57, color: '#9a6045' }, { name: 'STOFSTAD', x: -3, z: -1, color: '#bd895a' },
            { name: 'ZONNEPOST', x: -60, z: 56, color: '#c39862' }, { name: 'KRATERDORP', x: 60, z: 52, color: '#a8754f' }, { name: 'OUDE MIJN', x: 5, z: 83, color: '#887264' }
        ] }
    };
    let places = verdantPlaces, activeMap = mapPresets.verdant, worldEntities = [];
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
    let gameMode = 'battle', wave = 0, nextWaveAt = 0, skyDome, heldGunModel, emptyHandModel;
    let storm = { x: 0, z: 0, radius: 92, timer: 30, phase: 0 }, stormRing, stormWall, stormTop;
    let yaw = 0, pitch = 0, firing = false, touchFiring = false, touchLook = null, stick = { x: 0, y: 0 };
    let selected = 0, buildIndex = 0, buildModeUntil = 0, dashReadyAt = 0, reserve = 144, materials = 90, medkits = 2, kills = 0, damageTotal = 0, lastShot = 0, reloadUntil = 0;
    const buildPieces = [
        { label: 'MUUR', cost: 10, size: [5.4, 3.2, .55], height: 1.6, blocksMovement: true },
        { label: 'LAGE MUUR', cost: 8, size: [5.4, 1.6, .5], height: .8, blocksMovement: true },
        { label: 'VLOER', cost: 12, size: [5.4, .3, 5.4], height: .15 },
        { label: 'HELLING', cost: 15, size: [5.4, .3, 5.4], height: 1.35, tilt: Math.PI / 6 },
        { label: 'DAK', cost: 12, size: [5.4, .3, 5.4], height: 1.45 }
    ];
    let difficulty = 'Normaal', soundOn = true, audio, toast = '', toastUntil = 0, feed = [], inventoryKey = '';
    const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    function randomWeapon() {
        const available = rarities.filter(rarity => rarity.multiplier >= 1.45);
        let roll = Math.random() * available.reduce((sum, rarity) => sum + rarity.weight, 0), rarity = available[0];
        for (const option of available) { roll -= option.weight; if (roll <= 0) { rarity = option; break; } }
        const base = guns[Math.floor(Math.random() * guns.length)];
        return { ...base, baseDamage: base.damage, damage: Math.round(base.damage * rarity.multiplier), rarity: rarity.name, rarityColor: rarity.color };
    }
    function requestLock() { try { const result = canvas.requestPointerLock?.(); result?.catch?.(() => {}); } catch (_) { /* Pointer lock is optional. */ } }

    function mesh(geometry, material, parent, x, y, z, cast = true) {
        const object = new T.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = cast; object.receiveShadow = true; parent.add(object); return object;
    }
    function addWorld(object) { scene.add(object); worldEntities.push(object); return object; }
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
        skyDome = dome; scene.add(dome);
    }
    function label(text, x, z) {
        const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
        g.fillStyle = 'rgba(20,38,32,.8)'; g.fillRect(8, 14, 496, 100); g.strokeStyle = '#b9d9a9'; g.lineWidth = 4; g.strokeRect(8, 14, 496, 100);
        g.fillStyle = '#f3efdb'; g.font = 'bold 42px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 65);
        const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
        sprite.position.set(x, 8, z); sprite.scale.set(14, 3.5, 1); addWorld(sprite);
    }
    function building(x, z, color, w, d, h) {
        const group = new T.Group(); group.position.set(x, 0, z); addWorld(group);
        const wallMat = new T.MeshStandardMaterial({ color, roughness: .94 }), door = 1.7, thick = .38, front = d / 2 - thick / 2, side = (w - door) / 2;
        const trim = new T.MeshStandardMaterial({ color: '#5d4937', roughness: .86 });
        const trimLight = new T.MeshStandardMaterial({ color: '#dfb879', roughness: .72 });
        const glass = new T.MeshStandardMaterial({ color: '#9bc4c1', emissive: '#223c3d', emissiveIntensity: .22, roughness: .32, metalness: .08 });
        const wall = (px, pz, ww, dd) => { mesh(new T.BoxGeometry(ww, h, dd), wallMat, group, px, h / 2, pz); obstacles.push({ x: x + px, z: z + pz, hx: ww / 2 + .05, hz: dd / 2 + .05 }); };
        wall(0, -front, w, thick); wall(-w / 2 + thick / 2, 0, thick, d); wall(w / 2 - thick / 2, 0, thick, d);
        wall(-(door + side) / 2, front, side, thick); wall((door + side) / 2, front, side, thick);
        mesh(new T.BoxGeometry(door, .55, thick), wallMat, group, 0, h - .275, front);
        mesh(new T.BoxGeometry(w - .5, .14, d - .5), new T.MeshStandardMaterial({ color: '#90795c', roughness: 1 }), group, 0, .02, 0, false);
        const roof = mesh(new T.ConeGeometry(Math.max(w, d) * .79, 2, 4), mat.roof, group, 0, h + .88, 0); roof.rotation.y = Math.PI / 4;
        // Decorative timber framing and window trim make each existing structure feel hand-built.
        for (const px of [-w / 2 + .2, w / 2 - .2]) mesh(new T.BoxGeometry(.2, h, .2), trim, group, px, h / 2, front + .05);
        mesh(new T.BoxGeometry(w + .35, .24, .25), trimLight, group, 0, h - .16, front + .02);
        for (let i = 0; i < 3; i++) {
            const wx = (i - 1) * w / 3;
            for (const sideZ of [1, -1]) {
                const paneZ = sideZ * (d / 2 + .08), frameZ = sideZ * (d / 2 + .15);
                mesh(new T.BoxGeometry(.9, 1.05, .12), glass, group, wx, h * .6, paneZ, false);
                mesh(new T.BoxGeometry(1.12, .12, .18), trimLight, group, wx, h * .6 + .58, frameZ, false);
                mesh(new T.BoxGeometry(1.12, .12, .18), trim, group, wx, h * .6 - .58, frameZ, false);
                mesh(new T.BoxGeometry(.1, 1.18, .18), trim, group, wx - .53, h * .6, frameZ, false);
                mesh(new T.BoxGeometry(.1, 1.18, .18), trim, group, wx + .53, h * .6, frameZ, false);
                mesh(new T.BoxGeometry(.07, 1.02, .08), trimLight, group, wx, h * .6, frameZ + sideZ * .04, false);
                mesh(new T.BoxGeometry(1.02, .07, .08), trimLight, group, wx, h * .6, frameZ + sideZ * .04, false);
            }
        }
        // Recessed porch, door jambs, and a small chimney are visual details only.
        mesh(new T.BoxGeometry(door + .65, .16, .9), trim, group, 0, .09, d / 2 + .52, false);
        for (const px of [-door / 2 - .12, door / 2 + .12]) mesh(new T.BoxGeometry(.18, h * .62, .22), trimLight, group, px, h * .31, d / 2 + .02, false);
        const chimney = mesh(new T.BoxGeometry(.62, 1.3, .62), trim, group, w * .27, h + 1.45, -d * .2); chimney.rotation.y = .12;
        mesh(new T.BoxGeometry(.78, .16, .78), trimLight, group, w * .27, h + 2.12, -d * .2, false);
    }
    function tree(x, z, scale) {
        const group = new T.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); addWorld(group);
        mesh(new T.CylinderGeometry(.22, .38, 3, 7), mat.trunk, group, 0, 1.5, 0);
        const crown = mesh(new T.SphereGeometry(1, 14, 12), mat.leaf, group, 0, 3.55, 0); crown.scale.set(1.6, 1.35, 1.45);
        const crownTop = mesh(new T.SphereGeometry(1, 14, 12), mat.leaf2, group, -.35, 4.35, -.12); crownTop.scale.set(1.12, .95, 1.08);
        for (const [cx, cy, cz, s, material] of [[-.82,3.25,.15,.72,mat.leaf2],[.78,3.32,-.18,.78,mat.leaf],[.18,4.08,.48,.72,mat.leaf2],[-.28,4.02,-.58,.76,mat.leaf]]) {
            const tuft = mesh(new T.SphereGeometry(1, 10, 8), material, group, cx, cy, cz, false); tuft.scale.set(s, s * .82, s);
        }
        for (const side of [-1, 1]) { const root = mesh(new T.CylinderGeometry(.08, .2, 1.05, 6), mat.trunk, group, side * .3, .28, .05, false); root.rotation.z = side * -.45; }
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
        gun.position.set(.38, -.31, -.62); gun.visible = false; camera.add(gun); heldGunModel = gun;
        const hand = new T.Group(), sleeve = new T.MeshStandardMaterial({ color: '#31594d', roughness: .88 }), skin = new T.MeshStandardMaterial({ color: '#d7a987', roughness: .9 });
        mesh(new T.BoxGeometry(.24, .23, .34), sleeve, hand, .39, -.46, -.48, false);
        mesh(new T.SphereGeometry(.13, 12, 10), skin, hand, .39, -.37, -.7, false);
        for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(.045, .045, .14), skin, hand, .3 + i * .06, -.39, -.79, false);
        hand.visible = true; camera.add(hand); emptyHandModel = hand;
    }
    function syncHeldItem() { const equipped = !!player?.weapons?.[selected]; if (heldGunModel) heldGunModel.visible = equipped; if (emptyHandModel) emptyHandModel.visible = !equipped; }
    function groundWeaponModel(weapon) {
        const model = new T.Group(), outlineColor = weapon.rarityColor || '#65b9ff';
        const body = new T.MeshStandardMaterial({ color: '#303a35', metalness: .38, roughness: .48 });
        const detail = new T.MeshStandardMaterial({ color: '#8c9b88', metalness: .28, roughness: .42 });
        const accent = new T.MeshStandardMaterial({ color: outlineColor, emissive: outlineColor, emissiveIntensity: .3, metalness: .18, roughness: .4 });
        const outline = new T.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: .95 });
        const part = (geometry, material, x, y, z, rx = 0) => {
            const meshPart = new T.Mesh(geometry, material); meshPart.position.set(x, y, z); meshPart.rotation.x = rx; model.add(meshPart);
            const edge = new T.LineSegments(new T.EdgesGeometry(geometry), outline); edge.position.copy(meshPart.position); edge.rotation.copy(meshPart.rotation); model.add(edge);
            return meshPart;
        };
        const box = (w, h, d, x, y, z, material = body) => part(new T.BoxGeometry(w, h, d), material, x, y, z);
        const barrel = (length, radius, z, material = detail) => part(new T.CylinderGeometry(radius, radius * 1.08, length, 10), material, 0, 0, z, Math.PI / 2);
        if (weapon.kind === 'POMP') {
            box(.2, .17, .5, 0, 0, -.03); box(.15, .14, .34, 0, 0, .36); box(.13, .26, .14, 0, -.18, .06); box(.2, .12, .28, 0, .02, -.48, accent); barrel(.72, .052, -.77); barrel(.3, .075, -.47, accent);
        } else if (weapon.kind === 'DMR') {
            box(.19, .16, .57, 0, 0, -.08); box(.16, .14, .43, 0, 0, .43); box(.12, .29, .15, 0, -.2, .01); box(.13, .3, .17, 0, -.22, -.17, detail); barrel(1.02, .035, -.93); part(new T.CylinderGeometry(.072, .072, .28, 10), accent, 0, .105, -.08, Math.PI / 2); box(.25, .05, .19, 0, .12, -.08, detail);
        } else if (weapon.kind === 'SMG') {
            box(.19, .15, .44, 0, 0, -.02); box(.14, .12, .22, 0, 0, .31); box(.1, .24, .13, 0, -.16, .02); box(.12, .3, .16, 0, -.22, -.13, accent); barrel(.4, .038, -.47); box(.2, .06, .27, 0, .11, -.03, detail);
        } else {
            box(.19, .16, .58, 0, 0, -.09); box(.18, .14, .38, 0, 0, -.49); box(.16, .13, .34, 0, 0, .4); box(.12, .28, .15, 0, -.18, .02); box(.14, .31, .17, 0, -.22, -.16, accent); barrel(.58, .032, -.86); box(.1, .055, .43, 0, .12, -.18, detail); box(.1, .11, .12, 0, .2, -.15, accent);
        }
        const halo = new T.Mesh(new T.TorusGeometry(.58, .035, 10, 48), new T.MeshBasicMaterial({ color: outlineColor, transparent: true, opacity: .95 })); halo.rotation.x = Math.PI / 2; halo.position.y = -.28; model.add(halo);
        const glow = new T.Mesh(new T.SphereGeometry(.09, 12, 8), new T.MeshBasicMaterial({ color: outlineColor })); glow.position.set(0, .2, 0); model.add(glow);
        return model;
    }
    function createWorld() {
        worldEntities.forEach(object => scene.remove(object)); worldEntities = []; obstacles = [];
        places = activeMap.places; scene.background.set(activeMap.sky); scene.fog.color.set(activeMap.fog); skyDome.material.color.set(activeMap.sky);
        mat.ground.color.set(activeMap.ground); mat.leaf.color.set(activeMap.leaf); mat.leaf2.color.set(activeMap.leaf2); mat.roof.color.set(activeMap.roof);
        groundCtx.fillStyle = activeMap.soil; groundCtx.fillRect(0, 0, 512, 512);
        // Faint worn roads visually connect the settlements without affecting movement.
        const mapPoint = p => ({ x: (p.x + HALF) / (HALF * 2) * 512, y: (HALF - p.z) / (HALF * 2) * 512 });
        const hub = places.reduce((best, p) => Math.hypot(p.x, p.z) < Math.hypot(best.x, best.z) ? p : best, places[0]);
        groundCtx.lineCap = 'round'; groundCtx.lineJoin = 'round';
        const hubPoint = mapPoint(hub);
        for (const place of places) {
            if (place === hub) continue;
            const point = mapPoint(place), midX = (point.x + hubPoint.x) / 2 + rand(-15, 15), midY = (point.y + hubPoint.y) / 2 + rand(-12, 12);
            groundCtx.strokeStyle = 'rgba(49,42,32,.12)'; groundCtx.lineWidth = 16; groundCtx.beginPath(); groundCtx.moveTo(point.x, point.y); groundCtx.quadraticCurveTo(midX, midY, hubPoint.x, hubPoint.y); groundCtx.stroke();
            groundCtx.strokeStyle = activeMap === mapPresets.alpine ? 'rgba(246,248,237,.22)' : 'rgba(224,190,135,.18)'; groundCtx.lineWidth = 10; groundCtx.beginPath(); groundCtx.moveTo(point.x, point.y); groundCtx.quadraticCurveTo(midX, midY, hubPoint.x, hubPoint.y); groundCtx.stroke();
        }
        for (let i = 0; i < 1500; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 2 + Math.random() * 12; groundCtx.fillStyle = activeMap.marks[i % activeMap.marks.length]; groundCtx.beginPath(); groundCtx.ellipse(x, y, r * 1.5, r, Math.random() * Math.PI, 0, Math.PI * 2); groundCtx.fill(); }
        groundTexture.needsUpdate = true;
        const floor = mesh(new T.PlaneGeometry(220, 220), mat.ground, scene, 0, -.13, 0, false); addWorld(floor); floor.rotation.x = -Math.PI / 2;
        places.forEach((p, index) => {
            label(p.name, p.x, p.z - 11);
            for (let i = 0; i < 5; i++) building(p.x + (i % 3 - 1) * 8.5 + rand(-1, 1), p.z + (Math.floor(i / 3) - .5) * 8 + rand(-1, 1), i % 2 ? p.color : ['#c58f6d', '#b47b62', '#d0b781'][index % 3], rand(5.5, 8), rand(5, 7), rand(3.8, 6));
        });
        for (let i = 0; i < activeMap.trees; i++) {
            const x = rand(-103, 103), z = rand(-103, 103);
            if (places.some(p => Math.abs(x - p.x) < 15 && Math.abs(z - p.z) < 13) || Math.abs(x) < 4 || Math.abs(z) < 4) continue;
            tree(x, z, rand(.7, 1.25));
        }
        if (activeMap === mapPresets.alpine) {
            [[-91,-82,34],[-78,78,27],[91,74,38],[83,-35,25],[-35,96,24]].forEach(([x,z,h], i) => {
                const peak = new T.Group(); peak.position.set(x, 0, z); addWorld(peak);
                mesh(new T.ConeGeometry(13 + i % 2 * 3, h, 7), new T.MeshStandardMaterial({ color: i % 2 ? '#718d99' : '#819eaa', roughness: 1 }), peak, 0, h / 2, 0);
                mesh(new T.ConeGeometry(5.2, h * .32, 7), new T.MeshStandardMaterial({ color: '#e5eeee', roughness: .95 }), peak, 0, h * .78, 0, false);
                obstacles.push({ x, z, hx: 10, hz: 10 });
            });
        } else if (activeMap === mapPresets.badlands) {
            [[-88,-20,21],[-87,20,28],[87,-83,24],[91,15,32],[22,96,20],[-21,-94,26]].forEach(([x,z,h], i) => {
                const mesa = new T.Group(); mesa.position.set(x, 0, z); addWorld(mesa);
                mesh(new T.CylinderGeometry(7 + i % 2 * 2, 12 + i % 2 * 2, h, 6), new T.MeshStandardMaterial({ color: i % 2 ? '#a96847' : '#bd8052', roughness: 1 }), mesa, 0, h / 2, 0);
                mesh(new T.CylinderGeometry(8, 10, 2, 6), new T.MeshStandardMaterial({ color: '#d1a06a', roughness: 1 }), mesa, 0, h, 0);
                obstacles.push({ x, z, hx: 10, hz: 10 });
            });
        }
        const pond = mesh(new T.CircleGeometry(activeMap.pond[2], 48), new T.MeshStandardMaterial({ color: activeMap.water, roughness: .25, metalness: .12 }), scene, activeMap.pond[0], .015, activeMap.pond[1], false); addWorld(pond); pond.rotation.x = -Math.PI / 2;
        if (!stormRing) {
            stormRing = new T.Mesh(new T.TorusGeometry(1, .002, 8, 220), new T.MeshBasicMaterial({ color: '#c9f7ff', transparent: true, opacity: .98 }));
            stormRing.rotation.x = Math.PI / 2; stormRing.position.y = .38; scene.add(stormRing);
            stormWall = new T.Mesh(new T.CylinderGeometry(1, 1, 22, 128, 1, true), new T.MeshBasicMaterial({ color: '#55dff5', transparent: true, opacity: .19, side: T.DoubleSide, depthWrite: false })); stormWall.position.y = 11; scene.add(stormWall);
            stormTop = new T.Mesh(new T.TorusGeometry(1, .0008, 8, 220), new T.MeshBasicMaterial({ color: '#e2fbff', transparent: true, opacity: .78 })); stormTop.rotation.x = Math.PI / 2; stormTop.position.y = 21.8; scene.add(stormTop);
            createGunModel();
        }
    }
    function makeBot(bot) {
        const group = new T.Group(); group.position.set(bot.x, 0, bot.z); scene.add(group); bot.mesh = group;
        const shirt = new T.MeshStandardMaterial({ color: bot.color, roughness: .75 }), pants = new T.MeshStandardMaterial({ color: '#39453e', roughness: .9 });
        const torso = mesh(new T.CylinderGeometry(.47, .55, 1.12, 14), shirt, group, 0, 1.28, 0);
        const head = mesh(new T.SphereGeometry(.34, 16, 12), bot.zombie ? new T.MeshStandardMaterial({ color: '#a3ad78', roughness: .95 }) : mat.skin, group, 0, 2.08, 0);
        const eyeMat = new T.MeshStandardMaterial({ color: bot.zombie ? '#d7ef73' : '#2b3430', emissive: bot.zombie ? '#8caf39' : '#000000', emissiveIntensity: bot.zombie ? 1.3 : 0, roughness: .28 });
        for (const side of [-1, 1]) mesh(new T.SphereGeometry(.045, 8, 6), eyeMat, group, side * .115, 2.12, .302, false);
        if (bot.zombie) {
            mesh(new T.BoxGeometry(.24, .055, .035), new T.MeshStandardMaterial({ color: '#463d34', roughness: 1 }), group, 0, 1.91, .31, false);
            const patch = mesh(new T.BoxGeometry(.28, .22, .035), new T.MeshStandardMaterial({ color: '#55463b', roughness: 1 }), group, -.19, 1.41, .48, false); patch.rotation.z = -.22;
        } else {
            mesh(new T.BoxGeometry(.55, .13, .06), new T.MeshStandardMaterial({ color: '#d8b469', metalness: .22, roughness: .52 }), group, 0, 1.54, .48, false);
        }
        for (const side of [-1, 1]) {
            mesh(new T.SphereGeometry(.25, 10, 8), shirt, group, side * .43, 1.61, 0);
            const arm = mesh(new T.CylinderGeometry(.13, .18, .66, 10), shirt, group, side * .49, 1.29, .23); arm.rotation.x = Math.PI / 2; arm.rotation.z = side * -.1;
            mesh(new T.CylinderGeometry(.17, .22, .72, 10), pants, group, side * .24, .47, 0);
            mesh(new T.BoxGeometry(.32, .18, .48), pants, group, side * .24, .12, .08);
        }
        if (!bot.zombie) mesh(new T.BoxGeometry(.72, .57, .18), new T.MeshStandardMaterial({ color: '#59654a', roughness: .85 }), group, 0, 1.3, .39);
        mesh(new T.BoxGeometry(.46, .62, .3), pants, group, 0, 1.36, -.4);
        if (!bot.zombie) { const helmet = mesh(new T.SphereGeometry(.38, 14, 10), new T.MeshStandardMaterial({ color: '#c29d5d', roughness: .6, metalness: .12 }), group, 0, 2.34, 0); helmet.scale.set(1.12, .44, 1.1); mesh(new T.BoxGeometry(.58, .075, .48), new T.MeshStandardMaterial({ color: '#e2c779', roughness: .45, metalness: .2 }), group, 0, 2.29, .03, false); }
        if (!bot.zombie) mesh(new T.BoxGeometry(.13, .13, .68), new T.MeshStandardMaterial({ color: '#303a35', metalness: .35, roughness: .55 }), group, 0, 1.08, .68);
        if (!bot.zombie) mesh(new T.CylinderGeometry(.035, .045, .46, 8), pants, group, 0, 1.1, 1.2).rotation.x = Math.PI / 2;
        torso.userData.bot = bot; head.userData.bot = bot; bot.hitParts = [torso, head]; botParts.push(torso, head);
        const bar = new T.Group(); bar.position.set(0, 2.7, 0); group.add(bar); bot.bar = bar;
        mesh(new T.PlaneGeometry(1.1, .12), new T.MeshBasicMaterial({ color: '#24352e', side: T.DoubleSide }), bar, 0, 0, 0, false);
        bot.fill = mesh(new T.PlaneGeometry(1.04, .07), new T.MeshBasicMaterial({ color: bot.zombie ? '#a9d16f' : '#e9826c', side: T.DoubleSide }), bar, 0, 0, .01, false);
    }
    function createLoot() {
        loot.forEach(item => scene.remove(item.mesh)); loot = [];
        const types = ['munitie', 'schild', 'hout', 'ehbo'];
        for (let i = 0; i < 65; i++) {
            let x = rand(-99, 99), z = rand(-99, 99);
            const type = i % 4 === 0 ? 'weapon' : Math.random() < .2 ? 'kist' : types[Math.floor(Math.random() * types.length)];
            const weapon = type === 'weapon' ? randomWeapon() : null;
            const color = type === 'weapon' ? weapon.rarityColor : ({ kist: '#ffd16c', munitie: '#f0c870', schild: '#69d0ed', hout: '#dba36d', ehbo: '#e98376' })[type];
            const object = new T.Group();
            if (type === 'weapon') {
                object.add(groundWeaponModel(weapon));
                object.position.set(x, .72, z);
            } else {
                const pickupMat = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .22, roughness: .42, metalness: type === 'munitie' ? .24 : .04 });
                const darkMat = new T.MeshStandardMaterial({ color: '#354039', roughness: .68, metalness: .2 });
                const detailMat = new T.MeshStandardMaterial({ color: '#fff0ca', emissive: type === 'ehbo' || type === 'schild' ? color : '#000000', emissiveIntensity: .45, roughness: .48 });
                if (type === 'kist') {
                    mesh(new T.BoxGeometry(1.15, .72, .85), pickupMat, object, 0, 0, 0);
                    mesh(new T.BoxGeometry(1.22, .13, .92), darkMat, object, 0, .32, 0);
                    for (const px of [-.4, .4]) mesh(new T.BoxGeometry(.1, .76, .9), detailMat, object, px, 0, 0, false);
                    mesh(new T.BoxGeometry(.2, .2, .08), detailMat, object, 0, -.03, .47, false);
                } else if (type === 'munitie') {
                    for (let j = 0; j < 3; j++) { const round = mesh(new T.CylinderGeometry(.105, .105, .54, 10), pickupMat, object, (j - 1) * .23, 0, 0); round.rotation.z = -.12; mesh(new T.CylinderGeometry(.105, .105, .1, 10), detailMat, object, (j - 1) * .23, .31, 0); }
                } else if (type === 'ehbo') {
                    mesh(new T.BoxGeometry(.72, .58, .62), pickupMat, object, 0, 0, 0);
                    mesh(new T.BoxGeometry(.22, .09, .08), detailMat, object, 0, .02, .35, false);
                    mesh(new T.BoxGeometry(.09, .3, .08), detailMat, object, 0, .02, .35, false);
                    mesh(new T.BoxGeometry(.18, .11, .65), darkMat, object, 0, .32, 0, false);
                } else {
                    const shield = mesh(new T.OctahedronGeometry(.48), pickupMat, object, 0, 0, 0); shield.scale.set(.88, 1.12, .45);
                    const emblem = mesh(new T.RingGeometry(.13, .2, 6), detailMat, object, 0, 0, .24, false); emblem.rotation.y = 0;
                }
                const pad = new T.Mesh(new T.TorusGeometry(type === 'kist' ? .62 : .48, .025, 8, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: .7 })); pad.rotation.x = Math.PI / 2; pad.position.y = -.34; object.add(pad);
                object.position.set(x, type === 'kist' ? .58 : type === 'munitie' ? .92 : .9, z);
            }
            object.castShadow = true; scene.add(object); loot.push({ x, z, type, weapon, mesh: object, phase: rand(0, 6), taken: false });
        }
    }
    function clearMatch() {
        bots.forEach(bot => scene.remove(bot.mesh)); botParts = [];
        tracers.forEach(tracer => scene.remove(tracer.mesh)); tracers = [];
        walls.forEach(w => scene.remove(w.mesh)); walls = [];
    }
    function startGame() {
        difficulty = document.getElementById('difficultySelect')?.value || 'Normaal'; gameMode = document.getElementById('modeSelect')?.value || 'battle'; activeMap = mapPresets[document.getElementById('mapSelect')?.value] || mapPresets.verdant; createWorld(); wave = 0; nextWaveAt = 0; clearMatch(); createLoot();
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
        player = { x: spawn.x, z: spawn.z, hp: 100, shield: 50, invulnerable: 0, jumpHeight: 0, jumpVelocity: 0, grounded: true, weapons: [], reloading: false };
        const count = gameMode === 'zombies' ? 0 : difficulty === 'Rustig' ? 12 : difficulty === 'Heftig' ? 20 : 16;
        for (let i = 0; i < count; i++) {
            let x, z; do { x = rand(-98, 98); z = rand(-98, 98); } while (Math.hypot(x - player.x, z - player.z) < 30);
            const bot = { name: ['Koraal', 'Bram', 'Pixel', 'Vonk', 'Riff', 'Nova', 'Maan', 'Flint', 'Echo', 'Sproet'][i % 10], x, z, hp: 100, shield: Math.random() > .5 ? 25 : 0, speed: rand(2.1, 3), nextShot: rand(1, 3), alive: true, dir: rand(-3, 3), strafe: Math.random() < .5 ? -1 : 1, phase: rand(0, 6), color: ['#bb6956', '#8673ae', '#4d8991', '#a47a44'][i % 4] };
            bots.push(bot); makeBot(bot);
        }
        stormRing.position.set(0, .38, 0); stormRing.scale.setScalar(storm.radius); stormWall.scale.set(storm.radius, 1, storm.radius); stormTop.scale.setScalar(storm.radius);
        stormRing.visible = stormWall.visible = stormTop.visible = gameMode !== 'zombies';
        if (gameMode === 'zombies') spawnWave();
        selected = 0; buildIndex = 0; dashReadyAt = 0; reserve = 0; materials = 90; medkits = 2; kills = 0; damageTotal = 0; feed = []; inventoryKey = ''; lastShot = 0; reloadUntil = 0;
        yaw = 0; pitch = -.035; camera.position.set(player.x, 1.72, player.z); camera.rotation.set(pitch, yaw, 0);
        menu.classList.add('hidden'); endScreen.classList.add('hidden'); endScreen.classList.remove('active'); document.getElementById('pauseScreen').classList.add('hidden'); hud.style.display = 'block'; state = 'playing';
        document.getElementById('touchControls').classList.toggle('visible', innerWidth < 760);
        document.querySelector('.players-left .eyebrow').textContent = gameMode === 'zombies' ? 'GOLF' : 'OVERLEVENDEN';
        document.querySelector('.match-stats span').innerHTML = `<i></i> ${gameMode === 'zombies' ? 'ZOMBIES' : 'OVERLEVENDEN'} <b id="playersLeftTop">${gameMode === 'zombies' ? bots.length : bots.length + 1}</b>`;
        document.querySelector('.match-zone').firstChild.textContent = gameMode === 'zombies' ? 'VOLGENDE GOLF' : 'STORM SLUIT OVER';
        document.getElementById('stormWarning').style.display = gameMode === 'zombies' ? 'none' : '';
        announce(gameMode === 'zombies' ? 'OVERLEEF DE GOLVEN · ZOEK BESCHUTTING' : 'VERZAMEL UITRUSTING · BLIJF BINNEN DE ZONE');
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
        syncHeldItem();
        movePlayer(dt);
        if (gameMode !== 'zombies') { stormRing.rotation.y += dt * .07; stormTop.rotation.y -= dt * .1; stormWall.rotation.y += dt * .035; }
        bots.forEach(bot => updateBot(bot, dt, now));
        if (gameMode === 'zombies') updateWaves(now); else updateStorm(dt);
        updateBullets(dt, now); collectLoot();
        if (state !== 'playing') return;
        updateHud(now, dt); drawMap();
        if (gameMode !== 'zombies' && !bots.some(bot => bot.alive)) finish(true);
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
        if (gameMode !== 'zombies') bots.forEach(other => { if (!other.alive || other === bot) return; const nd = distance(bot, other); if (nd < d) { target = other; d = nd; } });
        if (gameMode === 'zombies') {
            const dx = player.x - bot.x, dz = player.z - bot.z, inv = 1 / Math.max(pd, .01); bot.mesh.rotation.y = Math.atan2(dx, dz);
            if (pd > 1.45) moveBot(bot, dx * inv * bot.speed * dt, dz * inv * bot.speed * dt);
            else if (now >= bot.nextAttack && canSeeTarget(bot, player)) { bot.nextAttack = now + .95; hurtPlayer(9 + Math.min(8, wave)); }
        } else if (target && d < 54) {
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
        if (gameMode !== 'zombies' && distance(bot, storm) > storm.radius) { bot.hp -= 4 * dt; if (bot.hp <= 0) eliminate(bot, 'de storm', false); }
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
    function spawnWave() {
        wave++; nextWaveAt = 0; const count = Math.min(5 + wave * 2, 36);
        for (let i = 0; i < count; i++) {
            let x, z, attempts = 0;
            do { const a = rand(0, Math.PI * 2), r = rand(22, 44); x = clamp(player.x + Math.cos(a) * r, -104, 104); z = clamp(player.z + Math.sin(a) * r, -104, 104); attempts++; } while (attempts < 60 && (!canMove(x, z) || distance({ x, z }, player) < 16));
            const bot = { name: 'Zombie ' + (i + 1), x, z, hp: 75 + wave * 9, shield: 0, speed: Math.min(2.1 + wave * .12, 4.2), nextAttack: 0, alive: true, dir: rand(-3, 3), strafe: 0, phase: rand(0, 6), color: '#647653', zombie: true };
            bots.push(bot); makeBot(bot);
        }
        announce('GOLF ' + wave + ' · ' + count + ' ZOMBIES');
    }
    function updateWaves(now) {
        if (bots.some(bot => bot.alive)) return;
        if (!nextWaveAt) { nextWaveAt = now + 4; announce('GOLF ' + wave + ' VOLTOOID · VOLGENDE GOLF OVER 4S'); return; }
        if (now >= nextWaveAt) spawnWave();
    }
    function updateStorm(dt) {
        storm.timer -= dt;
        if (storm.timer <= 0 && storm.phase < 5) { storm.phase++; storm.timer = 36; storm.radius = Math.max(11, storm.radius * .75); stormRing.scale.setScalar(storm.radius); stormWall.scale.set(storm.radius, 1, storm.radius); stormTop.scale.setScalar(storm.radius); announce(`STORMFASE ${storm.phase} · ZONE KRIMPT`); }
        if (distance(player, storm) > storm.radius) hurtPlayer(5 * dt);
    }
    function updateBullets(dt, now) {
        for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; tracers[i].mesh.material.opacity = Math.max(0, tracers[i].life / .075); if (tracers[i].life <= 0) { scene.remove(tracers[i].mesh); tracers.splice(i, 1); } }
        walls.forEach((wall, i) => { wall.life -= dt; if (wall.life <= 0) { scene.remove(wall.mesh); walls.splice(i, 1); } });
    }
    function collectLoot() {
        loot.forEach(item => {
            if (item.taken || item.type === 'weapon' || Math.hypot(player.x - item.x, player.z - item.z) > 2.2) return;
            item.taken = true; scene.remove(item.mesh);
            if (item.type === 'kist') { materials += 25; reserve += 42; player.shield = Math.min(50, player.shield + 15); const gun = randomWeapon(); if (player.weapons.length < 5) { player.weapons.push({ ...gun, ammo: gun.mag }); selected = player.weapons.length - 1; } else player.weapons[selected] = { ...gun, ammo: gun.mag }; inventoryKey = ''; announce(`VOORRAADKIST · ${gun.rarity} ${gun.name}`); }
            else if (item.type === 'munitie') { reserve += 30; announce('+30 MUNITIE'); }
            else if (item.type === 'schild') { player.shield = Math.min(50, player.shield + 20); announce('+20 SCHILD'); }
            else if (item.type === 'hout') { materials += 25; announce('+25 MATERIAAL'); }
            else { medkits++; announce('+1 EHBO-SET'); }
        });
    }
    function nearbyWeapon() {
        return loot.filter(item => !item.taken && item.type === 'weapon').map(item => ({ item, distance: distance(player, item) })).filter(hit => hit.distance < 3.2).sort((a, b) => a.distance - b.distance)[0]?.item;
    }
    function pickupWeapon() {
        const item = nearbyWeapon();
        if (!item) { announce('GEEN WAPEN DICHTBIJ'); return; }
        const duplicate = player.weapons.findIndex(gun => gun.name === item.weapon.name);
        if (duplicate >= 0 && player.weapons[duplicate].damage >= item.weapon.damage) { reserve += item.weapon.mag; announce(`${item.weapon.name} · +${item.weapon.mag} MUNITIE`); }
        else {
            const gun = { ...item.weapon, ammo: item.weapon.mag };
            if (duplicate >= 0) { player.weapons[duplicate] = gun; selected = duplicate; }
            else if (player.weapons.length < 5) { player.weapons.push(gun); selected = player.weapons.length - 1; }
            else player.weapons[selected] = gun;
            reserve += gun.mag;
            announce(`${gun.rarity} ${gun.name} OPGEPAKT · SLOT ${selected + 1}`);
        }
        item.taken = true; scene.remove(item.mesh); inventoryKey = ''; player.reloading = false; reloadUntil = 0;
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
        } else if (piece.label === 'DAK') {
            const roofPiece = mesh(new T.ConeGeometry(3.85, 2.7, 4), mat.wood, group, 0, 1.35, 0, false); roofPiece.rotation.y = Math.PI / 4;
            for (const side of [-1, 1]) mesh(new T.BoxGeometry(.12, 2.5, .12), mat.woodLight, group, side * 1.25, .72, 0, false);
        } else {
            for (let i = -2; i <= 2; i++) mesh(new T.BoxGeometry(piece.size[0] - .12, .1, .16), mat.woodLight, group, 0, .2, i * 1.04, false);
        }
        scene.add(group); walls.push({ mesh: group, x, z, hp: 130, owner: player, life: 45, blocksMovement: !!piece.blocksMovement, hx: piece.size[0] / 2 + .2, hz: piece.size[2] / 2 + .2, yaw });
        materials -= piece.cost; tone(260, .07);
    }
    function cycleBuild() { buildIndex = (buildIndex + 1) % buildPieces.length; buildModeUntil = performance.now() + 1400; announce(`BOUWTYPE · ${buildPieces[buildIndex].label}`); }
    function selectBuild(index) { buildIndex = index; buildModeUntil = performance.now() + 1800; announce(`BOUWTYPE · ${buildPieces[index].label}`); }
    function selectWeapon(index) { if (!player.weapons[index]) return; selected = index; player.reloading = false; reloadUntil = 0; inventoryKey = ''; }
    function cycleWeapon(direction) {
        if (!player?.weapons?.length) return;
        for (let step = 1; step <= player.weapons.length; step++) {
            const index = (selected + direction * step + player.weapons.length * 2) % player.weapons.length;
            if (player.weapons[index]) { selectWeapon(index); break; }
        }
    }
    function reload() { const gun = player.weapons[selected]; if (!gun || player.reloading || gun.ammo >= gun.mag || !reserve) return; player.reloading = true; reloadUntil = performance.now() + gun.reload; announce('HERLADEN...'); }
    function finishReload() { const gun = player.weapons[selected], count = Math.min(gun.mag - gun.ammo, reserve); gun.ammo += count; reserve -= count; player.reloading = false; reloadUntil = 0; }
    function heal() { if (!medkits || player.hp >= 100) { announce(medkits ? 'GEZONDHEID IS VOL' : 'GEEN EHBO-SETS'); return; } medkits--; player.hp = Math.min(100, player.hp + 45); announce('EHBO GEBRUIKT · +45 HP'); tone(520, .13); }
    function hurtPlayer(amount) { if (state !== 'playing' || player.invulnerable > 0) return; let rest = amount; if (player.shield) { const absorbed = Math.min(player.shield, rest); player.shield -= absorbed; rest -= absorbed; } player.hp = Math.max(0, player.hp - rest); if (!player.hp) finish(false); }
    function updateHud(now, dt) {
        setText('healthValue', Math.ceil(player.hp)); setText('shieldValue', Math.ceil(player.shield)); document.getElementById('healthBar').style.width = `${player.hp}%`; document.getElementById('shieldBar').style.width = `${player.shield * 2}%`;
        const alive = bots.filter(bot => bot.alive).length, left = gameMode === 'zombies' ? alive : alive + 1;
        setText('playersLeft', gameMode === 'zombies' ? wave : left); setText('playersLeftTop', left); setText('killValue', kills); setText('materialsValue', materials);
        setText('stormTimer', gameMode === 'zombies' ? (nextWaveAt ? `${Math.max(0, Math.ceil(nextWaveAt - now))}s` : `GOLF ${wave}`) : `${Math.ceil(storm.timer)}s`);
        const outside = gameMode !== 'zombies' && distance(player, storm) > storm.radius, warning = document.getElementById('stormWarning'); warning.classList.toggle('active', outside); warning.querySelector('.storm-warning-text').textContent = outside ? 'STORM · JE LOOPT SCHADE OP · VIND DE VEILIGE ZONE' : `VEILIGE ZONE · ${Math.ceil(storm.timer)}s`;
        hud.classList.toggle('zone-danger', outside);
        const nearby = nearbyWeapon(), prompt = document.getElementById('weaponPrompt');
        prompt.textContent = nearby ? `${innerWidth < 760 ? 'TIK' : 'F'} · PAK ${nearby.weapon.rarity} ${nearby.weapon.name.toUpperCase()} · ${nearby.weapon.damage} DMG` : '';
        prompt.classList.toggle('visible', !!nearby);
        const key = player.weapons.map((gun, i) => `${i}:${gun.name}:${gun.ammo}`).join('|') + `:${medkits}:${selected}`;
        if (inventoryKey !== key) { inventoryKey = key; const azertySlots = ['&', 'é', '"', "'", '(']; document.getElementById('inventoryList').innerHTML = Array.from({ length: 5 }, (_, i) => { const gun = player.weapons[i], slotKey = azertySlots[i]; return gun ? `<div class="inventory-item ${i === selected ? 'selected' : ''}" data-slot="${i}"><span class="slot-num">${slotKey}</span><span class="inventory-item-name"><b>${gun.name}</b><small style="color:${gun.rarityColor}">${gun.rarity} · ${gun.damage} DMG</small></span><span class="inventory-item-count">${gun.ammo}</span></div>` : `<div class="inventory-item empty-slot"><span class="slot-num">${slotKey}</span><span class="inventory-item-name"><b>LEGE SLEUF</b><small>DRUK ${slotKey} OM UIT TE RUSTEN</small></span></div>`; }).join('') + `<div class="inventory-item utility-row"><span>EHBO</span><span class="inventory-item-count">${medkits} ×</span></div>`; }
        const gun = player.weapons[selected]; document.getElementById('weaponInfo').innerHTML = gun ? `<span>${gun.kind}</span><strong>${gun.ammo}</strong><i>/ ${reserve}</i>${player.reloading ? '<em>HERLADEN</em>' : ''}` : '<span>ARSENAAL</span><strong>GEEN WAPEN</strong><i>ZOEK EN PAK EEN WAPEN OP</i>';
        const pop = document.getElementById('gameToast'); pop.textContent = toast; pop.classList.toggle('visible', now * 1000 < toastUntil); document.getElementById('touchHeal').textContent = `EHBO ${medkits}`;
        const buildMode = document.getElementById('buildMode'); buildMode.textContent = `BOUW · ${buildPieces[buildIndex].label}`; buildMode.classList.toggle('active', keys.has('e') || now * 1000 < buildModeUntil);
        feed = feed.filter(item => (item.time -= dt) > 0); document.getElementById('killFeed').innerHTML = feed.map(item => `<div class="kill-entry">${item.text}</div>`).join('');
    }
    function drawMap() {
        const size = mapCanvas.clientWidth || 150, scale = size / 220, pos = n => (n + HALF) * scale;
        mapCtx.clearRect(0, 0, size, size); mapCtx.fillStyle = activeMap.soil; mapCtx.fillRect(0, 0, size, size); mapCtx.fillStyle = '#c9b78d';
        places.forEach(p => mapCtx.fillRect(pos(p.x) - 4, pos(p.z) - 4, 8, 8));
        if (gameMode !== 'zombies') { mapCtx.strokeStyle = '#c8f5ff'; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.arc(pos(storm.x), pos(storm.z), storm.radius * scale, 0, Math.PI * 2); mapCtx.stroke(); mapCtx.lineWidth = 1; }
        bots.forEach(bot => { if (bot.alive) { mapCtx.fillStyle = '#f1846d'; mapCtx.fillRect(pos(bot.x) - 1.5, pos(bot.z) - 1.5, 3, 3); } }); mapCtx.fillStyle = '#fff1cf'; mapCtx.beginPath(); mapCtx.arc(pos(player.x), pos(player.z), 3, 0, Math.PI * 2); mapCtx.fill();
    }
    function updateInterface() {
        document.querySelector('.inventory-title').textContent = 'ARSENAAL · MUISWIEL WISSELT'; document.querySelectorAll('.stat-label')[0].textContent = 'GEZONDHEID'; document.querySelectorAll('.stat-label')[1].textContent = 'SCHILD';
        document.querySelector('.players-left').innerHTML = '<div class="eyebrow">OVERLEVENDEN</div><div class="players-count" id="playersLeft">17</div>';
        document.querySelector('.controls-display').innerHTML = '<div class="control-heading">VELDHANDLEIDING <span>01</span></div><div class="control-item"><span class="control-key">ZQSD</span> Bewegen</div><div class="control-item"><span class="control-key">SHIFT</span> Sprinten</div><div class="control-item"><span class="control-key">MUISWIEL</span> Wapen wisselen</div><div class="control-item"><span class="control-key">TOPRIJ</span> Wapenslot kiezen</div><div class="control-item"><span class="control-key">F</span> Wapen oppakken</div><div class="control-item"><span class="control-key">C / T</span> Muur / lage muur</div><div class="control-item"><span class="control-key">V / X / G</span> Vloer / helling / dak</div><div class="control-item"><span class="control-key">E / B</span> Plaatsen / bouwdeel wisselen</div><div class="control-item"><span class="control-key">R / H</span> Herladen / EHBO</div><div class="control-item"><span class="control-key">SPATIE</span> Springen</div><div class="control-item"><span class="control-key">R-MUIS</span> Dash</div><div class="control-item"><span class="control-key">ESC</span> Pauze</div>';
        document.querySelector('#mainMenu .menu-content').innerHTML = '<div class="menu-kicker"><i></i> SEIZOEN 01 · DE GROENE GRENS</div><h1 class="game-title">GAMEFORT</h1><p class="menu-subtitle">LAATSTE ZONE</p><div class="menu-rule"></div><p class="menu-description">Overleef de storm of houd stand tegen eindeloze golven.</p><div class="menu-form"><label for="modeSelect">SPELTYPE</label><select id="modeSelect"><option value="battle">Battle Royale</option><option value="zombies">Zombiegolven</option></select></div><div class="menu-form"><label for="mapSelect">WERELD</label><select id="mapSelect"><option value="verdant">De Groene Grens</option><option value="alpine">IJsvallei</option><option value="badlands">Rode Woestenij</option></select></div><div class="menu-form"><label for="difficultySelect">MOEILIJKHEID</label><select id="difficultySelect"><option>Rustig</option><option selected>Normaal</option><option>Heftig</option></select></div><button class="menu-button primary-button" onclick="startGame()"><span>START DE RUN</span><b>→</b></button><button class="sound-button" id="soundToggle" onclick="toggleSound()">♫ GELUID AAN</button><div class="menu-foot">3 WERELDEN · 6 LANDINGSZONES · VERKEN EN OVERLEEF</div>';
        document.querySelector('#gameOverScreen .game-over-content').innerHTML = '<div class="menu-kicker">RUN VOLTOOID</div><div class="game-over-title" id="gameOverTitle">EINDE VAN DE RUN</div><div class="game-over-stats"><div><span>PLAATS</span><strong id="finalPlace">-</strong></div><div><span>UITGESCHAKELD</span><strong id="finalKills">0</strong></div><div><span>SCHADE</span><strong id="finalDamage">0</strong></div></div><button class="game-over-button" onclick="startGame()">OPNIEUW DROPPEN →</button><button class="sound-button" onclick="returnToMenu()">TERUG NAAR MENU</button>';
        const bar = document.createElement('div'); bar.className = 'match-bar'; bar.innerHTML = '<div class="match-brand">GF <span>/ VELDOPERATIE</span></div><div class="match-stats"><span><i></i> OVERLEVENDEN <b id="playersLeftTop">17</b></span><span>ELIMINATIES <b id="killValue">0</b></span><span>MATERIAAL <b id="materialsValue">90</b></span></div><div class="match-zone">STORM SLUIT OVER <b id="stormTimer">30s</b></div>'; hud.appendChild(bar);
        [['weaponInfo', 'weapon-info'], ['gameToast', 'game-toast'], ['buildMode', 'build-mode'], ['weaponPrompt', 'weapon-prompt']].forEach(([id, cls]) => { const el = document.createElement('div'); el.id = id; el.className = cls; hud.appendChild(el); }); document.getElementById('buildMode').textContent = 'BOUWEN · HOUTEN MUUR';
        const touch = document.createElement('div'); touch.id = 'touchControls'; touch.innerHTML = '<div class="touch-stick" id="touchStick"><span></span></div><button class="touch-action touch-fire" id="touchFire">VUUR</button><button class="touch-action touch-build" id="touchBuild">BOUW</button><button class="touch-action touch-cycle" id="touchCycleBuild">MODE</button><button class="touch-action touch-heal" id="touchHeal">EHBO</button><button class="touch-action touch-jump" id="touchJump">SPRING</button><button class="touch-action touch-dash" id="touchDash">DASH</button><button class="touch-action touch-pickup" id="touchPickup">PAK</button>'; hud.appendChild(touch);
        const pause = document.createElement('div'); pause.id = 'pauseScreen'; pause.className = 'pause-screen hidden';
        pause.innerHTML = '<div class="pause-content"><div class="menu-kicker">VELDOPERATIE ONDERBROKEN</div><h2>PAUZE</h2><p>Je run staat stil.</p><button class="menu-button primary-button" id="resumeButton"><span>VERDER SPELEN</span><b>→</b></button><button class="pause-secondary" id="restartButton">RUN OPNIEUW STARTEN</button><button class="pause-secondary" id="leaveButton">TERUG NAAR MENU</button></div>';
        document.getElementById('gameContainer').appendChild(pause);
        document.getElementById('resumeButton').addEventListener('click', resumeGame);
        document.getElementById('restartButton').addEventListener('click', startGame);
        document.getElementById('leaveButton').addEventListener('click', returnToMenu);
        const fire = document.getElementById('touchFire'); fire.addEventListener('pointerdown', e => { e.preventDefault(); touchFiring = true; }); fire.addEventListener('pointerup', () => touchFiring = false);
        document.getElementById('touchBuild').addEventListener('click', buildWall); document.getElementById('touchCycleBuild').addEventListener('click', cycleBuild); document.getElementById('touchHeal').addEventListener('click', heal); document.getElementById('touchPickup').addEventListener('click', pickupWeapon);
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
        else if (key === 'r') reload(); else if (key === 'h') heal(); else if (key === 'e') buildWall(); else if (key === 'b') cycleBuild(); else if (key === 'f') pickupWeapon();
        else if (key === 'c') selectBuild(0); else if (key === 't') selectBuild(1); else if (key === 'v') selectBuild(2); else if (key === 'x') selectBuild(3); else if (key === 'g') selectBuild(4);
        else if (/^Digit[1-5]$/.test(e.code)) selectWeapon(Number(e.code.slice(-1)) - 1);
        else if (key === ' ') jump();
    });
    window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); window.addEventListener('blur', () => { keys.clear(); firing = false; touchFiring = false; });
    window.addEventListener('wheel', e => { if (state === 'playing' && !e.target.closest?.('.inventory')) { cycleWeapon(e.deltaY > 0 ? 1 : -1); e.preventDefault(); } }, { passive: false });
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
    updateInterface(); createSky(); createWorld(); stormRing.scale.setScalar(storm.radius); stormWall.scale.set(storm.radius, 1, storm.radius); stormTop.scale.setScalar(storm.radius); camera.position.set(0, 32, 58); camera.lookAt(0, 0, 0);
    endScreen.classList.add('hidden'); const dpr = Math.min(devicePixelRatio || 1, 2), mapSize = mapCanvas.clientWidth || 150; mapCanvas.width = mapSize * dpr; mapCanvas.height = mapSize * dpr; mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.render(scene, camera); requestAnimationFrame(frame);
})();
