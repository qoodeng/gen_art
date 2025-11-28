document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('background-layer');
    const ballCount = 3; // Reduced by 1 to make room for the ring
    const balls = [];

    // Updated colors: Electric Blue, Sunset Orange, Soft White
    const colors = [
        'rgba(0, 100, 255, 1)',   // Electric Blue
        'rgba(255, 100, 50, 1)',  // Sunset Orange
        'rgba(255, 255, 255, 0.8)' // Soft White
    ];

    class FloatingElement {
        constructor() {
            this.element = document.createElement('div');
            this.element.classList.add('light-ball');
            // Random color from the palette
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.element.style.backgroundColor = color;

            // Random size between 30% and 60% of min viewport dimension
            const minDim = Math.min(window.innerWidth, window.innerHeight);
            this.size = minDim * (0.3 + Math.random() * 0.3);

            this.element.style.width = `${this.size}px`;
            this.element.style.height = `${this.size}px`;

            // Random initial position
            this.x = Math.random() * window.innerWidth;
            this.y = Math.random() * window.innerHeight;

            // Random velocity (faster)
            this.vx = (Math.random() - 0.5) * 4.0;
            this.vy = (Math.random() - 0.5) * 4.0;

            container.appendChild(this.element);
            this.updatePosition();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off walls (keep fully on screen)
            const radius = this.size / 2;

            if (this.x < radius || this.x > window.innerWidth - radius) {
                this.vx *= -1;
                // Clamp position to prevent sticking
                if (this.x < radius) this.x = radius;
                if (this.x > window.innerWidth - radius) this.x = window.innerWidth - radius;
            }
            if (this.y < radius || this.y > window.innerHeight - radius) {
                this.vy *= -1;
                // Clamp position to prevent sticking
                if (this.y < radius) this.y = radius;
                if (this.y > window.innerHeight - radius) this.y = window.innerHeight - radius;
            }

            // Organic movement changes
            if (Math.random() < 0.02) { // Slightly more frequent changes
                this.vx += (Math.random() - 0.5) * 0.5; // Stronger nudges
                this.vy += (Math.random() - 0.5) * 0.5;

                // Cap velocity
                const maxSpeed = 5.0; // Increased from 1.5
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (speed > maxSpeed) {
                    this.vx = (this.vx / speed) * maxSpeed;
                    this.vy = (this.vy / speed) * maxSpeed;
                }
            }
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
        }

        updatePosition() {
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
        }
    }

    // Initialize balls
    for (let i = 0; i < 4; i++) {
        balls.push(new FloatingElement());
    }

    // Animation loop
    function animate() {
        balls.forEach(ball => ball.update());
        requestAnimationFrame(animate);
    }

    animate();

    // Handle resize
    window.addEventListener('resize', () => {
        // Optional: adjust sizes on resize
    });
});
