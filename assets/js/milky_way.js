
const canvas = document.getElementById('galaxy-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let mouse = { x: 0, y: 0, isDown: false };

// Configuration
const CONFIG = {
    particleCount: 10000, // Increased density
    armCount: 2, // Two defined arms like real Milky Way
    armSpread: 0.04, // Realistic loose winding
    coreSize: 40,
    rotationSpeed: -0.00005, // Reversed rotation
    aspectRatio: 0.5, // Flatter perspective
    tilt: -0.15, // Closer to horizontal
    colors: [
        '#10002B', // 0: Dark Violet (Background/Edge)
        '#240046', // 1: Deep Indigo
        '#3C096C', // 2: Rich Purple
        '#F0E6EF', // 3: Core Cream
        '#FFD6A5', // 4: Inner Orange
        '#FF99C8', // 5: Mid Pink
        '#F72585', // 6: Hot Pink
        '#7B2CBF', // 7: Electric Purple
        '#E0AAFF', // 8: Lavender (Highlight)
        '#FFFFFF', // 9: White Stars
        '#4CC9F0', // 10: Subtle Blue (Accent)
        '#FF6B6B'  // 11: Salmon/Coral
    ],
    springStrength: 0.0005, // Very slow return
    friction: 0.85, // High damping to prevent swinging (overdamped)
    interactionRadius: 50,
    interactionStrength: 0.08
};

let draggedParticle = null;

class Particle {
    constructor(x, y, color, isBackground = false) {
        // Reverse engineering the position to get polar coordinates
        // 1. Translate to center AND Mirror X (dx = -(x - center))
        let dx = -(x - width / 2);
        let dy = y - height / 2;

        // 2. Un-rotate (inverse tilt)
        // x' = x cos(-t) - y sin(-t)
        // y' = x sin(-t) + y cos(-t)
        const cos = Math.cos(-CONFIG.tilt);
        const sin = Math.sin(-CONFIG.tilt);
        const rdx = dx * cos - dy * sin;
        const rdy = dx * sin + dy * cos;

        // 3. Un-squash
        const udy = rdy / CONFIG.aspectRatio;

        this.distance = Math.sqrt(rdx * rdx + udy * udy);
        this.angle = Math.atan2(udy, rdx);

        // Current position
        this.x = x;
        this.y = y;

        // Velocity
        this.vx = 0;
        this.vy = 0;

        this.color = color;
        // Background stars are smaller, galaxy        this.color = color;
        this.size = isBackground ? 2 : (Math.random() > 0.8 ? 5 : 4);
        this.isDragged = false;
        this.isBackground = isBackground;

        // Initial Velocity to match rotation (prevent "standing still" at start)
        if (!this.isBackground) {
            const omega = CONFIG.rotationSpeed * 16.6; // Approx radians per frame
            const vTangent = this.distance * omega;

            const vxFlat = -Math.sin(this.angle) * vTangent;
            const vyFlat = Math.cos(this.angle) * vTangent;

            // Apply Squash
            const vxSquash = vxFlat;
            const vySquash = vyFlat * CONFIG.aspectRatio;

            // Apply Tilt
            const cos = Math.cos(CONFIG.tilt);
            const sin = Math.sin(CONFIG.tilt);

            this.vx = vxSquash * cos - vySquash * sin;
            this.vy = vxSquash * sin + vySquash * cos;
        }

        // Twinkle properties for background stars
        if (this.isBackground) {
            this.twinkleOffset = Math.random() * Math.PI * 2;
            this.twinkleSpeed = 0.0005 + Math.random() * 0.001; // Much slower twinkle
        }
    }

    update() {
        // Background particles are locked in place (no rotation)
        let currentHomeAngle = this.angle;

        if (!this.isBackground) {
            currentHomeAngle += performance.now() * CONFIG.rotationSpeed;
        }

        // 1. Calculate Un-tilted, Squashed position
        const ux = Math.cos(currentHomeAngle) * this.distance;
        const uy = Math.sin(currentHomeAngle) * this.distance * CONFIG.aspectRatio;

        // 2. Apply Tilt
        const cos = Math.cos(CONFIG.tilt);
        const sin = Math.sin(CONFIG.tilt);
        const rx = ux * cos - uy * sin;
        const ry = ux * sin + uy * cos;

        // Mirror X axis: width/2 - rx instead of + rx
        const homeX = width / 2 - rx;
        const homeY = height / 2 + ry;

        // 2. Interaction
        if (this.isDragged) {
            this.x = mouse.x;
            this.y = mouse.y;
            this.vx = 0;
            this.vy = 0;
        } else {
            // 3. Spring Force (Return to Home)
            const dxHome = homeX - this.x;
            const dyHome = homeY - this.y;

            this.vx += dxHome * CONFIG.springStrength;
            this.vy += dyHome * CONFIG.springStrength;

            // 4. Physics Update
            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            this.x += this.vx;
            this.y += this.vy;
        }
    }

    draw() {
        if (this.isBackground) {
            // Twinkle effect: Modulate opacity
            const time = performance.now();
            const alpha = 0.3 + 0.7 * Math.abs(Math.sin(time * this.twinkleSpeed + this.twinkleOffset));
            ctx.globalAlpha = alpha;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

        if (this.isBackground) {
            ctx.globalAlpha = 1.0; // Reset alpha
        }
    }
}

function init() {
    resize();
    createGalaxy();

    document.body.classList.add('loaded');

    animate();
}

function createGalaxy() {
    particles = [];

    // 1. Background Field (Static Stars)
    const bgCount = 1000;
    for (let i = 0; i < bgCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        // Mostly dark blue background, but with some white stars
        let color;
        if (Math.random() > 0.9) color = '#FFFFFF'; // Bright star
        else if (Math.random() > 0.7) color = '#5A189A'; // Dim Purple Star
        else color = CONFIG.colors[0]; // Dark Violet Void

        particles.push(new Particle(x, y, color, true));
    }

    // 2. The Galaxy
    const galaxyCount = 9000; // Increased density
    const maxR = (Math.min(width, height) / 2 * 0.95); // Use almost full screen
    for (let i = 0; i < galaxyCount; i++) {
        // Distribution: Balanced
        const r = Math.pow(Math.random(), 1.3) * maxR;

        const spiralAngle = r * CONFIG.armSpread;
        const armIndex = i % CONFIG.armCount;
        const armOffset = (Math.PI * 2 / CONFIG.armCount) * armIndex;

        // Slightly less defined arms (soften edges)
        const scatter = (Math.random() - 0.5) * 1.9;
        const rNoise = (Math.random() - 0.5) * 38;

        const angle = spiralAngle + armOffset + scatter;
        const finalR = r + rNoise;

        // 1. Calculate Un-tilted, Squashed position
        const ux = Math.cos(angle) * finalR;
        const uy = Math.sin(angle) * finalR * CONFIG.aspectRatio;

        // 2. Apply Tilt
        const cos = Math.cos(CONFIG.tilt);
        const sin = Math.sin(CONFIG.tilt);
        const rx = ux * cos - uy * sin;
        const ry = ux * sin + uy * cos;

        // Mirror X axis
        const x = width / 2 - rx;
        const y = height / 2 + ry;

        // Mixed Color Logic
        // Heavy jitter to mix bands thoroughly
        const distRatio = (r / maxR) + (Math.random() - 0.5) * 0.4;

        let color;
        // Use overlapping probability ranges for a "mixed" look
        const rand = Math.random();

        if (distRatio < 0.2) {
            // Core: Cream, Orange, Salmon
            if (rand > 0.6) color = CONFIG.colors[3]; // Cream
            else if (rand > 0.3) color = CONFIG.colors[4]; // Orange
            else color = CONFIG.colors[11]; // Salmon
        } else if (distRatio < 0.5) {
            // Mid: Pink, Salmon, Hot Pink, Electric Purple
            if (rand > 0.7) color = CONFIG.colors[5]; // Mid Pink
            else if (rand > 0.5) color = CONFIG.colors[11]; // Salmon
            else if (rand > 0.3) color = CONFIG.colors[6]; // Hot Pink
            else color = CONFIG.colors[7]; // Electric Purple
        } else if (distRatio < 0.8) {
            // Outer: Electric Purple, Rich Purple, Lavender, Hot Pink
            if (rand > 0.7) color = CONFIG.colors[7]; // Electric Purple
            else if (rand > 0.5) color = CONFIG.colors[2]; // Rich Purple
            else if (rand > 0.3) color = CONFIG.colors[8]; // Lavender
            else color = CONFIG.colors[6]; // Hot Pink
        } else {
            // Edge: Deep Indigo, Rich Purple, Subtle Blue
            if (rand > 0.7) color = CONFIG.colors[1]; // Deep Indigo
            else if (rand > 0.4) color = CONFIG.colors[2]; // Rich Purple
            else color = CONFIG.colors[10]; // Subtle Blue
        }

        // Occasional bright star
        if (Math.random() > 0.99) color = CONFIG.colors[9];

        particles.push(new Particle(x, y, color));
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    if (particles.length > 0) createGalaxy();
}

function animate() {
    requestAnimationFrame(animate);

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, width, height);

    // Interaction: Collision Drag
    // If a particle is dragged, it collides with and pushes neighbors
    if (draggedParticle) {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p === draggedParticle) continue;

            // Ignore background particles
            if (p.isBackground) continue;

            const dx = draggedParticle.x - p.x;
            const dy = draggedParticle.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Simple collision: sum of radii (approximate for squares)
            // Give it a tiny bit of buffer for smoother feel
            const minDist = (draggedParticle.size + p.size) / 2 + 1;

            if (dist < minDist) {
                // Collision detected! Push p away.

                // Normal vector pointing from Dragged -> P
                // dx is Dragged - P, so we want -dx
                const nx = -dx / dist;
                const ny = -dy / dist;

                const overlap = minDist - dist;

                // 1. Displace (Hard collision)
                p.x += nx * overlap;
                p.y += ny * overlap;

                // 2. Add Impulse (Bounce)
                // Transfer some energy to the hit particle
                const force = 0.5;
                p.vx += nx * force;
                p.vy += ny * force;
            }
        }
    }

    particles.forEach(p => {
        p.update();
        p.draw();
    });
}

// Event Listeners
window.addEventListener('resize', resize);

const handleStart = (x, y) => {
    mouse.x = x;
    mouse.y = y;
    mouse.isDown = true;

    // Find closest particle to grab
    let closest = null;
    let minD = 30; // Increased grab radius

    for (const p of particles) {
        // Ignore background particles
        if (p.isBackground) continue;

        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) {
            minD = d;
            closest = p;
        }
    }

    if (closest) {
        draggedParticle = closest;
        closest.isDragged = true;
        canvas.style.cursor = 'grabbing';
    }
};

const handleMove = (x, y) => {
    mouse.x = x;
    mouse.y = y;
};

const handleEnd = () => {
    mouse.isDown = false;
    if (draggedParticle) {
        draggedParticle.isDragged = false;
        draggedParticle = null;
        canvas.style.cursor = 'grab';
    }
};

window.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY));
window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
window.addEventListener('mouseup', handleEnd);

window.addEventListener('touchstart', e => {
    e.preventDefault();
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchmove', e => {
    e.preventDefault();
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchend', handleEnd);

init();
