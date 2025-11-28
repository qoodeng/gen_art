uniform float uTime;
uniform float uWaveIntensity;
uniform float uWaveSpeed;
uniform vec2 uResolution;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDepth;
varying vec2 vUv;

// Simplex noise function (injected from main.js)

// Gerstner wave function
vec3 gerstnerWave(vec2 pos, float amplitude, float frequency, float speed, vec2 direction) {
    float phase = dot(direction, pos) * frequency + uTime * speed;
    float cosPhase = cos(phase);
    float sinPhase = sin(phase);
    
    float x = direction.x * amplitude * cosPhase;
    float y = amplitude * sinPhase;
    float z = direction.y * amplitude * cosPhase;
    
    return vec3(x, y, z);
}

// Calculate normal from wave displacement
vec3 calculateNormal(vec2 pos, float amplitude, float frequency, float speed, vec2 direction) {
    float phase = dot(direction, pos) * frequency + uTime * speed;
    float cosPhase = cos(phase);
    float sinPhase = sin(phase);
    
    float dx = -direction.x * direction.x * amplitude * frequency * sinPhase;
    float dz = -direction.y * direction.y * amplitude * frequency * sinPhase;
    float dy = direction.x * amplitude * frequency * cosPhase;
    
    return normalize(vec3(dx, 1.0 + dy, dz));
}

void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Enhanced wave patterns for distinct horizontal bands with undulation
    // Primary horizontal wave bands (more distinct)
    float waveY = sin(pos.z * 0.7 + uTime * uWaveSpeed * 0.5) * uWaveIntensity;
    float waveY2 = sin(pos.z * 1.3 - uTime * uWaveSpeed * 0.7) * uWaveIntensity * 0.7;
    float waveY3 = sin(pos.z * 2.0 + uTime * uWaveSpeed * 0.4) * uWaveIntensity * 0.5;
    float waveY4 = sin(pos.z * 2.8 - uTime * uWaveSpeed * 0.6) * uWaveIntensity * 0.3;
    
    // Add horizontal undulation (wavy pattern along X axis) - balanced directions
    float waveX = sin(pos.x * 0.6 + uTime * uWaveSpeed * 0.3) * uWaveIntensity * 0.3;
    float waveX2 = sin(pos.x * 1.2 - uTime * uWaveSpeed * 0.4) * uWaveIntensity * 0.2;
    float waveX3 = sin(pos.x * 0.9 + uTime * uWaveSpeed * 0.25) * uWaveIntensity * 0.15; // Additional balanced wave
    
    // Combine waves for rhythmic, flowing pattern - more balanced
    float combinedWave = (waveY + waveY2 + waveY3 + waveY4) * 0.5 + (waveX + waveX2 + waveX3) * 0.25;
    
    // Add noise for organic variation
    float noiseScale = 0.15;
    float noiseTime = uTime * 0.4;
    float noise = snoise(vec3(pos.xz * noiseScale, noiseTime)) * 0.15 * uWaveIntensity;
    
    // Apply displacement (more subtle for symbolic light effect)
    pos.y += combinedWave + noise;
    
    // Calculate normal for lighting effects
    vec3 normal1 = calculateNormal(position.xz, uWaveIntensity, 0.8, uWaveSpeed * 0.6, normalize(vec2(0.0, 1.0)));
    vec3 normal2 = calculateNormal(position.xz, uWaveIntensity * 0.6, 1.5, uWaveSpeed * 0.8, normalize(vec2(1.0, 0.0)));
    
    // Store wave height in normal for fragment shader
    vNormal = vec3(normal1.x + normal2.x, combinedWave + noise, normal1.z + normal2.z);
    
    vPosition = pos;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    vDepth = vWorldPosition.y;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}

