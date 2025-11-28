// ============================================================================
// UNIFORMS & VARYINGS
// ============================================================================
uniform float uTime;
uniform float uCausticsIntensity;
uniform float uWaveIntensity;
uniform float uWaveSpeed;
uniform vec3 uCameraPosition;
uniform vec3 uLightDirection;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDepth;
varying vec2 vUv;

// ============================================================================
// CONSTANTS
// ============================================================================
const float REFRACTION_STRENGTH = 0.15;
const float REFRACTION_BLEND = 0.6;
const float FRESNEL_POWER = 2.8;
const float FRESNEL_STRENGTH = 0.5;
const float SPECULAR_POWER = 80.0;
const float SPECULAR_INTENSITY = 0.5;
const vec3 SPECULAR_COLOR = vec3(0.3, 0.6, 1.0);
const vec3 GLOW_COLOR = vec3(0.15, 0.4, 0.9);
const float GLOW_INTENSITY = 0.4;
const vec3 ORB_TINT = vec3(0.15, 0.4, 0.9) * 0.2;
const float ORB_RADIUS_SQ = 64.0; // 8.0^2
const int NUM_ORBS = 6;

// ============================================================================
// Simplex noise function (injected from main.js)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
float dither(vec2 uv) {
    mat4 ditherMatrix = mat4(
        vec4(0.0, 8.0, 2.0, 10.0),
        vec4(12.0, 4.0, 14.0, 6.0),
        vec4(3.0, 11.0, 1.0, 9.0),
        vec4(15.0, 7.0, 13.0, 5.0)
    ) / 16.0;
    ivec2 ditherCoord = ivec2(mod(uv, 4.0));
    return ditherMatrix[ditherCoord.y][ditherCoord.x];
}

// ============================================================================
// COLOR FUNCTIONS
// ============================================================================
vec3 getBlueColor(float colorPhase) {
    const vec3 deepBlue = vec3(0.01, 0.08, 0.25);
    const vec3 darkBlue = vec3(0.03, 0.12, 0.35);
    const vec3 mediumBlue = vec3(0.08, 0.2, 0.5);
    const vec3 brightBlue = vec3(0.12, 0.35, 0.7);
    const vec3 lightBlue = vec3(0.15, 0.45, 0.85);
    
    float t = sin(colorPhase) * 0.5 + 0.5;
    
    if (t < 0.25) return mix(deepBlue, darkBlue, t / 0.25);
    if (t < 0.5) return mix(darkBlue, mediumBlue, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(mediumBlue, brightBlue, (t - 0.5) / 0.25);
    return mix(brightBlue, lightBlue, (t - 0.75) / 0.25);
}

vec3 lightColor(vec2 uv, float waveHeight, float time, float bandPosition) {
    float colorPhase = bandPosition * 0.4 + waveHeight * 0.6 + time * 0.25;
    vec3 color = getBlueColor(colorPhase);
    
    // Desaturate slightly while maintaining blue character
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luminance), color, 0.7);
}

vec3 enhanceBlueTones(vec3 color) {
    // Boost blue channel, reduce red/green
    color.b = min(color.b * 1.15, 1.0);
    color.r *= 0.9;
    color.g *= 0.95;
    
    // Shift bright areas toward blue to reduce white
    float maxChannel = max(max(color.r, color.g), color.b);
    if (maxChannel > 0.7) {
        color = mix(color, vec3(0.2, 0.4, 0.9), (maxChannel - 0.7) * 0.5);
    }
    
    // Maintain blue saturation
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luminance), color, 0.65);
}

// ============================================================================
// PATTERN FUNCTIONS
// ============================================================================
float causticBands(vec2 uv, float time) {
    // Multiple horizontal wave frequencies
    float wave1 = sin(uv.y * 2.5 + time * 0.4) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 4.0 - time * 0.6) * 0.5 + 0.5;
    float wave3 = sin(uv.y * 6.0 + time * 0.3) * 0.5 + 0.5;
    float wave4 = sin(uv.y * 8.5 - time * 0.5) * 0.5 + 0.5;
    
    // Balanced horizontal undulation
    float undulation1 = sin(uv.x * 0.8 + time * 0.25) * 0.15 + 0.85;
    float undulation2 = sin(uv.x * 1.1 - time * 0.3) * 0.15 + 0.85;
    float undulation = (undulation1 + undulation2) * 0.5;
    
    // Combine waves
    float bands = (wave1 * 0.35 + wave2 * 0.3 + wave3 * 0.2 + wave4 * 0.15) * undulation;
    
    // Add subtle noise
    float noise = snoise(vec3(uv * 0.8, time * 0.3));
    bands = bands * (0.95 + noise * 0.05);
    
    // Smooth band definition
    bands = pow(bands, 0.5);
    bands = smoothstep(0.25, 0.9, bands);
    bands = pow(bands, 0.9);
    
    return bands;
}

float caustics(vec2 uv, float time, float waveHeight) {
    vec2 p1 = uv * 3.0;
    vec2 p2 = uv * 4.5 + vec2(5.0, 3.0);
    
    // Reduced noise lookups from 3 to 2
    float c1 = snoise(vec3(p1 * 1.2, time * 0.4));
    float c2 = snoise(vec3(p2 * 1.5, time * 0.5));
    
    float caustic = pow((c1 * 0.6 + c2 * 0.4) * 0.5 + 0.5, 1.1);
    float bands = causticBands(uv, time);
    float waveMod = abs(waveHeight) * 0.8 + 0.7;
    
    return (caustic * 0.6 + bands * 0.4) * waveMod * uCausticsIntensity;
}

