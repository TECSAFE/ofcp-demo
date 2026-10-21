<script setup lang="ts">
import { getStoredLogo } from '~/utils/logo-store';
import { isHexColor, validateLogoFile, type LogoValidationError } from '~/utils/whitelabel';

const { settings, panelOpen, save, reset, shareOnServer } = useWhitelabel();

const shopName = ref(settings.value.shopName);
const logoBlob = ref<Blob | null>(null);
const logoPreviewUrl = ref<string | null>(null);
const primaryColor = ref(settings.value.primaryColor);
const surfaceColor = ref(settings.value.surfaceColor);
const debugWidget = ref(settings.value.debugWidget);
const sdkDebugger = ref(settings.value.sdkDebugger);
const activeTab = ref('branding');
const { t } = useI18n();
const tabs = computed(() =>
  ['branding', 'debugger', 'sharing'].map((value) => ({
    value,
    label: t(`whitelabel.tabs.${value}`),
  })),
);
const logoError = ref<LogoValidationError | null>(null);
const colorsAreValid = computed(
  () => isHexColor(primaryColor.value) && isHexColor(surfaceColor.value),
);

const { locale } = useI18n();

type ShareErrorKey = 'wrongSecret' | 'disabled' | 'failed';
const shareSecret = ref('');
const shareDays = ref(7);
const shareBusy = ref(false);
const shareLink = ref<string | null>(null);
const shareExpiresAt = ref<string | null>(null);
const shareError = ref<ShareErrorKey | null>(null);
const shareCopied = ref(false);

function setLogoBlob(blob: Blob | null): void {
  if (logoPreviewUrl.value) URL.revokeObjectURL(logoPreviewUrl.value);
  logoBlob.value = blob;
  logoPreviewUrl.value = blob ? URL.createObjectURL(blob) : null;
}

watch(panelOpen, async (open) => {
  if (!open) return;
  shopName.value = settings.value.shopName;
  primaryColor.value = settings.value.primaryColor;
  surfaceColor.value = settings.value.surfaceColor;
  debugWidget.value = settings.value.debugWidget;
  sdkDebugger.value = settings.value.sdkDebugger;
  logoError.value = null;
  shareError.value = null;
  shareLink.value = null;
  shareExpiresAt.value = null;
  shareCopied.value = false;
  setLogoBlob(await getStoredLogo().catch(() => null));
});

function onLogoSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  logoError.value = validateLogoFile(file);
  if (!logoError.value) setLogoBlob(file);
}

async function onSave(): Promise<void> {
  if (!colorsAreValid.value) return;
  await save(
    {
      shopName: shopName.value.trim() || 'Demo Shop',
      primaryColor: primaryColor.value,
      surfaceColor: surfaceColor.value,
      debugWidget: debugWidget.value,
      sdkDebugger: sdkDebugger.value,
    },
    logoBlob.value,
  );
}

const shareExpiryText = computed(() =>
  shareExpiresAt.value ? new Date(shareExpiresAt.value).toLocaleDateString(locale.value) : '',
);

async function onShare(): Promise<void> {
  if (!colorsAreValid.value) return;
  shareBusy.value = true;
  shareError.value = null;
  shareLink.value = null;
  shareCopied.value = false;
  try {
    const days = Math.min(30, Math.max(1, Math.round(shareDays.value || 7)));
    const result = await shareOnServer(
      {
        shopName: shopName.value.trim() || 'Demo Shop',
        primaryColor: primaryColor.value,
        surfaceColor: surfaceColor.value,
        debugWidget: debugWidget.value,
        sdkDebugger: sdkDebugger.value,
      },
      logoBlob.value,
      shareSecret.value,
      days,
    );
    shareLink.value = result.link;
    shareExpiresAt.value = result.expiresAt;
  } catch (err) {
    const status =
      (err as { statusCode?: number }).statusCode ?? (err as { status?: number }).status;
    shareError.value = status === 401 ? 'wrongSecret' : status === 503 ? 'disabled' : 'failed';
  } finally {
    shareBusy.value = false;
  }
}

function onCopyLink(): void {
  if (!shareLink.value) return;
  navigator.clipboard
    .writeText(shareLink.value)
    .then(() => {
      shareCopied.value = true;
    })
    .catch(() => {
      shareCopied.value = false;
    });
}
</script>

