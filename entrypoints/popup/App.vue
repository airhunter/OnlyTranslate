<template>
  <div class="popup-root">
    <Main />
  </div>
</template>

<script lang="ts" setup>
import Main from "../../components/Main.vue";
import '../../styles/theme.css';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
</script>

<style scoped>
.popup-root {
  min-width: 360px;
  max-width: 360px;
}

::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>
