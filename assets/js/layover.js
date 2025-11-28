import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CONFIG = {
    camera: {
        zoom: 35,
        near: 0.1,
        far: 1000,
        position: new THREE.Vector3(100, 80, 100)
    },
    pixelSize: 4 // Higher = more pixelated
};

let scene, camera, renderer, composer;
let dummy = new THREE.Object3D();
let zs = []; // Moved to top to avoid TDZ

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    const container = document.getElementById('canvas-container');

    // 1. Setup Main Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510); // Dark blue-ish night

    // Isometric Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -CONFIG.camera.zoom * aspect, CONFIG.camera.zoom * aspect,
        CONFIG.camera.zoom, -CONFIG.camera.zoom,
        CONFIG.camera.near, CONFIG.camera.far
    );
    camera.position.copy(CONFIG.camera.position);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 2. Setup EffectComposer with RenderPixelatedPass
    composer = new EffectComposer(renderer);

    const renderPixelatedPass = new RenderPixelatedPass(CONFIG.pixelSize, scene, camera);
    composer.addPass(renderPixelatedPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 3. Create World
    createEnvironment();

    // 4. Animation Loop
    animate();

    // Handle Resize
    window.addEventListener('resize', onWindowResize);
}

function createEnvironment() {
    // --- Materials ---
    const carpetMat = new THREE.MeshPhongMaterial({ color: 0x2a2a3a }); // Dark blue carpet
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x808090 }); // Grey walls
    const windowMat = new THREE.MeshPhongMaterial({
        color: 0x111122,
        transparent: true,
        opacity: 0.2,
        shininess: 100,
        side: THREE.DoubleSide
    });
    const seatMat = new THREE.MeshPhongMaterial({ color: 0x333333, emissive: 0x050505 });
    const metalMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 80 });
    const gateMat = new THREE.MeshPhongMaterial({ color: 0x334455 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xaaccff });

    // --- Geometry ---

    // 1. Floor (Carpet)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floor = new THREE.Mesh(floorGeo, carpetMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 2. Main Wall (Back) - Window Wall
    // Frame structure
    const colGeo = new THREE.BoxGeometry(4, 40, 4);
    for (let i = -3; i <= 3; i++) {
        const col = new THREE.Mesh(colGeo, wallMat);
        col.position.set(i * 30, 20, -40);
        scene.add(col);
    }
    // Top/Bottom beams
    const beamGeo = new THREE.BoxGeometry(200, 4, 4);
    const topBeam = new THREE.Mesh(beamGeo, wallMat);
    topBeam.position.set(0, 38, -40);
    scene.add(topBeam);
    const botBeam = new THREE.Mesh(beamGeo, wallMat);
    botBeam.position.set(0, 2, -40);
    scene.add(botBeam);

    // Glass
    const windowGeo = new THREE.PlaneGeometry(200, 32);
    const windowPane = new THREE.Mesh(windowGeo, windowMat);
    windowPane.position.set(0, 20, -40);
    scene.add(windowPane);

    // 3. Short Wall (Removed as per user request "black and gray thing")
    // const shortWallGeo = new THREE.BoxGeometry(40, 15, 4);
    // const shortWall = new THREE.Mesh(shortWallGeo, wallMat);
    // shortWall.position.set(40, 7.5, 20);
    // shortWall.rotation.y = -Math.PI / 4; 
    // scene.add(shortWall);

    // 4. The Sign (Airline Logo) - The "Screen"
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/images/airline_logo.png', (texture) => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;

        // Group for the Screen Area (Sign + Wall + Desk)
        const screenGroup = new THREE.Group();
        screenGroup.position.set(30, 0, -35); // Position near window wall
        scene.add(screenGroup);

        // Gray Wall Background (Taller than screen)
        const screenWallGeo = new THREE.BoxGeometry(24, 16, 1);
        const screenWall = new THREE.Mesh(screenWallGeo, new THREE.MeshPhongMaterial({ color: 0x555555 }));
        screenWall.position.set(0, 8, 0);
        screenGroup.add(screenWall);

        // The Screen (Sign) - More natural lightbox style (16:9 Aspect Ratio)
        const signGeo = new THREE.BoxGeometry(16, 9, 0.5); // 16:9
        // Materials for box: sides are dark, front is texture
        // Fix aspect ratio: Screen is 16:9, Texture is 1:1.
        // We want to show the square texture centered, not stretched.
        // So we repeat the texture horizontally by 16/9 (zooming out/tiling)
        // and center it.
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(16 / 9, 1);
        texture.offset.x = (1 - 16 / 9) / 2;

        const boxMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const faceMat = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: -1 // Pull forward slightly to avoid z-fighting if needed
        });

        const sign = new THREE.Mesh(signGeo, [boxMat, boxMat, boxMat, boxMat, faceMat, boxMat]);
        sign.position.set(0, 9, 0.6);
        screenGroup.add(sign);

        // Frame (Thicker, more substantial) - Adjusted for 16:9
        const sFrameGeo = new THREE.BoxGeometry(17, 10, 0.4);
        const sFrame = new THREE.Mesh(sFrameGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
        sFrame.position.set(0, 9, 0.3);
        screenGroup.add(sFrame);

        // Desk (In front of screen)
        const deskGeo = new THREE.BoxGeometry(12, 3.5, 3);
        const desk = new THREE.Mesh(deskGeo, gateMat);
        desk.position.set(0, 1.75, 4);
        screenGroup.add(desk);

        // Computer on Desk
        const compMonitorGeo = new THREE.BoxGeometry(1.5, 1, 0.1);
        const compMonitor = new THREE.Mesh(compMonitorGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
        compMonitor.position.set(0, 4, 4);
        compMonitor.rotation.y = Math.PI;
        screenGroup.add(compMonitor);

        const compStandGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const compStand = new THREE.Mesh(compStandGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
        compStand.position.set(0, 3.5, 4);
        screenGroup.add(compStand);
    });

    // 5. Gate Structure (Portal only)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(-60, 0, -30);
    scene.add(gateGroup);

    // Gate Sign/Portal
    const portalFrameGeo = new THREE.BoxGeometry(1, 12, 1);
    const p1 = new THREE.Mesh(portalFrameGeo, metalMat);
    p1.position.set(-8, 6, 0);
    gateGroup.add(p1);

    const pTopGeo = new THREE.BoxGeometry(7, 2, 1);
    const pTop = new THREE.Mesh(pTopGeo, gateMat);
    pTop.position.set(-5, 11, 0);
    gateGroup.add(pTop);

    // Gate Number Text
    const gateNumGeo = new THREE.PlaneGeometry(4, 1);
    const gateNum = new THREE.Mesh(gateNumGeo, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    gateNum.position.set(-5, 11, 0.6);
    gateNum.rotation.y = Math.PI;
    gateGroup.add(gateNum);

    // 6. Airplane Outside (Improved)
    const planeGroup = new THREE.Group();
    planeGroup.position.set(-20, 10, -100); // Further out
    planeGroup.rotation.y = -Math.PI / 3; // Angled view
    scene.add(planeGroup);

    // Fuselage - Smoother
    const fuseGeo = new THREE.CylinderGeometry(3.5, 3.5, 50, 32);
    fuseGeo.rotateZ(Math.PI / 2);
    const planeMat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 50 });
    const fuse = new THREE.Mesh(fuseGeo, planeMat);
    planeGroup.add(fuse);

    // Nose - Rounded
    const noseGeo = new THREE.SphereGeometry(3.5, 32, 32);
    const nose = new THREE.Mesh(noseGeo, planeMat);
    nose.position.x = 25;
    nose.scale.set(1.5, 1, 1); // Elongated
    planeGroup.add(nose);

    // Cockpit Windows
    const cockpitGeo = new THREE.BoxGeometry(4, 1.5, 3);
    const cockpitMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(26, 1.5, 0);
    planeGroup.add(cockpit);

    // Wings - Swept Back
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(10, 0);
    wingShape.lineTo(5, 25);
    wingShape.lineTo(-2, 25);
    wingShape.lineTo(0, 0);
    const wingExtrudeSettings = { depth: 1, bevelEnabled: false };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    wingGeo.rotateX(Math.PI / 2);

    const rWing = new THREE.Mesh(wingGeo, planeMat);
    rWing.position.set(5, -1, 2);
    rWing.rotation.z = -0.1; // Dihedral
    rWing.rotation.y = -0.2; // Sweep
    planeGroup.add(rWing);

    const lWing = new THREE.Mesh(wingGeo, planeMat);
    lWing.position.set(5, -1, -2);
    lWing.scale.z = -1; // Mirror
    lWing.rotation.z = -0.1;
    lWing.rotation.y = 0.2;
    planeGroup.add(lWing);

    // Tail (Vertical Stabilizer)
    const vTailShape = new THREE.Shape();
    vTailShape.moveTo(0, 0);
    vTailShape.lineTo(8, 0);
    vTailShape.lineTo(4, 12);
    vTailShape.lineTo(0, 12);
    vTailShape.lineTo(0, 0);
    const vTailGeo = new THREE.ExtrudeGeometry(vTailShape, { depth: 1, bevelEnabled: false });
    const vTail = new THREE.Mesh(vTailGeo, new THREE.MeshPhongMaterial({ color: 0x004488 }));
    vTail.position.set(-22, 2, -0.5);
    planeGroup.add(vTail);

    // Horizontal Stabilizers
    const hTailGeo = new THREE.BoxGeometry(8, 0.5, 12);
    const hTail = new THREE.Mesh(hTailGeo, planeMat);
    hTail.position.set(-20, 2, 0);
    planeGroup.add(hTail);

    // Engines
    const engGeo = new THREE.CylinderGeometry(1.5, 1.5, 6, 16);
    engGeo.rotateZ(Math.PI / 2);
    const engMat = new THREE.MeshPhongMaterial({ color: 0xdddddd });
    const eng1 = new THREE.Mesh(engGeo, engMat);
    eng1.position.set(5, -3, 10);
    planeGroup.add(eng1);
    const eng2 = new THREE.Mesh(engGeo, engMat);
    eng2.position.set(5, -3, -10);
    planeGroup.add(eng2);

    // Lights
    const navLightGeo = new THREE.SphereGeometry(0.5);
    const redLight = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redLight.position.set(3, 0, 27); // Wingtip approx
    planeGroup.add(redLight);
    const greenLight = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    greenLight.position.set(3, 0, -27);
    planeGroup.add(greenLight);

    // 7. Runway Lights (Blue Taxiway Lights)
    const runwayGroup = new THREE.Group();
    runwayGroup.position.set(0, 0, -50); // Moved closer to window (was -100)
    scene.add(runwayGroup);

    // Outside Ground (Tarmac/Grass)
    const outsideGroundGeo = new THREE.PlaneGeometry(600, 600); // Larger
    const outsideGroundMat = new THREE.MeshPhongMaterial({ color: 0x050510, shininess: 0 });
    const outsideGround = new THREE.Mesh(outsideGroundGeo, outsideGroundMat);
    outsideGround.rotation.x = -Math.PI / 2;
    outsideGround.position.y = -0.1;
    runwayGroup.add(outsideGround);

    // Light Fixture Geometry
    const fixtureGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.5, 8); // Bigger fixture
    const fixtureMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Dark grey base

    // The Light Bulb (Electric Blue)
    const bulbGeo = new THREE.SphereGeometry(1.0, 8, 8); // Bigger bulb
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x0088ff }); // Brighter Electric Blue

    const addTaxiwayLight = (x, z) => {
        const group = new THREE.Group();
        group.position.set(x, 0.5, z);

        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        group.add(fixture);

        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.y = 0.8;
        group.add(bulb);

        // Actual light source (expensive, so maybe only for a few or use one big one)
        // Let's add a small point light for every 3rd light to save perf
        if (Math.random() > 0.7) {
            const light = new THREE.PointLight(0x0066ff, 1, 15);
            light.position.y = 2;
            group.add(light);
        }

        runwayGroup.add(group);
    };

    // Create a path of lights
    // Path 1: Straight line
    for (let i = -10; i < 20; i++) {
        addTaxiwayLight(-50 + i * 10, -50); // Left side
        addTaxiwayLight(-50 + i * 10, -80); // Right side
    }

    // Path 2: Curve away
    for (let i = 0; i < 15; i++) {
        const angle = i * 0.2;
        const r = 60;
        const x = 100 + Math.cos(angle) * r;
        const z = -50 - Math.sin(angle) * r;
        addTaxiwayLight(x, z);
    }


    // 7. Seating Rows (Instanced)
    // Create detailed seat geometry matching the reference image

    // 1. Upholstery (Seat & Back) - Dark Grey
    const seatPanGeo = new THREE.BoxGeometry(3.2, 0.4, 3);
    const backrestGeo = new THREE.BoxGeometry(3.2, 2.5, 0.4);

    // 2. Frame (Legs & Arms & Beam) - Silver
    const chairBeamGeo = new THREE.BoxGeometry(4, 0.3, 0.3);
    const legGeo = new THREE.BoxGeometry(0.4, 2, 2);
    const armGeo = new THREE.BoxGeometry(0.3, 2, 2.5);

    // Materials
    const paddingMat = new THREE.MeshPhongMaterial({
        color: 0x222222,
        specular: 0x111111,
        shininess: 30
    });
    const frameMat = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        specular: 0xffffff,
        shininess: 100
    });

    // Meshes
    const seatPanMesh = new THREE.InstancedMesh(seatPanGeo, paddingMat, 300);
    const backrestMesh = new THREE.InstancedMesh(backrestGeo, paddingMat, 300);
    const frameMesh = new THREE.InstancedMesh(chairBeamGeo, frameMat, 300);
    const legMesh = new THREE.InstancedMesh(legGeo, frameMat, 300);
    const armMesh = new THREE.InstancedMesh(armGeo, frameMat, 600);

    scene.add(seatPanMesh);
    scene.add(backrestMesh);
    scene.add(frameMesh);
    scene.add(legMesh);
    scene.add(armMesh);

    let idx = 0;
    let armIdx = 0;

    const addSeat = (x, z, rotY) => {
        const dummy = new THREE.Object3D();

        // 1. Frame Beam
        dummy.position.set(x, 1.5, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        frameMesh.setMatrixAt(idx, dummy.matrix);

        // 2. Legs
        dummy.position.set(x, 1, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        legMesh.setMatrixAt(idx, dummy.matrix);

        // 3. Seat Pan
        dummy.position.set(x, 2.0, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        seatPanMesh.setMatrixAt(idx, dummy.matrix);

        // 4. Backrest
        const backOffset = -1.4;
        const bx = x + Math.sin(rotY) * backOffset;
        const bz = z + Math.cos(rotY) * backOffset;

        dummy.position.set(bx, 3.5, bz);
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(-0.2, rotY, 0, 'YXZ'));
        dummy.quaternion.copy(q);
        dummy.updateMatrix();
        backrestMesh.setMatrixAt(idx, dummy.matrix);

        // 5. Armrests
        const armOffset = 1.8;
        const ax = x + Math.cos(rotY) * armOffset;
        const az = z - Math.sin(rotY) * armOffset;

        dummy.position.set(ax, 2.5, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.quaternion.setFromEuler(new THREE.Euler(0, rotY, 0));
        dummy.updateMatrix();
        armMesh.setMatrixAt(armIdx++, dummy.matrix);

        const ax2 = x - Math.cos(rotY) * armOffset;
        const az2 = z + Math.sin(rotY) * armOffset;
        dummy.position.set(ax2, 2.5, z);
        dummy.updateMatrix();
        armMesh.setMatrixAt(armIdx++, dummy.matrix);

        idx++;
    };

    // Create Rows - Organized in back-to-back blocks
    // The user wants "behind every row of chairs there is another row of chairs facing away from it"

    const addBackToBackBlock = (startX, startZ, seatsPerRow) => {
        // Row 1: Facing Window (-Z) -> Rotation Math.PI
        for (let i = 0; i < seatsPerRow; i++) {
            addSeat(startX + i * 6, startZ, Math.PI);
        }

        // Row 2: Facing Away (+Z) -> Rotation 0
        // Placed "behind" Row 1. 
        // Row 1 is at startZ. It faces -Z. So "behind" it is +Z.
        // Let's space them by 5 units.
        for (let i = 0; i < seatsPerRow; i++) {
            addSeat(startX + i * 6, startZ + 5, 0);
        }
    };

    // Block 1: Near Window
    addBackToBackBlock(-40, -15, 10);

    // Block 2: Middle
    addBackToBackBlock(-40, 5, 10);

    // Block 3: Near Entrance/Right side
    addBackToBackBlock(-40, 25, 10);

    // Extra block on the right side? (REMOVED)
    // addBackToBackBlock(30, 0, 4);

    seatPanMesh.instanceMatrix.needsUpdate = true;
    backrestMesh.instanceMatrix.needsUpdate = true;
    frameMesh.instanceMatrix.needsUpdate = true;
    legMesh.instanceMatrix.needsUpdate = true;
    armMesh.instanceMatrix.needsUpdate = true;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404050, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xaaccff, 0.8);
    dirLight.position.set(-50, 100, 50);
    scene.add(dirLight);

    // Light from the gate
    const gateLight = new THREE.PointLight(0x88ccff, 0.5, 40);
    gateLight.position.set(-50, 10, -30);
    scene.add(gateLight);

    const signLight = new THREE.PointLight(0xffaa00, 0.5, 30);
    signLight.position.set(30, 15, 30);
    scene.add(signLight);
    // 8. Sleeping Passenger
    createSleepingPassenger();

    // 9. Timer UI
    createTimer();
}

function createTimer() {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    container.style.backdropFilter = 'blur(4px)';
    container.style.padding = '10px 15px';
    container.style.borderRadius = '8px';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    container.style.gap = '2px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    document.body.appendChild(container);

    const label = document.createElement('div');
    label.textContent = "YOU'VE BEEN LAID OVER FOR";
    label.style.color = 'rgba(255, 255, 255, 0.6)';
    label.style.fontFamily = 'Inter, sans-serif';
    label.style.fontSize = '10px';
    label.style.letterSpacing = '0.1em';
    label.style.fontWeight = '500';
    container.appendChild(label);

    const timerDiv = document.createElement('div');
    timerDiv.id = 'session-timer';
    timerDiv.style.color = '#ffffff';
    timerDiv.style.fontFamily = 'monospace';
    timerDiv.style.fontSize = '16px';
    timerDiv.style.fontWeight = 'bold';
    timerDiv.style.letterSpacing = '0.05em';
    container.appendChild(timerDiv);

    const startTime = Date.now();
    setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;

        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const milliseconds = (diff % 1000).toString().padStart(3, '0');

        timerDiv.textContent = `${hours}:${minutes}:${seconds}:${milliseconds}`;
    }, 30);
}

