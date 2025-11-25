<template>
  <div class="auth-overlay">
    <div class="auth-panel user-settings-panel">
      <button class="close-btn" type="button" @click="emit('close')">×</button>
      <h2 style="margin-top: 0">Your profile</h2>
      <p class="muted" style="margin-top: 0">
        Signed in as <strong>{{ auth.username }}</strong>
      </p>

      <StatusBanner
        v-if="banner"
        :type="banner.type"
        :message="banner.message"
      />

      <div class="profile-picture-block">
        <img :src="displayedAvatar" alt="Profile picture" />
        <button type="button" @click="triggerPicker">Upload new photo</button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileChange"
        />
      </div>

      <div class="profile-details" v-if="profile">
        <p><strong>Headline:</strong> {{ profile.headline }}</p>
        <div>
          <strong>Attributes:</strong>
          <ul>
            <li v-for="attr in profile.attributes" :key="attr">{{ attr }}</li>
          </ul>
        </div>
        <div>
          <strong>Links:</strong>
          <ul>
            <li v-for="link in profile.links" :key="link">
              <a :href="link" target="_blank" rel="noreferrer">{{ link }}</a>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="muted">No public profile found yet.</p>

      <button
        type="button"
        class="danger"
        @click="handleDeleteProfile"
        :disabled="deleting"
      >
        {{ deleting ? "Deleting…" : "Delete Profile" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import StatusBanner from "@/components/StatusBanner.vue";
import {
  PublicProfileAPI,
  type PublicProfile,
} from "@/services/conceptClient";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAvatarStore } from "@/stores/useAvatarStore";

const emit = defineEmits<{ (e: "close"): void }>();

const auth = useAuthStore();
const avatarStore = useAvatarStore();
const profile = ref<PublicProfile | null>(null);
const previewUrl = ref<string | null>(null);
const banner = ref<{ type: "success" | "error"; message: string } | null>(null);
const deleting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const displayedAvatar = computed(() =>
  previewUrl.value || avatarStore.src || avatarStore.DEFAULT_AVATAR
);

async function loadProfile() {
  if (!auth.userId) return;
  try {
    const result = await PublicProfileAPI.getProfile({ user: auth.userId });
    profile.value = result[0]?.profile ?? null;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unable to load profile.";
    banner.value = { type: "error", message };
  }
}

function triggerPicker() {
  fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    previewUrl.value = reader.result as string;
    avatarStore.set(previewUrl.value);
  };
  reader.readAsDataURL(file);
}

async function handleDeleteProfile() {
  if (!auth.userId) return;
  deleting.value = true;
  banner.value = null;
  try {
    await PublicProfileAPI.deleteProfile({ user: auth.userId });
    profile.value = null;
    banner.value = { type: "success", message: "Profile deleted." };
    previewUrl.value = null;
    avatarStore.reset();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to delete profile.";
    banner.value = { type: "error", message };
  } finally {
    deleting.value = false;
  }
}

watch(
  () => auth.userId,
  () => {
    loadProfile();
  },
  { immediate: true },
);

onMounted(() => {
  loadProfile();
  previewUrl.value = avatarStore.src;
});
</script>
