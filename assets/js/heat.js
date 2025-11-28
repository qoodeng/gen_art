import * as THREE from 'three';

const CONFIG = {
    camera: {
        zoom: 40,
        near: 0.1,
        far: 1000,
        position: new THREE.Vector3(100, 100, 100)
    },
    renderer: {
        width: 320,  // Low res for pixelation
        height: 180
    },
    crowd: {
        count: 100, // Reduced population for scarcity
        areaSize: 100,
        speed: 0.08 // Slightly slower for realism
    }
};

let scene, camera, renderer, composer;
let crowdMesh;
let dummy = new THREE.Object3D();
let agents = [];
let renderTarget;
let postScene, postCamera, postMaterial;

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function init() {
    const container = document.getElementById('canvas-container');

    // 1. Setup Main Scene (The 3D world)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // Very dark background (cold)

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
    renderer = new THREE.WebGLRenderer({ antialias: false }); // No antialias for pixel look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1); // Keep 1:1 for explicit pixelation control
    container.appendChild(renderer.domElement);

    // 2. Setup Render Target (Low Res Buffer)
    renderTarget = new THREE.WebGLRenderTarget(
        CONFIG.renderer.width,
        CONFIG.renderer.height,
        {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        }
    );

    // 3. Setup Post-Processing Scene (Full screen quad)
    postScene = new THREE.Scene();
    // Increase far plane to 10 to ensure quad is visible
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    postCamera.position.z = 5; // Move camera back significantly

    console.log('Post-processing scene setup complete');

    // Load Shaders
    try {
        const [vertexShader, fragmentShader] = await Promise.all([
            fetch('assets/shaders/heat_vertex.glsl').then(r => {
                if (!r.ok) throw new Error(`Failed to load vertex shader: ${r.statusText}`);
                return r.text();
            }),
            fetch('assets/shaders/heat_fragment.glsl').then(r => {
                if (!r.ok) throw new Error(`Failed to load fragment shader: ${r.statusText}`);
                return r.text();
            })
        ]);

        postMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                tDiffuse: { value: renderTarget.texture },
                uTime: { value: 0 }
            }
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
        postScene.add(quad);
    } catch (error) {
        console.error('Error loading shaders:', error);
        // Fallback or alert to make debugging easier
        alert('Error loading simulation shaders. Check console for details.');
    }

    // 4. Create World
    createEnvironment();
    createCrowd();

    // 5. Animation Loop
    animate();

    // Handle Resize
    window.addEventListener('resize', onWindowResize);
}

let obstacles = []; // Store bounding boxes for collision

