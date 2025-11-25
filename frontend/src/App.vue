<template>
  <div class="app-shell">
    <header>
      <h1 class="app-title">Concept Control Center</h1>
      <p class="app-subtitle">
        Manage the MultiSourceNetwork and PublicProfile concepts from a single
        workspace.
      </p>
      <nav>
        <RouterLink to="/network">MultiSource Network</RouterLink>
        <RouterLink to="/profiles">Public Profiles</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>
