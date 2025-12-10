<template>
    <div class="landing-page">
        <header class="landing-header">
            <div class="brand">Contact Web</div>
            <div class="nav-actions">
                <button class="nav-btn" @click="showLogin = true">
                    Log In
                </button>
                <button
                    class="nav-btn nav-btn-outline"
                    @click="showSignup = true"
                >
                    Sign Up
                </button>
            </div>
        </header>

        <div class="landing-content">
            <div class="hero-section">
                <h1 class="hero-title">
                    Welcome to ContactWeb: Your Professional Network, Unified
                </h1>
                <p class="hero-subtitle">
                    With <strong>ContactWeb</strong>, seamlessly connect,
                    organize, and manage your entire professional network.<br />
                    Bring together relationships from LinkedIn, Instagram,
                    Handshake, and more—all in one platform built by us, for
                    you.
                </p>
            </div>

            <div class="features-section">
                <div class="feature-card">
                    <div class="feature-icon">🔗</div>
                    <h3>ContactWeb Multi-Source Connections</h3>
                    <p>
                        Effortlessly import and control contacts from several
                        platforms using <strong>ContactWeb</strong>'s unified
                        network hub.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔍</div>
                    <h3>ContactWeb Smart Search</h3>
                    <p>
                        Instantly find and filter connections within your
                        <strong>ContactWeb</strong> network using our fast,
                        intelligent search.
                    </p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <h3>ContactWeb Network Insights</h3>
                    <p>
                        Visualize, explore, and understand your career network
                        with <strong>ContactWeb</strong>'s interactive
                        analytics.
                    </p>
                </div>
            </div>

            <!-- CTA removed per design: header now provides Log In / Sign Up -->
        </div>

        <!-- Login Modal -->
        <LoginModal v-if="showLogin" @close="showLogin = false" />

        <!-- Signup Modal -->
        <SignupModal v-if="showSignup" @close="showSignup = false" />
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import LoginModal from "@/components/LoginModal.vue";
import SignupModal from "@/components/SignupModal.vue";

const showLogin = ref(false);
const showSignup = ref(false);
</script>

<style scoped>
.landing-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0d1b2a 0%, #1b263b 50%, #415a77 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    /* More space between top/bottom of viewport and content */
    padding: 3.5rem 2rem;
    color: white;
}

.landing-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 92px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 3rem;
    background: linear-gradient(
        90deg,
        rgba(13, 27, 42, 0.96),
        rgba(27, 38, 59, 0.92)
    );
    box-shadow: 0 10px 28px rgba(2, 6, 23, 0.58);
    z-index: 60;
}

.landing-header .brand {
    font-weight: 800;
    font-size: 1.25rem;
}

.landing-header .nav-actions {
    display: flex;
    gap: 0.5rem;
}

.nav-btn {
    padding: 0.6rem 1.2rem;
    border-radius: 0.55rem;
    border: none;
    background: rgba(255, 255, 255, 0.98);
    color: var(--color-navy-900);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    min-width: 140px;
}

.nav-btn-outline {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.9);
}

.landing-content {
    max-width: 1200px;
    width: 100%;
    text-align: center;
    /* Account for the fixed header height so content sits below it */
    padding-top: 7.5rem;
    height: calc(100vh - 7.5rem);
    display: flex;
    flex-direction: column;
    justify-content: center; /* center vertically within remaining viewport */
    gap: 1.5rem;
}

.hero-section {
    margin-bottom: 2rem;
}

.hero-title {
    font-size: clamp(2rem, 4.5vw, 3.5rem);
    font-weight: 800;
    margin: 0 0 1rem;
    line-height: 1.15;
    letter-spacing: -0.02em;
}

.hero-subtitle {
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    margin: 0;
    opacity: 0.9;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.5;
}

.features-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.feature-card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.9rem;
    padding: 1.5rem 1.75rem;
    min-height: 170px;
    transition: transform 0.18s ease, background 0.18s ease;
}

.feature-card:hover {
    transform: translateY(-4px);
    background: rgba(255, 255, 255, 0.12);
}

.feature-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.feature-card h3 {
    margin: 0 0 0.25rem;
    font-size: 1.02rem;
    font-weight: 700;
}

.feature-card p {
    margin: 0;
    opacity: 0.9;
    line-height: 1.28;
    font-size: 0.92rem;
}

.cta-section {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1rem;
    padding: 1.5rem 1rem;
}

.cta-title {
    font-size: clamp(1.25rem, 2.2vw, 2rem);
    font-weight: 700;
    margin: 0 0 0.5rem;
}

.cta-subtitle {
    font-size: clamp(0.95rem, 1.6vw, 1.125rem);
    margin: 0 0 1rem;
    opacity: 0.9;
}

.cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.cta-button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 0.6rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 130px;
}

.cta-button.primary {
    background: white;
    color: var(--color-navy-900);
}

.cta-button.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.25);
}

.cta-button.secondary {
    background: transparent;
    color: white;
    border: 2px solid white;
}

.cta-button.secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
}

@media (max-width: 768px) {
    .landing-content {
        height: auto;
    }

    .hero-title {
        font-size: 2.2rem;
    }

    .hero-subtitle {
        font-size: 1.05rem;
    }

    .features-section {
        grid-template-columns: 1fr;
    }

    .cta-buttons {
        flex-direction: column;
    }

    .cta-button {
        width: 100%;
    }

    /* Mobile: slightly smaller header and tighter spacing */
    .landing-header {
        height: 64px;
        padding: 0 1.25rem;
    }

    .landing-content {
        padding-top: 5.5rem;
    }

    .nav-btn {
        min-width: 110px;
        font-size: 0.95rem;
        padding: 0.5rem 0.9rem;
    }
}
</style>