function createEnvironment() {
    // Floor (Cold)
    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // --- Airport Architecture ---

    // 1. Seating Rows (Instanced)
    // Rows of 4 seats, back to back
    const seatGeo = new THREE.BoxGeometry(2, 2, 2);
    const seatMat = new THREE.MeshPhongMaterial({
        color: 0x505050,
        emissive: 0x101010
    });
    const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, 200);
    scene.add(seatMesh);

    let seatIdx = 0;
    const addSeatRow = (startX, startZ) => {
        for (let i = 0; i < 5; i++) { // 5 rows
            for (let j = 0; j < 8; j++) { // 8 seats per row
                dummy.position.set(startX + j * 3, 1, startZ + i * 8);
                dummy.scale.set(1, 1, 1);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                seatMesh.setMatrixAt(seatIdx++, dummy.matrix);

                // Add collision
                obstacles.push({
                    x: startX + j * 3,
                    z: startZ + i * 8,
                    width: 2.5,
                    depth: 2.5
                });
            }
        }
    };

    // Left waiting area
    addSeatRow(-60, -30);
    // Right waiting area
    addSeatRow(20, -30);

    seatMesh.instanceMatrix.needsUpdate = true;

    // 2. Pillars (Large, structural)
    const pillarGeo = new THREE.CylinderGeometry(2, 2, 20, 16);
    const pillarMat = new THREE.MeshPhongMaterial({
        color: 0x606060,
        emissive: 0x101010
    });

    const pillarPositions = [
        { x: -40, z: -40 }, { x: 40, z: -40 },
        { x: -40, z: 40 }, { x: 40, z: 40 }
    ];

    pillarPositions.forEach(pos => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(pos.x, 10, pos.z);
        scene.add(pillar);
        obstacles.push({ x: pos.x, z: pos.z, width: 5, depth: 5 });
    });

    // 3. Gate Desk
    const deskGeo = new THREE.BoxGeometry(15, 4, 4);
    const deskMat = new THREE.MeshPhongMaterial({
        color: 0x707070,
        emissive: 0x101010
    });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, 2, 60);
    scene.add(desk);
    obstacles.push({ x: 0, z: 60, width: 16, depth: 5 });

    // 4. Security Scanners (Archways)
    const scannerGeo = new THREE.TorusGeometry(3, 0.5, 8, 24); // Arch shape
    // Rotate to stand up
    scannerGeo.rotateX(Math.PI / 2);
    // Cut bottom half? No, torus is a ring. Let's use Box frames.
    // Better: 3 boxes (Left, Right, Top) merged? Or just use Torus and sink it.
    // Let's use a simple Box frame shape for efficiency.
    // Actually, let's use a group of boxes for one scanner, but we need InstancedMesh.
    // Let's just use a Torus and sink the bottom half into the floor.

    const scannerMat = new THREE.MeshPhongMaterial({
        color: 0x505050,
        emissive: 0x101010
    });
    const scannerMesh = new THREE.InstancedMesh(scannerGeo, scannerMat, 10);
    scene.add(scannerMesh);

    for (let i = 0; i < 5; i++) {
        // Row of scanners
        dummy.position.set(-20 + i * 10, 2, 20);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1); // Torus is 3 radius -> 6 wide
        dummy.updateMatrix();
        scannerMesh.setMatrixAt(i, dummy.matrix);
    }
    scannerMesh.instanceMatrix.needsUpdate = true;

    // 5. Luggage Piles (Small boxes)
    const lugGeo = new THREE.BoxGeometry(1.5, 1, 2);
    const lugMat = new THREE.MeshPhongMaterial({
        color: 0x604040, // Brownish
        emissive: 0x100505
    });
    const lugMesh = new THREE.InstancedMesh(lugGeo, lugMat, 50);
    scene.add(lugMesh);

    for (let i = 0; i < 50; i++) {
        // Scatter near seats
        const zone = Math.random() > 0.5 ? -40 : 40; // Left or Right area
        const lx = zone + (Math.random() - 0.5) * 30;
        const lz = -30 + (Math.random() - 0.5) * 20;

        dummy.position.set(lx, 0.5, lz);
        dummy.rotation.set(0, Math.random() * Math.PI, 0);
        dummy.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        lugMesh.setMatrixAt(i, dummy.matrix);

        obstacles.push({ x: lx, z: lz, width: 1, depth: 1 });
    }
    lugMesh.instanceMatrix.needsUpdate = true;

    // 6. Windows (Cold planes)
    const winGeo = new THREE.PlaneGeometry(200, 40);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x000010 }); // Very cold blue
    const windowWall = new THREE.Mesh(winGeo, winMat);
    windowWall.position.set(0, 20, -80);
    scene.add(windowWall);

    // Lighting for Thermal Gradient
    // Hemisphere light fills shadows with gradient
    // Reduced intensity for deeper shadows (Blue/Green)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0.2); // Increased slightly for consistency
    hemiLight.color.setHSL(0.6, 1, 0.6); // Blueish sky
    hemiLight.groundColor.setHSL(0.095, 1, 0.75); // Warm ground
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // Directional light creates "hot" highlights
    // Increased intensity for hotter highlights (Red/White)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);
}

let headsMesh, torsosMesh, armsMesh, legsMesh;