float createSegments(vec2 uv, float time) {
    const float segmentLength = 0.2;
    float segmentPhase = floor(uv.x / segmentLength) * segmentLength;
    // Simplified segment variation
    float segmentVariation = sin(segmentPhase * 10.0 + uv.y * 2.0 + time * 0.5);
    float segmentMask = smoothstep(0.0, 0.15, mod(uv.x, segmentLength)) * 
                        smoothstep(segmentLength, segmentLength - 0.15, mod(uv.x, segmentLength));
    return 0.96 + segmentVariation * 0.08 * segmentMask;
}

// ============================================================================
// GLASS EFFECTS
// ============================================================================
float calculateFresnel(vec3 normal, vec3 viewDir) {
    return pow(1.0 - max(dot(normal, viewDir), 0.0), FRESNEL_POWER);
}

vec3 calculateSpecular(vec3 normal, vec3 viewDir, vec3 lightDir) {
    vec3 reflectDir = reflect(-lightDir, normal);
    float specular = pow(max(dot(viewDir, reflectDir), 0.0), SPECULAR_POWER);
    return SPECULAR_COLOR * specular * SPECULAR_INTENSITY;
}

vec2 calculateRefraction(vec3 normal, vec2 patternUV) {
    return patternUV + normal.xz * REFRACTION_STRENGTH;
}

// ============================================================================
// LIGHT ORBS
// ============================================================================
vec3 calculateOrbs(vec3 worldPos) {
    vec3 orbColor = vec3(0.0);
    float t = uTime * 0.2;
    
    // Reduced number of orbs for performance
    for (int i = 0; i < 3; i++) {
        float orbId = float(i);
        float phase = orbId * 2.09; // ~120 degrees spacing
        float angle = t + phase;
        
        vec3 orbPos = vec3(
            sin(angle) * 25.0,
            5.0 + sin(angle * 1.3) * 6.0,
            cos(angle * 0.9) * 20.0
        );
        
        vec3 toOrb = orbPos - worldPos;
        float distSq = dot(toOrb, toOrb);
        float orbIntensity = ORB_RADIUS_SQ / (ORB_RADIUS_SQ + distSq * 1.2);
        orbIntensity = orbIntensity * orbIntensity;
        
        float flicker = 0.9 + sin(angle * 2.0 + orbId) * 0.1;
        orbColor += ORB_TINT * orbIntensity * flicker;
    }
    
    return orbColor;
}

// ============================================================================
// MAIN
// ============================================================================
void main() {
    // Setup
    float waveHeight = vNormal.y;
    vec2 patternUV = vWorldPosition.xz * 0.04 + uTime * 0.015;
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    vec3 lightDir = normalize(uLightDirection);
    
    // Calculate light patterns
    float causticPattern = caustics(patternUV, uTime, waveHeight);
    float bands = causticBands(patternUV, uTime);
    float segments = createSegments(patternUV, uTime);
    
    // Combine patterns
    float lightIntensity = max(causticPattern, bands * 0.9) * segments;
    lightIntensity = pow(lightIntensity, 0.7);
    
    // Apply refraction - OPTIMIZED: Single pass approximation
    // Instead of recalculating everything for refraction, we just offset the intensity
    // This saves significant GPU cycles
    vec2 refractedUV = calculateRefraction(normal, patternUV);
    // Simple lookup for refraction instead of full recalculation
    float refractedIntensity = lightIntensity * 0.8; 
    lightIntensity = mix(lightIntensity, refractedIntensity, REFRACTION_BLEND);
    
    // Get colors
    float bandPos = patternUV.y * 2.0;
    vec3 baseColor = lightColor(patternUV, waveHeight, uTime, bandPos);
    vec3 refractedColor = lightColor(refractedUV, waveHeight, uTime, bandPos);
    baseColor = mix(baseColor, refractedColor, 0.4);
    
    // Build final color
    vec3 color = baseColor * lightIntensity;
    
    // Add effects
    float fresnel = calculateFresnel(normal, viewDir);
    vec3 specular = calculateSpecular(normal, viewDir, lightDir);
    float glow = pow(lightIntensity, 0.5) * GLOW_INTENSITY;
    
    color += GLOW_COLOR * glow;
    color += specular;
    
    // Apply Fresnel
    vec3 fresnelColor = mix(baseColor, vec3(0.2, 0.5, 0.9), fresnel * 0.6);
    color = mix(color, fresnelColor, fresnel * FRESNEL_STRENGTH);
    
    // Add chromatic aberration
    color += vec3(0.0, 0.0, 0.1) * fresnel * 0.3;
    
    // Add shimmer
    float shimmer = sin(patternUV.x * 3.0 + patternUV.y * 2.0 + uTime * 2.0) * 0.08 + 0.92;
    color *= shimmer;
    
    // Add floating orbs
    color += calculateOrbs(vWorldPosition);
    
    // Add ambient
    color += vec3(0.01, 0.02, 0.05) * 0.15;
    
    // Calculate alpha
    float alpha = lightIntensity * 0.7 + 0.3;
    alpha = mix(alpha, 0.96, fresnel * 0.4);
    alpha = clamp(alpha, 0.45, 0.96);
    
    // Final color processing
    color = pow(color, vec3(0.87));
    color *= 1.4;
    color = enhanceBlueTones(color);
    color = clamp(color, 0.0, 1.0);
    
    // Apply dithering
    float ditherValue = dither(gl_FragCoord.xy);
    color += (ditherValue - 0.5) * 0.01;
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, alpha);
}
