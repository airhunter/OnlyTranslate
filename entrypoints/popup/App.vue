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
  width: 360px;
}
</style>
