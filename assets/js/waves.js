import * as THREE from 'three';

const CONFIG = {
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        position: new THREE.Vector3(0, -30, 0),
        lookAt: new THREE.Vector3(0, 50, 0)
    },
    renderer: {
        clearColor: 0x000000,
        alpha: 1
    },
    lights: {
        directional: {
            color: 0xffffff,
            intensity: 0.8,
            position: new THREE.Vector3(0, 50, 30)
        },
        ambient: {
            color: 0x1a3a5a,
            intensity: 0.3
        },
        point: {
            color: 0x88ccff,
            intensity: 0.5,
            distance: 100,
            pos1: new THREE.Vector3(20, 10, 20),
            pos2: new THREE.Vector3(-20, 10, -20)
        }
    },
    floor: {
        color: 0x0a1a2a,
        roughness: 0.8,
        metalness: 0.1,
        y: -50
    },
    water: {
        geometry: [200, 200, 192, 192],
        y: 0
    }
};

const NOISE_GLSL = `
// Simplex noise function (simplified)
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// Initialize when DOM is ready (or immediately if already loaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already ready
    init();
}

function init() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found!');
        return;
    }

    const { scene, camera, renderer, width, height } = setupScene(container);

    // Start loading shaders and initializing scene
    loadShaders(scene, camera, renderer, width, height);
}

function setupScene(container) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, width / height, CONFIG.camera.near, CONFIG.camera.far);
    camera.position.copy(CONFIG.camera.position);
    camera.lookAt(CONFIG.camera.lookAt);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(CONFIG.renderer.clearColor, CONFIG.renderer.alpha);
    container.appendChild(renderer.domElement);

    return { scene, camera, renderer, width, height };
}

// Load shaders
// Load shaders
async function loadShaders(scene, camera, renderer, width, height) {
    try {
        const [vertexResponse, fragmentResponse] = await Promise.all([
            fetch('assets/shaders/vertex.glsl'),
            fetch('assets/shaders/fragment.glsl')
        ]);

        if (!vertexResponse.ok || !fragmentResponse.ok) {
            throw new Error('Failed to load shader files');
        }

        const vertexShader = NOISE_GLSL + await vertexResponse.text();
        const fragmentShader = NOISE_GLSL + await fragmentResponse.text();

        console.log('Shaders loaded successfully');
        initApp(scene, camera, renderer, width, height, vertexShader, fragmentShader);
    } catch (error) {
        console.error('Error loading shaders:', error);
    }
}

// Wave parameters - locked at 0.0
const params = {
    waveIntensity: 0.0,
    waveSpeed: 0.0,
    causticsIntensity: 0.0
};

// Create water surface
let waterMesh;
let waterMaterial;

function initApp(scene, camera, renderer, width, height, vertexShader, fragmentShader) {
    console.log('Initializing app...');

    // Create large plane for water surface
    const geometry = new THREE.PlaneGeometry(...CONFIG.water.geometry);
    geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

    // Create shader material
    try {
        waterMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uWaveIntensity: { value: params.waveIntensity },
                uWaveSpeed: { value: params.waveSpeed },
                uCausticsIntensity: { value: params.causticsIntensity },
                uResolution: { value: new THREE.Vector2(width, height) },
                uCameraPosition: { value: camera.position },
                uLightDirection: { value: CONFIG.lights.directional.position.clone().normalize() }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        waterMesh = new THREE.Mesh(geometry, waterMaterial);
        waterMesh.position.y = CONFIG.water.y;
        scene.add(waterMesh);
        console.log('Water mesh added to scene');
    } catch (error) {
        console.error('Error creating shader material:', error);
        return;
    }

    // Add ocean floor (optional visual reference)
    const floorGeometry = new THREE.PlaneGeometry(300, 300, 32, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.floor.color,
        roughness: CONFIG.floor.roughness,
        metalness: CONFIG.floor.metalness
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.floor.y;
    scene.add(floor);

    // Lighting
    const ambientLight = new THREE.AmbientLight(CONFIG.lights.ambient.color, CONFIG.lights.ambient.intensity);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(CONFIG.lights.directional.color, CONFIG.lights.directional.intensity);
    directionalLight.position.copy(CONFIG.lights.directional.position);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add some point lights for caustics effect
    const pointLight1 = new THREE.PointLight(CONFIG.lights.point.color, CONFIG.lights.point.intensity, CONFIG.lights.point.distance);
    pointLight1.position.copy(CONFIG.lights.point.pos1);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(CONFIG.lights.point.color, CONFIG.lights.point.intensity, CONFIG.lights.point.distance);
    pointLight2.position.copy(CONFIG.lights.point.pos2);
    scene.add(pointLight2);

    // Animation loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Update shader uniforms
        if (waterMaterial) {
            waterMaterial.uniforms.uTime.value = elapsedTime;
            // Camera is static, no need to update uCameraPosition every frame if it doesn't move
            // But if we add controls later, we might want this back. 
            // For now, let's keep it efficient as requested.
            // waterMaterial.uniforms.uCameraPosition.value.copy(camera.position); 
            waterMaterial.uniforms.uWaveIntensity.value = params.waveIntensity;
            waterMaterial.uniforms.uWaveSpeed.value = params.waveSpeed;
            waterMaterial.uniforms.uCausticsIntensity.value = params.causticsIntensity;
        }

        renderer.render(scene, camera);

        // Trigger fade-in after first render
        if (!document.body.classList.contains('loaded')) {
            setTimeout(() => {
                document.body.classList.add('loaded');
            }, 100);
        }
    }

    console.log('Starting animation loop');
    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(newWidth, newHeight);

        if (waterMaterial && waterMaterial.uniforms && waterMaterial.uniforms.uResolution) {
            waterMaterial.uniforms.uResolution.value.set(newWidth, newHeight);
        }
    });
}

