<script setup lang="ts">
import { cartItemName } from '~/utils/cart-title';

const api = useApi();
const { locale, locales } = useI18n();
const language = computed(
  () => locales.value.find((entry) => entry.code === locale.value)?.language ?? locale.value,
);
const { data, refresh } = await useAsyncData('cart', () => api<CartView>('/cart'));

async function clearCart(): Promise<void> {
  await api('/cart', { method: 'DELETE' });
  await refresh();
}
</script>

<template>
  <div>
    <h1 class="my-6 text-3xl font-semibold">{{ $t('cart.title') }}</h1>
    <p v-if="!data || data.items.length === 0" class="text-slate-600">{{ $t('cart.empty') }}</p>
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="(item, index) in data.items"
        :key="index"
        class="flex items-center justify-between rounded border border-slate-300 bg-white p-4"
      >
        <div>
          <p class="font-semibold">{{ cartItemName(item, language) }}</p>
          <p class="text-sm text-slate-600">
            {{ $t('cart.itemMeta', { article: item.articleNumber, qty: item.quantity }) }}
          </p>
          <p v-if="item.configurationId" class="text-sm text-emerald-700">
            {{ $t('cart.configuration', { id: item.configurationId }) }}
          </p>
        </div>
        <p class="font-semibold">{{ item.lineTotal.toFixed(2) }} €</p>
      </div>
      <div class="flex items-center justify-between border-t border-slate-300 pt-4">
        <button class="underline" @click="clearCart">{{ $t('cart.clear') }}</button>
        <p class="text-xl font-semibold">{{ $t('cart.total', { amount: data.total.toFixed(2) }) }}</p>
      </div>
    </div>
  </div>
</template>