<template>
  <div
    v-if="panelOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    @click.self="panelOpen = false"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-settings-title"
      class="flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded bg-white p-6 shadow-2xl"
    >
      <h2 id="demo-settings-title" class="text-lg font-semibold">
        {{ $t('whitelabel.title') }}
      </h2>
      <p class="text-sm text-slate-600">{{ $t('whitelabel.intro') }}</p>
      <SettingsTabs
        v-model="activeTab"
        id="demo-settings"
        :tabs="tabs"
        :label="$t('whitelabel.title')"
      />
      <div
        v-show="activeTab === 'branding'"
        id="demo-settings-panel-branding"
        role="tabpanel"
        aria-labelledby="demo-settings-tab-branding"
        class="flex flex-col gap-4"
      >
        <label class="flex flex-col gap-1 text-sm">
          <span>{{ $t('whitelabel.shopName') }}</span>
          <input v-model="shopName" type="text" class="rounded border border-slate-400 px-2 py-1" />
        </label>
        <div class="flex flex-col gap-1 text-sm">
          <span>{{ $t('whitelabel.logoLabel') }}</span>
          <div class="flex items-center gap-3">
            <img
              v-if="logoPreviewUrl"
              :src="logoPreviewUrl"
              :alt="$t('whitelabel.logoPreviewAlt')"
              class="h-10 max-w-40 object-contain"
            />
            <input
              type="file"
              accept="image/*"
              @change="onLogoSelected"
              class="border border-slate-400 rounded p-1 cursor-pointer"
            />
            <button v-if="logoBlob" class="underline cursor-pointer" @click="setLogoBlob(null)">
              {{ $t('whitelabel.removeLogo') }}
            </button>
          </div>
          <p v-if="logoError" class="text-sm text-red-600">
            {{ $t('whitelabel.logoError.' + logoError) }}
          </p>
        </div>
        <div class="grid gap-3 text-sm sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span>{{ $t('whitelabel.surfaceColor') }}</span>
            <span class="flex items-center gap-2">
              <input v-model="surfaceColor" type="color" class="h-9 w-12 shrink-0 cursor-pointer" />
              <input
                v-model="surfaceColor"
                type="text"
                inputmode="text"
                maxlength="7"
                pattern="#[0-9a-fA-F]{6}"
                placeholder="#cbd5e1"
                aria-label="Surface color hex value"
                class="min-w-0 grow rounded border border-slate-400 px-2 py-1 font-mono uppercase invalid:border-red-600"
              />
            </span>
          </label>
          <label class="flex flex-col gap-1">
            <span>{{ $t('whitelabel.primaryColor') }}</span>
            <span class="flex items-center gap-2">
              <input v-model="primaryColor" type="color" class="h-9 w-12 shrink-0 cursor-pointer" />
              <input
                v-model="primaryColor"
                type="text"
                inputmode="text"
                maxlength="7"
                pattern="#[0-9a-fA-F]{6}"
                placeholder="#0f172a"
                aria-label="Primary color hex value"
                class="min-w-0 grow rounded border border-slate-400 px-2 py-1 font-mono uppercase invalid:border-red-600"
              />
            </span>
          </label>
        </div>
      </div>
      <div
        v-show="activeTab === 'debugger'"
        id="demo-settings-panel-debugger"
        role="tabpanel"
        aria-labelledby="demo-settings-tab-debugger"
        class="flex flex-col gap-4"
      >
        <p class="text-sm text-slate-600">
          {{ $t('whitelabel.debuggerIntro') }}
        </p>
        <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input v-model="sdkDebugger" type="checkbox" />
          <span>{{ $t('whitelabel.sdkDebugger') }}</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input v-model="debugWidget" type="checkbox" />
          <span>{{ $t('whitelabel.debugWidget') }}</span>
        </label>
      </div>
      <div
        v-show="activeTab === 'sharing'"
        id="demo-settings-panel-sharing"
        role="tabpanel"
        aria-labelledby="demo-settings-tab-sharing"
        class="flex flex-col gap-2 text-sm"
      >
        <h3 class="font-semibold">{{ $t('whitelabel.share.title') }}</h3>
        <p class="text-slate-600">{{ $t('whitelabel.share.intro') }}</p>
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex grow flex-col gap-1">
            <span>{{ $t('whitelabel.share.secret') }}</span>
            <input
              v-model="shareSecret"
              type="password"
              autocomplete="off"
              class="rounded border border-slate-400 px-2 py-1"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span>{{ $t('whitelabel.share.duration') }}</span>
            <input
              v-model.number="shareDays"
              type="number"
              min="1"
              max="30"
              class="w-24 rounded border border-slate-400 px-2 py-1"
            />
          </label>
          <button
            class="rounded bg-[var(--wl-primary)] px-4 py-2 text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="shareBusy || shareSecret.trim() === '' || !colorsAreValid"
            @click="onShare"
          >
            {{ $t('whitelabel.share.submit') }}
          </button>
        </div>
        <p v-if="shareError" class="text-red-600">
          {{ $t('whitelabel.share.error.' + shareError) }}
        </p>
        <template v-if="shareLink">
          <input
            :value="shareLink"
            readonly
            class="grow rounded border border-slate-400 px-2 py-1"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            class="self-start rounded border border-slate-400 px-3 py-1 cursor-pointer"
            @click="onCopyLink"
          >
            {{ $t(shareCopied ? 'whitelabel.share.copied' : 'whitelabel.share.copy') }}
          </button>
          <p class="text-slate-600">
            {{ $t('whitelabel.share.expires', { date: shareExpiryText }) }}
          </p>
        </template>
      </div>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!colorsAreValid"
          @click="onSave"
        >
          {{ $t('whitelabel.save') }}
        </button>
        <button class="rounded border border-slate-400 px-4 py-2 cursor-pointer" @click="reset">
          {{ $t('whitelabel.reset') }}
        </button>
        <button
          class="rounded border border-slate-400 px-4 py-2 cursor-pointer"
          @click="panelOpen = false"
        >
          {{ $t('whitelabel.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