function createSleepingPassenger() {
    const passengerGroup = new THREE.Group();
    // Position in a chair: Block 1, Row 1, Seat ~5
    // x = -40 + 4*6 = -16
    // z = -15
    // y = 2 (seat height)
    passengerGroup.position.set(-16, 2.4, -15);
    passengerGroup.rotation.y = Math.PI; // Facing window
    scene.add(passengerGroup);

    // Materials
    const skinMat = new THREE.MeshPhongMaterial({ color: 0xffccaa });
    const shirtMat = new THREE.MeshPhongMaterial({ color: 0x228822 }); // Green sweatshirt
    const pantsMat = new THREE.MeshPhongMaterial({ color: 0x2244aa }); // Jeans
    const shoeMat = new THREE.MeshPhongMaterial({ color: 0x888888 }); // Gray sneakers
    const hairMat = new THREE.MeshPhongMaterial({ color: 0xaa8844 }); // Blondish brown
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); // Glasses frames

    // Torso (Sitting)
    const torsoGeo = new THREE.BoxGeometry(2.5, 3, 1.5);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.5;
    passengerGroup.add(torso);

    // Legs (Thighs)
    const thighGeo = new THREE.BoxGeometry(1, 2, 1.5);
    const lThigh = new THREE.Mesh(thighGeo, pantsMat);
    lThigh.position.set(0.7, 0.5, 1); // Forward
    lThigh.rotation.x = -Math.PI / 2;
    passengerGroup.add(lThigh);
    const rThigh = new THREE.Mesh(thighGeo, pantsMat);
    rThigh.position.set(-0.7, 0.5, 1);
    rThigh.rotation.x = -Math.PI / 2;
    passengerGroup.add(rThigh);

    // Legs (Shins)
    const shinGeo = new THREE.BoxGeometry(1, 2, 1);
    const lShin = new THREE.Mesh(shinGeo, pantsMat);
    lShin.position.set(0.7, -0.5, 2); // Down
    passengerGroup.add(lShin);
    const rShin = new THREE.Mesh(shinGeo, pantsMat);
    rShin.position.set(-0.7, -0.5, 2);
    passengerGroup.add(rShin);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(1.1, 0.8, 2);
    const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
    lShoe.position.set(0.7, -1.5, 2.2);
    passengerGroup.add(lShoe);
    const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rShoe.position.set(-0.7, -1.5, 2.2);
    passengerGroup.add(rShoe);

    // Arms (Folded/Resting)
    const armGeo = new THREE.BoxGeometry(0.8, 2.5, 0.8);
    const lArm = new THREE.Mesh(armGeo, shirtMat);
    lArm.position.set(1.5, 1.5, 0);
    lArm.rotation.z = -0.2;
    passengerGroup.add(lArm);
    const rArm = new THREE.Mesh(armGeo, shirtMat);
    rArm.position.set(-1.5, 1.5, 0);
    rArm.rotation.z = 0.2;
    passengerGroup.add(rArm);

    // Head
    const headGeo = new THREE.BoxGeometry(1.8, 2, 1.8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 3.8, 0);
    head.rotation.x = 0.3; // Tilted back sleeping
    head.rotation.z = 0.2; // Tilted side
    passengerGroup.add(head);

    // Hair (Curly - multiple cubes)
    const hairBaseGeo = new THREE.BoxGeometry(2, 0.8, 2);
    const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
    hairBase.position.set(0, 1.1, 0);
    head.add(hairBase);

    // Curls
    const curlGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < 8; i++) {
        const curl = new THREE.Mesh(curlGeo, hairMat);
        curl.position.set(
            (Math.random() - 0.5) * 1.8,
            0.8 + Math.random() * 0.5,
            (Math.random() - 0.5) * 1.8
        );
        head.add(curl);
    }

    // Glasses
    const glassFrameGeo = new THREE.BoxGeometry(1.8, 0.4, 0.1);
    const glasses = new THREE.Mesh(glassFrameGeo, glassMat);
    glasses.position.set(0, 0.2, 0.95);
    head.add(glasses);

    // Zs Emitter - Random frequency
    const scheduleNextZ = () => {
        // Allow a few more Zs if we are spawning faster
        if (zs.length < 5) {
            spawnZ(passengerGroup.position.clone().add(new THREE.Vector3(0, 5, 0)));
        }
        // Random delay between 500ms and 1500ms
        setTimeout(scheduleNextZ, 500 + Math.random() * 1000);
    };
    scheduleNextZ();
}

