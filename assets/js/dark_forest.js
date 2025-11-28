const canvas = document.getElementById('eyes-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let eyes = [];
let fireflies = [];

// Configuration
const EYE_COUNT = 8; // Reduced from 15
const FIREFLY_COUNT = 25; // Fewer fireflies for a darker feel
const DARKNESS_ALPHA = 0.92; // Very dark
const GLOW_RADIUS_BASE = 60;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', resize);
resize();

class Eye {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        // Try to avoid the very bottom where the ground usually is
        if (this.y > height * 0.8) this.y = Math.random() * height * 0.8;

        this.size = Math.random() * 4 + 2; // Small eyes
        this.blinkState = 'CLOSED'; // OPEN, CLOSED, OPENING, CLOSING
        this.blinkTimer = Math.random() * 200 + 50;
        this.openProgress = 0;
        this.color = '#ff3333'; // Red evil eyes
    }

    update() {
        this.blinkTimer--;

        if (this.blinkTimer <= 0) {
            switch (this.blinkState) {
                case 'CLOSED':
                    this.blinkState = 'OPENING';
                    this.blinkTimer = 10;
                    break;
                case 'OPENING':
                    this.blinkState = 'OPEN';
                    this.blinkTimer = Math.random() * 100 + 50; // Stay open for a bit
                    break;
                case 'OPEN':
                    this.blinkState = 'CLOSING';
                    this.blinkTimer = 10;
                    break;
                case 'CLOSING':
                    this.blinkState = 'CLOSED';
                    this.blinkTimer = Math.random() * 2000 + 500; // Stay closed for much longer (very infrequent)
                    this.reset(); // Always move when closed
                    break;
            }
        }

        if (this.blinkState === 'OPENING') {
            this.openProgress += 0.1;
            if (this.openProgress >= 1) this.openProgress = 1;
        } else if (this.blinkState === 'CLOSING') {
            this.openProgress -= 0.1;
            if (this.openProgress <= 0) this.openProgress = 0;
        }
    }

    draw(ctx) {
        if (this.blinkState === 'CLOSED' && this.openProgress <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.openProgress; // Fade in/out
        // Snap to integer coordinates for pixel look
        ctx.translate(Math.floor(this.x), Math.floor(this.y));

        // Draw two eyes
        const eyeSpacing = Math.floor(this.size * 3.5);
        const eyeWidth = Math.floor(this.size * 1.5);
        const eyeHeight = Math.max(1, Math.floor(this.size * 1.5 * this.openProgress));

        ctx.fillStyle = this.color;

        // Left eye
        ctx.fillRect(-eyeSpacing / 2 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);

        // Right eye
        ctx.fillRect(eyeSpacing / 2 - eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight);

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        ctx.restore();
    }
}

class Firefly {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5 + 0.5;
        this.phase = Math.random() * Math.PI * 2;
        this.glowRadius = GLOW_RADIUS_BASE * (Math.random() * 0.5 + 0.8);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Randomly change direction slightly
        if (Math.random() < 0.02) {
            this.vx += (Math.random() - 0.5) * 0.1;
            this.vy += (Math.random() - 0.5) * 0.1;
        }

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1) {
            this.vx = (this.vx / speed) * 1;
            this.vy = (this.vy / speed) * 1;
        }

        this.phase += 0.05;
    }

    draw(ctx) {
        const alpha = (Math.sin(this.phase) + 1) / 2 * 0.2 + 0.8; // Very bright fireflies (0.8 to 1.0)

        ctx.fillStyle = `rgba(200, 255, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGlow(ctx) {
        // This draws the "hole" in the darkness
        const alpha = (Math.sin(this.phase) + 1) / 2 * 0.2 + 0.8; // Stronger glow hole
        const currentGlowRadius = this.glowRadius * alpha;

        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentGlowRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentGlowRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function init() {
    for (let i = 0; i < EYE_COUNT; i++) {
        eyes.push(new Eye());
    }
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        fireflies.push(new Firefly());
    }
    animate();
}

function animate() {
    // 1. Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // 2. Update all entities
    eyes.forEach(eye => eye.update());
    fireflies.forEach(firefly => firefly.update());

    // 3. Draw Darkness Layer with Holes
    // Create a temporary canvas or just use composite operations

    ctx.save();
    // Fill screen with darkness
    ctx.fillStyle = `rgba(0, 0, 0, ${DARKNESS_ALPHA})`;
    ctx.fillRect(0, 0, width, height);

    // Punch holes for fireflies
    ctx.globalCompositeOperation = 'destination-out';
    fireflies.forEach(firefly => firefly.drawGlow(ctx));

    ctx.restore();

    // 4. Draw Fireflies (actual dots) on top
    fireflies.forEach(firefly => firefly.draw(ctx));

    // 5. Draw Eyes on top of darkness (they glow in the dark)
    eyes.forEach(eye => eye.draw(ctx));

    requestAnimationFrame(animate);
}

init();
