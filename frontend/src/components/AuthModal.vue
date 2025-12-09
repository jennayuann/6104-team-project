<template>
  <div class="auth-overlay">
    <div class="auth-panel">
      <div class="panel-header">
        <h2>Welcome! Please {{ mode === "login" ? "log in" : "sign up" }}</h2>
        <button
          class="modal-close"
          @click="handleClose"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <p class="muted">
        Authentication is powered by the `UserAuthentication` concept (MongoDB-backed).
      </p>

      <div class="auth-toggle">
        <button
          type="button"
          :class="{ active: mode === 'login' }"
          @click="setMode('login')"
        >
          Login
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="setMode('register')"
        >
          Sign Up
        </button>
      </div>

      <form class="form-grid" @submit.prevent="handleSubmit">
        <label>
          Username
          <input v-model.trim="form.username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            minlength="6"
          />
        </label>

        <button type="submit" :disabled="auth.loading">
          {{ auth.loading ? "Working..." : mode === "login" ? "Login" : "Create Account" }}
        </button>
        <p v-if="auth.error" class="banner error">{{ auth.error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProfileGateStore } from "@/stores/useProfileGate";

type Mode = "login" | "register";

const auth = useAuthStore();
const profileGate = useProfileGateStore();
const mode = ref<Mode>("login");

const form = reactive({
  username: "",
  password: "",
});

function setMode(next: Mode) {
  mode.value = next;
  auth.error = null;
}

function handleClose() {
  // Clear any errors and reset form
  auth.error = null;
  form.username = "";
  form.password = "";
  mode.value = "login";
}

async function handleSubmit() {
  if (!form.username || !form.password) return;
  if (mode.value === "login") {
    await auth.login({ username: form.username, password: form.password });
  } else {
    await auth.register({ username: form.username, password: form.password });
    profileGate.requireProfile();
  }
  form.password = "";
}
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
}

.modal-close {
  background: #f1f5f9;
  border: 2px solid #e2e8f0;
  font-size: 1.75rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  line-height: 1;
}

.modal-close:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #0f172a;
  transform: scale(1.1);
}
</style>
