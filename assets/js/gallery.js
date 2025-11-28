// Gallery interactions
document.addEventListener('DOMContentLoaded', () => {
    // Standard navigation - no custom fade out
});

// Fix for back button: Ensure page is visible when restored from bfcache
window.addEventListener('pageshow', (event) => {
    if (event.persisted || document.body.classList.contains('fade-out')) {
        // Instantly restore visibility (bypass transition)
        document.body.style.transition = 'none';
        document.body.classList.remove('fade-out');

        // Force reflow
        void document.body.offsetWidth;

        // Restore transition
        setTimeout(() => {
            document.body.style.transition = '';
        }, 10);
    }
});
