<script setup lang="ts">
import type { BaseWidget } from '@tecsafe/widget-sdk';
import { sanitizeQuantity } from '~/utils/quantity';

const route = useRoute();
const api = useApi();
const { consent, openBanner } = useConsent();
const tecsafe = useTecsafe();
const { settings } = useWhitelabel();

const articleNumber = route.params.articleNumber as string;
const { data } = await useAsyncData(`product-${articleNumber}`, () =>
  api<{ product: Product }>(`/products/${articleNumber}`).catch(() => null),
);
const product = computed(() => data.value?.product ?? null);

const quantity = ref(1);
const adding = ref(false);
const added = ref(false);

async function addToCart(): Promise<void> {
  if (!product.value || adding.value) return;
  adding.value = true;
  added.value = false;
  try {
    await api('/cart/items', {
      method: 'POST',
      body: { articleNumber, quantity: sanitizeQuantity(quantity.value) },
    });
    added.value = true;
  } finally {
    adding.value = false;
  }
}

const container = ref<HTMLElement | null>(null);
let widget: BaseWidget | null = null;

async function mountWidget(): Promise<void> {
  try {
    widget?.destroy();
  } catch {
    // The widget may already be gone after a manager destroyAll().
  }
  widget = null;
  if (!consent.value?.dataExchange || !container.value) return;
  const manager = tecsafe.ensureManager();
  widget = settings.value.debugWidget
    ? tecsafe.createDebugWidget(container.value)
    : manager.createProductDetailWidget(container.value, articleNumber);
}

onMounted(mountWidget);
// Re-mount when consent changes: grant -> create; tracking change -> the
// plugin destroyed the manager first (registered earlier, runs first), so
// ensureManager() rebuilds it with the new trackingAllowed flag.
watch(consent, mountWidget);
// Re-mount when the debug toggle flips (Save closes the panel and updates
// settings): swap the product widget for the debug console and back.
watch([() => settings.value.debugWidget, () => settings.value.sdkDebugger], mountWidget);

onBeforeUnmount(() => {
  try {
    widget?.destroy();
  } catch {
    // ignore
  }
  widget = null;
});
</script>

<template>
  <div>
    <div v-if="product" class="my-8 grid grid-cols-1 gap-10 md:grid-cols-2">
      <div
        class="flex h-64 items-center justify-center rounded bg-slate-200 text-6xl font-bold text-slate-500"
      >
        {{ product.name.charAt(0) }}
      </div>
      <div class="flex flex-col gap-3">
        <h1 class="text-3xl font-semibold">{{ product.name }}</h1>
        <p class="text-sm text-slate-600">
          {{
            $t('product.meta', {
              article: product.articleNumber,
              ean: product.ean,
            })
          }}
        </p>
        <p>{{ product.description }}</p>
        <p class="text-2xl font-semibold">
          {{ product.price.toFixed(2) }} €
          <span class="text-sm font-normal">{{ $t('product.inclVat') }}</span>
        </p>
        <p v-if="product.stock === 0" class="text-red-600">
          {{ $t('common.outOfStock') }}
        </p>
        <div class="mt-2 flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm" for="quantity">
            {{ $t('product.quantity') }}
            <input
              id="quantity"
              v-model.number="quantity"
              type="number"
              min="1"
              class="w-20 rounded border border-slate-300 bg-white px-2 py-1"
            />
          </label>
          <button
            class="rounded bg-(--wl-primary) px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            :disabled="product.stock === 0 || adding"
            @click="addToCart"
          >
            {{ $t('product.addToCart') }}
          </button>
          <span v-if="added" class="text-sm text-emerald-700">{{ $t('product.addedToCart') }}</span>
        </div>
      </div>
    </div>
    <p v-else class="my-8">{{ $t('product.notFound') }}</p>

    <section class="my-8">
      <!-- <h2 class="mb-3 text-xl font-semibold">{{ $t('product.configuratorTitle') }}</h2> -->
      <div
        v-if="!consent?.dataExchange"
        class="flex flex-col items-start gap-3 rounded border-2 border-dashed border-slate-400 bg-white p-6"
      >
        <p>{{ $t('product.configuratorConsentRequired') }}</p>
        <button
          class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer"
          @click="openBanner"
        >
          {{ $t('product.openPrivacySettings') }}
        </button>
      </div>
      <p
        v-if="consent?.dataExchange && settings.debugWidget"
        class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {{ $t('product.debugWidgetActive') }}
      </p>
      <div v-show="consent?.dataExchange" ref="container"></div>
    </section>
  </div>
</template>
