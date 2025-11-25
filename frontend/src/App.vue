<template>
  <div class="app-shell">
    <header>
      <div>
        <h1 class="app-title">Concept Control Center</h1>
        <p class="app-subtitle">
          Manage the MultiSourceNetwork and PublicProfile concepts from a single
          workspace.
        </p>
        <nav>
          <RouterLink to="/network">MultiSource Network</RouterLink>
          <RouterLink to="/profiles">Public Profiles</RouterLink>
        </nav>
      </div>
      <div class="auth-status" v-if="auth.isAuthenticated">
        <div class="user-chip">
          <img class="avatar-chip" :src="avatar.src" alt="Profile avatar" />
          <div>
            <p class="muted">
              Logged in as <strong>{{ auth.username }}</strong>
            </p>
            <button type="button" class="settings-btn" @click="showSettings = true">
              ⚙️ Settings
            </button>
          </div>
        </div>
        <button type="button" @click="auth.logout()">Logout</button>
      </div>
    </header>

    <main>
      <RouterView />
    </main>

    <AuthModal v-if="!auth.isAuthenticated" />
    <CreateProfileModal v-else-if="profileGate.isOpen" />
    <UserSettingsPanel
      v-else-if="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import AuthModal from "@/components/AuthModal.vue";
import CreateProfileModal from "@/components/CreateProfileModal.vue";
import UserSettingsPanel from "@/components/UserSettingsPanel.vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProfileGateStore } from "@/stores/useProfileGate";
import { ref } from "vue";
import { useAvatarStore } from "@/stores/useAvatarStore";

const auth = useAuthStore();
const profileGate = useProfileGateStore();
const avatar = useAvatarStore();
const showSettings = ref(false);
</script>
