<script setup lang="ts">
import { CONSENT_VERSIONS, consentForVersion, type ConsentVersion } from '~/utils/consent';

const { consent, bannerOpen, save } = useConsent();
const { t } = useI18n();
const version = ref<ConsentVersion>(consent.value?.version ?? 'v1');
const dataExchange = ref(consent.value?.dataExchange ?? false);
const tracking = ref(consent.value?.tracking ?? false);
const nativeTracking = ref(consent.value?.nativeTracking ?? false);
const busy = ref(false);
const failed = ref(false);
const tabs = computed(() =>
  CONSENT_VERSIONS.map((value) => ({
    value,
    label: t(`consent.versions.${value}.label`),
  })),
);
const combinedTracking = computed({
  get: () => tracking.value && nativeTracking.value,
  set: (value: boolean) => {
    tracking.value = value;
    nativeTracking.value = value;
  },
});

watch(bannerOpen, (open) => {
  if (open) {
    version.value = consent.value?.version ?? 'v1';
    dataExchange.value = consent.value?.dataExchange ?? false;
    tracking.value = consent.value?.tracking ?? false;
    nativeTracking.value = consent.value?.nativeTracking ?? false;
    failed.value = false;
  }
});

async function onSave(all?: boolean): Promise<void> {
  busy.value = true;
  failed.value = false;
  try {
    await save(
      consentForVersion(version.value, {
        dataExchange: all ?? dataExchange.value,
        tracking: all ?? (version.value === 'v3' ? tracking.value : combinedTracking.value),
        nativeTracking: all ?? nativeTracking.value,
      }),
    );
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}

function showPrivacyPolicy(): void {
  window.alert(t('consent.privacyPolicyPlaceholder'));
}
</script>

<template>
  <section
    v-if="bannerOpen"
    aria-labelledby="consent-title"
    class="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto border-t border-slate-300 bg-white p-6 shadow-2xl"
  >
    <div class="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 id="consent-title" class="text-lg font-semibold">
        {{ $t('consent.title') }}
      </h2>
      <SettingsTabs
        v-model="version"
        id="privacy"
        :tabs="tabs"
        :label="$t('consent.versionLabel')"
      />
      <div
        v-for="item in CONSENT_VERSIONS"
        v-show="version === item"
        :id="`privacy-panel-${item}`"
        :key="item"
        role="tabpanel"
        :aria-labelledby="`privacy-tab-${item}`"
        class="flex flex-col gap-3"
      >
        <p class="text-sm text-slate-600">
          {{ $t(`consent.versions.${item}.description`) }}
        </p>
        <label
          class="flex items-center gap-2 select-none"
          :class="{ 'cursor-pointer': item !== 'v1' }"
        >
          <input v-if="item === 'v1'" type="checkbox" checked disabled />
          <input v-else v-model="dataExchange" type="checkbox" />
          <span>{{
            item === 'v1' ? $t('consent.requiredPrivacy') : $t('consent.allowDataExchange')
          }}</span>
        </label>
        <template v-if="item === 'v3'">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input v-model="tracking" type="checkbox" />
            <span>{{ $t('consent.allowTecsafeTracking') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input v-model="nativeTracking" type="checkbox" />
            <span>{{ $t('consent.allowNativeTracking') }}</span>
          </label>
        </template>
        <label v-else class="flex items-center gap-2 cursor-pointer select-none">
          <input v-model="combinedTracking" type="checkbox" />
          <span>{{ $t('consent.allowTracking') }}</span>
        </label>
      </div>
      <p v-if="failed" role="alert" class="text-sm text-red-600">
        {{ $t('consent.saveError') }}
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer disabled:opacity-50"
          :disabled="busy"
          @click="onSave(true)"
        >
          {{ $t('consent.acceptAll') }}
        </button>
        <button
          class="rounded border border-slate-400 px-4 py-2 cursor-pointer disabled:opacity-50"
          :disabled="busy"
          @click="onSave()"
        >
          {{ $t('consent.saveSelection') }}
        </button>
        <button
          class="rounded border border-slate-400 px-4 py-2 cursor-pointer disabled:opacity-50"
          :disabled="busy"
          @click="onSave(false)"
        >
          {{ version === 'v1' ? $t('consent.declineOptionalTracking') : $t('consent.declineAll') }}
        </button>
      </div>
      <button
        v-if="version === 'v1'"
        type="button"
        class="self-start cursor-pointer text-sm text-slate-600 underline"
        @click="showPrivacyPolicy"
      >
        {{ $t('consent.privacyPolicyInfo') }}
      </button>
    </div>
  </section>
</template>
