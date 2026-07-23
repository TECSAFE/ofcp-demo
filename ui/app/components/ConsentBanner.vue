<script setup lang="ts">
const { consent, bannerOpen, save } = useConsent();

const dataExchange = ref(consent.value?.dataExchange ?? false);
const tracking = ref(consent.value?.tracking ?? false);

watch(bannerOpen, (open) => {
  if (open) {
    dataExchange.value = consent.value?.dataExchange ?? false;
    tracking.value = consent.value?.tracking ?? false;
  }
});
</script>

<template>
  <div
    v-if="bannerOpen"
    class="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white p-6 shadow-2xl"
  >
    <div class="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 class="text-lg font-semibold">{{ $t('consent.title') }}</h2>
      <p class="text-sm text-slate-600">{{ $t('consent.intro') }}</p>
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input v-model="dataExchange" type="checkbox" />
        <span>{{ $t('consent.allowDataExchange') }}</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input v-model="tracking" type="checkbox" />
        <span>{{ $t('consent.allowTracking') }}</span>
      </label>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer"
          @click="save({ dataExchange: true, tracking: true })"
        >
          {{ $t('consent.acceptAll') }}
        </button>
        <button
          class="rounded border border-slate-400 px-4 py-2 cursor-pointer"
          @click="save({ dataExchange, tracking })"
        >
          {{ $t('consent.saveSelection') }}
        </button>
        <button
          class="rounded border border-slate-400 px-4 py-2 cursor-pointer"
          @click="save({ dataExchange: false, tracking: false })"
        >
          {{ $t('consent.declineAll') }}
        </button>
      </div>
    </div>
  </div>
</template>
