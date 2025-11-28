const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let time = 0;
const DOT_SIZE = 1.2;
const GRID_SPACING = 4;
const CENTER_X = 0.5;
const CENTER_Y = 0.5;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function init() {
    resize();
    window.addEventListener('resize', resize);
    animate();
}

function animate() {
    time += 0.005; // Slower animation

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width * CENTER_X;
    const centerY = canvas.height * CENTER_Y;

    // Draw radial dot pattern
    for (let x = 0; x < canvas.width; x += GRID_SPACING) {
        for (let y = 0; y < canvas.height; y += GRID_SPACING) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Create multiple pulsing waves with different frequencies
            // Smoother waves
            const wave1 = Math.sin(distance * 0.01 - time * 2) * 0.5 + 0.5;
            const wave2 = Math.sin(distance * 0.02 - time * 1.5) * 0.3 + 0.3;
            const wave = (wave1 + wave2) / 2;

            // Density increases towards center
            const densityFactor = 1 - Math.min(distance / (canvas.width * 0.7), 1);
            const opacity = wave * densityFactor * 0.3; // Lower opacity

            if (opacity > 0.15) {
                ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, y, DOT_SIZE, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    requestAnimationFrame(animate);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