function createCrowd() {
    const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 40, // Reduced slightly for softer highlights
        flatShading: false
    });

    // 1. Heads (Spheres) - Increased size (~15%)
    const headGeo = new THREE.SphereGeometry(0.8, 8, 8);
    headsMesh = new THREE.InstancedMesh(headGeo, material, CONFIG.crowd.count);
    scene.add(headsMesh);

    // 2. Torsos (Boxes)
    const torsoGeo = new THREE.BoxGeometry(1.6, 2.5, 1.0);
    torsosMesh = new THREE.InstancedMesh(torsoGeo, material, CONFIG.crowd.count);
    scene.add(torsosMesh);

    // 3. Arms (Capsules)
    const armGeo = new THREE.CapsuleGeometry(0.3, 2.0, 4, 8);
    armsMesh = new THREE.InstancedMesh(armGeo, material, CONFIG.crowd.count * 2);
    scene.add(armsMesh);

    // 4. Legs (Capsules)
    const legGeo = new THREE.CapsuleGeometry(0.37, 2.5, 4, 8);
    legsMesh = new THREE.InstancedMesh(legGeo, material, CONFIG.crowd.count * 2);
    scene.add(legsMesh);

    // Initialize Agents
    const spawnArea = CONFIG.crowd.areaSize * 1.5;
    const agentRadius = 0.8; // Approx radius for collision

    for (let i = 0; i < CONFIG.crowd.count; i++) {
        let x, z;
        let valid = false;
        let attempts = 0;

        // Try to find a valid spawn position
        while (!valid && attempts < 20) {
            x = (Math.random() - 0.5) * spawnArea * 2;
            z = (Math.random() - 0.5) * spawnArea * 2;

            // Check against obstacles
            let collision = false;
            for (const obs of obstacles) {
                if (Math.abs(x - obs.x) < obs.width + agentRadius &&
                    Math.abs(z - obs.z) < obs.depth + agentRadius) {
                    collision = true;
                    break;
                }
            }
            if (!collision) valid = true;
            attempts++;
        }

        // If we couldn't find a spot, just spawn at 0,0 (or somewhere safe-ish)
        if (!valid) { x = 0; z = 0; }

        agents.push({
            position: new THREE.Vector3(x, 0, z),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 0,
            angle: Math.random() * Math.PI * 2,
            phase: Math.random() * Math.PI * 2,
            scale: 1.0 + Math.random() * 0.1, // Reduced variation for consistency
            state: 'WALKING', // 'WALKING', 'WAITING'
            target: getRandomTarget(),
            waitTime: 0,
            lastPos: new THREE.Vector3(x, 0, z),
            stuckTimer: 0
        });
    }
}

function getRandomTarget() {
    // Pick a random point within bounds
    const r = CONFIG.crowd.areaSize * 1.4;
    const agentRadius = 0.8;

    let x, z;
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 10) {
        x = (Math.random() - 0.5) * 2 * r;
        z = (Math.random() - 0.5) * 2 * r;

        // Check validity (same as spawn)
        let collision = false;
        for (const obs of obstacles) {
            if (Math.abs(x - obs.x) < obs.width + agentRadius &&
                Math.abs(z - obs.z) < obs.depth + agentRadius) {
                collision = true;
                break;
            }
        }
        if (!collision) valid = true;
        attempts++;
    }

    return new THREE.Vector3(x, 0, z);
}

