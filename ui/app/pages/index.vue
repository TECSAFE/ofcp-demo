<script setup lang="ts">
const api = useApi();
// Demo-only: fakes the "installed" state by injecting the 250 OFCP dummy
// items (normally hidden from the overview) into the regular listing.
const showDummyItems = ref(false);
const { data } = await useAsyncData(
  'products',
  () =>
    api<{ products: Product[] }>('/products', {
      query: showDummyItems.value ? { includeDummyItems: 'true' } : {},
    }),
  { watch: [showDummyItems] },
);
</script>

<template>
  <div>
    <h1 class="my-6 text-3xl font-semibold">{{ $t('products.title') }}</h1>
    <div class="mb-6 flex flex-col items-start gap-3 rounded border-2 border-dashed border-slate-400 bg-white p-4">
      <p class="text-sm text-slate-700">{{ $t('products.dummyItemsExplainer') }}</p>
      <button
        class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer"
        @click="showDummyItems = !showDummyItems"
      >
        {{ showDummyItems ? $t('products.hideDummyItems') : $t('products.injectDummyItems') }}
      </button>
    </div>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="p in data?.products ?? []"
        :key="p.articleNumber"
        :to="`/product/${p.articleNumber}`"
        class="flex flex-col gap-2 rounded border border-slate-300 bg-white p-4 hover:shadow"
      >
        <div class="flex h-32 items-center justify-center rounded bg-slate-200 text-4xl font-bold text-slate-500">
          {{ p.name.charAt(0) }}
        </div>
        <h2 class="font-semibold">{{ p.name }}</h2>
        <p class="text-sm text-slate-600">{{ p.articleNumber }}</p>
        <p class="font-semibold">{{ p.price.toFixed(2) }} €</p>
        <p v-if="p.stock === 0" class="text-sm text-red-600">{{ $t('common.outOfStock') }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
