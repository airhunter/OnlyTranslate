<template>
  <div class="footer-container footer-size">
    <el-button
      class="clear-btn"
      :type="btnType"
      :loading="showLoading"
      :disabled="buttonDisabled"
      size="small"
      @click="clearCache"
    >
      {{ buttonText }}
    </el-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import browser from 'webextension-polyfill';

const buttonDisabled = ref(false);
const buttonText = ref('清除翻译缓存');
const showLoading = ref(false);
const status = ref<'idle' | 'success' | 'failed'>('idle');

const btnType = computed(() => {
  if (status.value === 'success') return 'success';
  if (status.value === 'failed') return 'danger';
  return 'default';
});

async function clearCache() {
  try {
    buttonDisabled.value = true;
    showLoading.value = true;
    buttonText.value = '正在清除...';
    status.value = 'idle';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('No active tab found');
    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    status.value = 'success';
    buttonText.value = '清除成功';
  } catch (error) {
    console.error('清除缓存失败:', error);
    status.value = 'failed';
    buttonText.value = '清除失败';
  } finally {
    showLoading.value = false;
    setTimeout(() => {
      buttonDisabled.value = false;
      buttonText.value = '清除翻译缓存';
      status.value = 'idle';
    }, 1500);
  }
}
</script>

<style scoped>
.footer-container {
  display: flex;
  justify-content: center;
  padding: 4px 0 2px;
}

.clear-btn {
  width: 100%;
}
</style>
