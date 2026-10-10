<template>
  <ul class="pdf-outline" :aria-label="t('ebook.toc')">
    <li v-for="row in rows" :key="row.item.id" :style="{ paddingLeft: `${Math.min(row.depth, 8) * 14}px` }">
      <button
        v-if="row.item.items.length"
        type="button"
        class="pdf-outline__expand"
        :aria-expanded="expanded.has(row.item.id)"
        :aria-label="t(expanded.has(row.item.id) ? 'pdf.collapseOutline' : 'pdf.expandOutline', { title: row.item.title || t('pdf.untitledOutline') })"
        @click="toggle(row.item.id)"
      >{{ expanded.has(row.item.id) ? '▾' : '▸' }}</button>
      <span v-else class="pdf-outline__spacer" aria-hidden="true" />
      <button
        type="button"
        class="pdf-outline__title"
        :class="{ 'pdf-outline__title--active': activeId === row.item.id }"
        :aria-current="activeId === row.item.id ? 'location' : undefined"
        :disabled="!row.item.dest && !row.item.items.length"
        :title="row.item.title || t('pdf.untitledOutline')"
        @click="row.item.dest ? emit('select', row.item) : toggle(row.item.id)"
      >{{ row.item.title || t('pdf.untitledOutline') }}</button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PdfOutlineItem } from './outline'

const props = defineProps<{ items: PdfOutlineItem[]; activeId: string }>()
const emit = defineEmits<{ select: [item: PdfOutlineItem] }>()
const { t } = useI18n()
const expanded = ref(new Set<string>())
watch(() => props.items, items => {
  expanded.value = new Set(items.filter(item => item.items.length).map(item => item.id))
}, { immediate: true })
const rows = computed(() => {
  const result: Array<{ item: PdfOutlineItem; depth: number }> = []
  const visit = (items: PdfOutlineItem[], depth: number): void => {
    for (const item of items) {
      result.push({ item, depth })
      if (expanded.value.has(item.id)) visit(item.items, depth + 1)
    }
  }
  visit(props.items, 0)
  return result
})
function toggle(id: string): void {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}
</script>
