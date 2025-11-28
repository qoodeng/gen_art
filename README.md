# Underwater Wave Visualization

An immersive generative art piece that simulates the view of ocean waves from beneath the surface. Experience the feeling of lying on the ocean floor looking up at the undulating water surface above.

## Features

- **Realistic Wave Simulation**: Multiple overlapping Gerstner waves with varying frequencies, amplitudes, and directions
- **Perlin/Simplex Noise**: Natural, non-repetitive wave patterns
- **Caustics**: Dynamic light caustics projected onto the ocean floor using custom GLSL shaders
- **Volumetric God Rays**: Light shafts penetrating from above
- **Atmospheric Scattering**: Depth-based color gradients from deep blues to lighter surface colors
- **Interactive Controls**: Mouse/touch rotation and keyboard adjustments

## Technical Implementation

### Wave Algorithms

The visualization uses a combination of:
- **Gerstner Waves**: Physically-based ocean simulation with 4 overlapping waves
- **Simplex Noise**: Procedural noise for organic variation
- **Time-based Animation**: Continuous, smooth wave motion

### Shaders

- **Vertex Shader**: Handles wave displacement and surface deformation
- **Fragment Shader**: Applies caustics, lighting, color gradients, and atmospheric effects

### Performance

- Optimized geometry resolution (512x512 subdivisions)
- Efficient shader calculations
- Target: 60fps performance

## Getting Started

### Installation

1. Clone or download this repository
2. Install dependencies (optional, uses CDN by default):

```bash
npm install
```

### Running

Simply open `index.html` in a modern web browser, or use a local server:

```bash
npm run dev
# or
npx serve .
```

Then navigate to `http://localhost:3000` (or the port shown).

## Controls

### Mouse/Touch
- **Click and Drag**: Rotate the camera view around the ocean floor
- **Touch and Drag**: Same as mouse on touch devices

### Keyboard
- **W/S**: Increase/Decrease wave intensity
- **A/D**: Decrease/Increase wave speed
- **Space**: Reset all parameters to defaults

### UI Controls
- **Wave Intensity Slider**: Adjust the height of waves (0-2)
- **Wave Speed Slider**: Control animation speed (0-3)
- **Caustics Intensity Slider**: Adjust caustic light patterns (0-2)

## Browser Requirements

- Modern browser with WebGL support
- ES6 modules support
- Three.js r128 or compatible

## Project Structure

```
gen_art/
├── index.html          # Main HTML file
├── main.js             # Three.js scene setup and controls
├── shaders/
│   ├── vertex.glsl     # Vertex shader for wave displacement
│   └── fragment.glsl   # Fragment shader for lighting and effects
├── package.json        # Project dependencies
└── README.md           # This file
```

## Customization

### Adjusting Wave Parameters

Edit the wave parameters in `shaders/vertex.glsl`:

```glsl
// Modify these values in the gerstnerWave calls:
vec3 wave1 = gerstnerWave(pos.xz, 0.3 * uWaveIntensity, 0.5, 0.8 * uWaveSpeed, ...);
```

### Changing Colors

Modify the color palette in `shaders/fragment.glsl`:

```glsl
vec3 deepColor = vec3(0.05, 0.15, 0.25);      // Deep blue
vec3 surfaceColor = vec3(0.2, 0.4, 0.6);      // Lighter blue-green
```

### Performance Tuning

Adjust geometry resolution in `main.js`:

```javascript
const geometry = new THREE.PlaneGeometry(200, 200, 512, 512);
// Reduce 512 to 256 or 128 for better performance on slower devices
```

## License

MIT License - feel free to use and modify for your projects!

## Credits

Built with [Three.js](https://threejs.org/) and custom GLSL shaders.

