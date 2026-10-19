<script setup lang="ts" generic="T extends string">
const props = defineProps<{
  modelValue: T;
  tabs: { value: T; label: string }[];
  label: string;
  id: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

function onKeydown(event: KeyboardEvent, index: number): void {
  const last = props.tabs.length - 1;
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % props.tabs.length
      : event.key === 'ArrowLeft'
        ? (index + last) % props.tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null;
  if (next === null) return;
  event.preventDefault();
  emit('update:modelValue', props.tabs[next]!.value);
  const parent = (event.currentTarget as HTMLElement).parentElement;
  parent?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="label"
    class="flex gap-1 border-b border-slate-300"
  >
    <button
      v-for="(tab, index) in tabs"
      :id="`${id}-tab-${tab.value}`"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.value"
      :aria-controls="`${id}-panel-${tab.value}`"
      :tabindex="modelValue === tab.value ? 0 : -1"
      class="min-w-0 flex-1 cursor-pointer border-b-2 px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        modelValue === tab.value
          ? 'border-[var(--wl-primary)] font-semibold text-slate-900'
          : 'border-transparent text-slate-600 hover:bg-slate-100'
      "
      @click="emit('update:modelValue', tab.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
