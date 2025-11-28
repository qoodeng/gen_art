import * as THREE from 'three';

console.log('Shimmer script starting...');

const container = document.getElementById('canvas-container');

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Cap at 1.0 for max performance
container.appendChild(renderer.domElement);

// Vertex Shader
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

// Fragment Shader
const fragmentShader = `
    precision highp float;
    uniform float iTime;
    uniform vec2 iResolution;
    varying vec2 vUv;

    // Cosine based palette, 4 vec3 params
    vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
    {
        return a + b*cos( 6.28318*(c*t+d) );
    }

    void main() {
        vec2 uv = vUv;
        
        // 1. Create the base coordinate system
        // We want high frequency vertical lines, so we scale X much more than Y
        vec2 p = uv;
        p.x *= 80.0; // High frequency vertical lines
        p.y *= 4.0;  // Lower frequency vertical variation
        
        float t = iTime * 0.5;
        
        // 2. Create the "Ripple" distortion
        // The vertical lines shouldn't be straight, they should wave
        float distortion = sin(p.y + t) * 2.0 + sin(p.y * 0.5 - t * 0.5) * 1.0;
        
        // 3. The main pattern is a sine wave on X, displaced by the distortion
        float pattern = sin(p.x + distortion);
        
        // 4. REMOVED secondary wave to eliminate "blurring" effect
        // pattern += sin(p.x * 0.9 + distortion + t);
        
        // Normalize pattern to 0-1 range roughly
        pattern = pattern * 0.5 + 0.5;
        
        // 5. Color Mapping
        // Use the palette from before but map it tightly to the pattern lines
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        
        // The color shifts based on the pattern intensity AND a slow shift over time/Y
        vec3 color = palette(pattern * 2.0 + uv.y + t * 0.2, a, b, c, d);
        
        // 6. Highlight the peaks to make them look like glowing lines
        // Sharpen the lines by tightening the smoothstep
        float lines = smoothstep(0.4, 0.6, pattern);
        color *= lines;
        
        // 7. Desaturate and tone
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(vec3(luminance), color, 0.7); // Keep some color but not too neon
        
        // Dark background
        color = mix(vec3(0.05, 0.05, 0.1), color, pattern);

        gl_FragColor = vec4(color, 1.0);
    }
`;

const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
};

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms
});

const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Animation
function animate(time) {
    requestAnimationFrame(animate);
    uniforms.iTime.value = time * 0.001;
    renderer.render(scene, camera);
}

animate(0);

// Resize handler
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
});

// Initial fade in
const fadeIn = () => {
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
};

if (document.readyState === 'complete') {
    fadeIn();
} else {
    window.addEventListener('load', fadeIn);
}

// Performance fix: Remove filter/transition after animation completes
document.body.addEventListener('transitionend', () => {
    if (document.body.classList.contains('loaded')) {
        document.body.classList.add('animation-complete');
    }
}, { once: true });