function updateAgents(time) {
    const limit = CONFIG.crowd.areaSize * 1.8;
    const dt = 0.016; // Approx delta time
    const agentRadius = 0.6; // Physical radius for push-out

    for (let i = 0; i < CONFIG.crowd.count; i++) {
        const agent = agents[i];

        // --- AI Logic ---
        if (agent.state === 'WALKING') {
            // Seek Target
            const dir = new THREE.Vector3().subVectors(agent.target, agent.position);
            const dist = dir.length();

            if (dist < 2) {
                // Arrived
                agent.state = 'WAITING';
                agent.waitTime = 2 + Math.random() * 4; // Wait 2-6s
                agent.velocity.set(0, 0, 0);
                agent.speed = 0;
            } else {
                dir.normalize();

                // Obstacle Avoidance (Steering Force)
                const avoidance = new THREE.Vector3();
                for (const obs of obstacles) {
                    const dx = agent.position.x - obs.x;
                    const dz = agent.position.z - obs.z;
                    const dSq = dx * dx + dz * dz;
                    // Look ahead radius
                    const radius = (obs.width + 4) * (obs.width + 4);

                    if (dSq < radius) {
                        const d = Math.sqrt(dSq);
                        avoidance.x += dx / d;
                        avoidance.z += dz / d;
                    }
                }
                avoidance.normalize().multiplyScalar(4.0); // Increased Weight for stronger avoidance

                // Combine
                dir.add(avoidance).normalize();

                // Accelerate
                agent.velocity.x += (dir.x * CONFIG.crowd.speed - agent.velocity.x) * 0.1;
                agent.velocity.z += (dir.z * CONFIG.crowd.speed - agent.velocity.z) * 0.1;

                // Clamp max speed
                const maxSpeed = CONFIG.crowd.speed * 1.5;
                if (agent.velocity.lengthSq() > maxSpeed * maxSpeed) {
                    agent.velocity.normalize().multiplyScalar(maxSpeed);
                }

                agent.speed = agent.velocity.length();
            }
        } else if (agent.state === 'WAITING') {
            agent.waitTime -= dt;
            if (agent.waitTime <= 0) {
                agent.state = 'WALKING';
                agent.target = getRandomTarget();
            }
            // Slow stop
            agent.velocity.multiplyScalar(0.9);
            agent.speed = agent.velocity.length();
        }

        // Move
        agent.position.add(agent.velocity);

        // --- Robust Collision Resolution (Push Out) ---
        for (const obs of obstacles) {
            const dx = agent.position.x - obs.x;
            const dz = agent.position.z - obs.z;
            const adx = Math.abs(dx);
            const adz = Math.abs(dz);

            const threshX = obs.width + agentRadius;
            const threshZ = obs.depth + agentRadius;

            if (adx < threshX && adz < threshZ) {
                // Overlap detected. Find shallowest penetration.
                const penX = threshX - adx;
                const penZ = threshZ - adz;

                if (penX < penZ) {
                    // Push along X
                    if (dx > 0) agent.position.x += penX;
                    else agent.position.x -= penX;
                    agent.velocity.x = 0;
                    agent.velocity.multiplyScalar(0.5); // Dampen all velocity to stop vibration
                } else {
                    // Push along Z
                    if (dz > 0) agent.position.z += penZ;
                    else agent.position.z -= penZ;
                    agent.velocity.z = 0;
                    agent.velocity.multiplyScalar(0.5); // Dampen
                }
            }
        }

        // --- Stuck Detection ---
        if (agent.state === 'WALKING') {
            const distMoved = agent.position.distanceTo(agent.lastPos);
            if (distMoved < 0.5 * dt * 60) { // If moved less than 0.5 units in ~1s (at 60fps)
                agent.stuckTimer += dt;
            } else {
                agent.stuckTimer = 0;
                agent.lastPos.copy(agent.position);
            }

            if (agent.stuckTimer > 0.5) {
                // Stuck! Switch to waiting to "re-orient"
                // This prevents the instant 180 snap and lets them calm down
                agent.state = 'WAITING';
                agent.waitTime = 0.2 + Math.random() * 0.2; // Short pause
                agent.velocity.set(0, 0, 0);
                agent.stuckTimer = 0;
            }
        } else {
            agent.stuckTimer = 0;
            agent.lastPos.copy(agent.position);
        }

        // Smooth Rotation
        // Smooth Rotation
        // Only rotate if moving significantly to avoid jitter when stopped/stuck
        if (agent.speed > 0.05) {
            const targetAngle = Math.atan2(agent.velocity.x, agent.velocity.z);
            let diff = targetAngle - agent.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            agent.angle += diff * 0.05; // Slower, smoother turn
        }

        // Boundary Wrap
        if (agent.position.x > limit) agent.position.x = -limit;
        if (agent.position.x < -limit) agent.position.x = limit;
        if (agent.position.z > limit) agent.position.z = -limit;
        if (agent.position.z < -limit) agent.position.z = limit;
        // Only animate if moving
        const isMoving = agent.speed > 0.01;
        const walkCycle = isMoving ? (time * 8 + agent.phase) : agent.phase; // Stop cycle if waiting

        // Improved Math
        // Improved Math - Smoother
        const legAmp = 0.6;
        const legAngle = Math.sin(walkCycle) * legAmp;
        const armAngle = Math.sin(walkCycle) * legAmp;

        // Foot Lift: Use sin^2 for smooth takeoff/landing (derivative is 0 at 0)
        // Original was Math.max(0, sin), which has sharp corners.
        const getSmoothLift = (phase) => {
            const s = Math.sin(phase);
            return s > 0 ? Math.pow(s, 2) * 0.3 : 0;
        };

        const footLiftL = getSmoothLift(walkCycle);
        const footLiftR = getSmoothLift(walkCycle + Math.PI);

        // Bob: Use shifted sin wave instead of abs(sin) to remove sharp bottom point
        // We want 2 bounces per cycle.
        // sin(2x - PI/2) goes -1 to 1. Map to 0..1
        const bob = ((Math.sin(walkCycle * 2 - Math.PI / 2) + 1) / 2) * 0.15;
        const sway = Math.sin(walkCycle) * 0.05; // Body sway

        const s = agent.scale;
        const yBase = agent.position.y + 3.2 * s; // Ground offset adjusted for scale

        // 1. Torso
        dummy.position.copy(agent.position);
        dummy.position.y = yBase + 2.8 * s + bob;
        dummy.rotation.set(0, agent.angle, sway); // Add sway
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        torsosMesh.setMatrixAt(i, dummy.matrix);

        // 2. Head
        dummy.position.y = yBase + 4.8 * s + bob;
        dummy.rotation.set(0, agent.angle, sway * 0.5); // Less sway for head
        dummy.updateMatrix();
        headsMesh.setMatrixAt(i, dummy.matrix);

        // Helper for limbs
        const updateLimb = (mesh, index, offsetX, offsetY, offsetZ, rotX, liftY) => {
            dummy.position.copy(agent.position);

            const cos = Math.cos(agent.angle);
            const sin = Math.sin(agent.angle);

            const rx = offsetX * cos + offsetZ * sin;
            const rz = -offsetX * sin + offsetZ * cos;

            dummy.position.x += rx * s;
            dummy.position.y = yBase + offsetY * s + bob + (liftY || 0);
            dummy.position.z += rz * s;

            dummy.rotation.set(rotX, agent.angle, 0);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
        };

        // 3. Legs (Left/Right)
        updateLimb(legsMesh, i * 2, -0.5, 1.2, 0, legAngle, footLiftL);
        updateLimb(legsMesh, i * 2 + 1, 0.5, 1.2, 0, -legAngle, footLiftR);

        // 4. Arms (Left/Right)
        updateLimb(armsMesh, i * 2, -1.1, 2.8, 0, -armAngle);
        updateLimb(armsMesh, i * 2 + 1, 1.1, 2.8, 0, armAngle);
    }

    headsMesh.instanceMatrix.needsUpdate = true;
    torsosMesh.instanceMatrix.needsUpdate = true;
    armsMesh.instanceMatrix.needsUpdate = true;
    legsMesh.instanceMatrix.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;

    updateAgents(time);

    // 1. Render Scene to Low-Res Texture
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);

    // 2. Render Post-Processing Quad to Screen
    renderer.setRenderTarget(null);

    if (postMaterial && postMaterial.uniforms) {
        // Normal path: Render thermal effect
        postMaterial.uniforms.uTime.value = time;
        renderer.render(postScene, postCamera);
    } else {
        // Fallback path: Render raw scene directly if shaders failed
        // This ensures we don't see a black screen
        renderer.render(scene, camera);


    }

    // Trigger fade-in after first render (runs for both paths)
    if (!document.body.classList.contains('loaded')) {
        setTimeout(() => {
            document.body.classList.add('loaded');
        }, 100);
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;

    // Update Main Camera
    camera.left = -CONFIG.camera.zoom * aspect;
    camera.right = CONFIG.camera.zoom * aspect;
    camera.top = CONFIG.camera.zoom;
    camera.bottom = -CONFIG.camera.zoom;
    camera.updateProjectionMatrix();

    // Update Renderer
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Note: We DO NOT resize the renderTarget to match window size
    // We want to keep it low-res for the pixel effect!
}
