uniform sampler2D tDiffuse;
uniform float uTime;
varying vec2 vUv;

// Thermal Gradient Colors
// Deep Blue -> Blue -> Cyan -> Yellow -> Red -> White
vec3 getThermalColor(float value) {
    vec3 c1 = vec3(0.0, 0.0, 0.5); // Deep Blue (Cold)
    vec3 c2 = vec3(0.0, 0.0, 1.0); // Blue
    vec3 c3 = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 c4 = vec3(1.0, 1.0, 0.0); // Yellow
    vec3 c5 = vec3(1.0, 0.0, 0.0); // Red
    vec3 c6 = vec3(1.0, 1.0, 1.0); // White (Hot)
    
    float t = clamp(value, 0.0, 1.0);
    
    if (t < 0.2) return mix(c1, c2, t / 0.2);
    if (t < 0.4) return mix(c2, c3, (t - 0.2) / 0.2);
    if (t < 0.6) return mix(c3, c4, (t - 0.4) / 0.2);
    if (t < 0.8) return mix(c4, c5, (t - 0.6) / 0.2);
    return mix(c5, c6, (t - 0.8) / 0.2);
}

// Noise function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    // Sample the low-res texture
    vec4 texel = texture2D(tDiffuse, vUv);
    
    // Calculate brightness/heat value
    // We assume brighter objects = hotter
    float brightness = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
    
    // Boost contrast to make heat stand out
    float heatValue = pow(brightness, 1.2) * 1.5;
    
    // Add subtle noise for sensor grain
    float noise = (random(vUv * uTime) - 0.5) * 0.05;
    heatValue += noise;
    
    // Map to thermal color
    vec3 thermalColor = getThermalColor(heatValue);
    
    // Add scanlines
    float scanline = sin(vUv.y * 800.0) * 0.02;
    thermalColor -= scanline;
    
    gl_FragColor = vec4(thermalColor, 1.0);
}