function spawnZ(pos) {
    // Create a "Z" mesh
    const zGroup = new THREE.Group();

    // Randomize start position slightly to avoid overlap
    const offset = (Math.random() - 0.5) * 2;
    zGroup.position.copy(pos).add(new THREE.Vector3(offset, 0, 0));

    const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 1 });
    const barGeo = new THREE.BoxGeometry(0.6, 0.2, 0.1);

    const top = new THREE.Mesh(barGeo, mat);
    top.position.y = 0.4;
    zGroup.add(top);

    const bot = new THREE.Mesh(barGeo, mat);
    bot.position.y = -0.4;
    zGroup.add(bot);

    const diagGeo = new THREE.BoxGeometry(0.8, 0.2, 0.1);
    const diag = new THREE.Mesh(diagGeo, mat);
    diag.rotation.z = Math.PI / 4;
    zGroup.add(diag);

    scene.add(zGroup);

    zs.push({
        mesh: zGroup,
        age: 0,
        speed: 0.03 + Math.random() * 0.01,
        initialX: zGroup.position.x,
        phase: Math.random() * Math.PI * 2
    });
}

function animate() {
    requestAnimationFrame(animate);

    // Update Zs
    for (let i = zs.length - 1; i >= 0; i--) {
        const z = zs[i];
        z.age++;
        z.mesh.position.y += z.speed;

        // Sine wave drift
        z.mesh.position.x = z.initialX + Math.sin(z.age * 0.05 + z.phase) * 0.5;

        // Scale up slightly
        const s = 1 + z.age * 0.005;
        z.mesh.scale.set(s, s, s);

        // Fade out
        z.mesh.children.forEach(c => {
            c.material.opacity = Math.max(0, 1 - z.age / 180);
        });

        if (z.age > 180) {
            scene.remove(z.mesh);
            zs.splice(i, 1);
        }
    }

    composer.render();
    // renderer.render(scene, camera);

    // Trigger fade-in
    if (!document.body.classList.contains('loaded')) {
        setTimeout(() => {
            document.body.classList.add('loaded');
        }, 100);
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -CONFIG.camera.zoom * aspect;
    camera.right = CONFIG.camera.zoom * aspect;
    camera.top = CONFIG.camera.zoom;
    camera.bottom = -CONFIG.camera.zoom;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}
