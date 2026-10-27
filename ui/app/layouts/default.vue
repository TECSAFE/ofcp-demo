<script setup lang="ts">
const { user, logout } = useAuth();
const { openBanner } = useConsent();
const { settings, logoUrl, openPanel } = useWhitelabel();
const { openEditor } = useTecsafe();
const editorUrl = useRuntimeConfig().public.editorUrl;

async function onLogout(): Promise<void> {
  await logout();
  await navigateTo('/');
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
    <header class="bg-[var(--wl-surface)]">
      <div class="mx-auto flex max-w-5xl items-center justify-between p-4">
        <NuxtLink to="/" class="flex items-center gap-3 text-2xl font-semibold">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="$t('nav.logoAlt', { shop: settings.shopName })"
            class="h-8 max-w-40 object-contain"
          />
          <span>{{ settings.shopName }}</span>
        </NuxtLink>
        <nav class="flex items-center gap-4">
          <NuxtLink to="/">{{ $t('nav.products') }}</NuxtLink>
          <NuxtLink to="/cart">{{ $t('nav.cart') }}</NuxtLink>
          <template v-if="user">
            <span class="text-sm text-slate-600">{{ user.email }}</span>
            <button class="underline cursor-pointer" @click="onLogout">{{ $t('nav.logout') }}</button>
          </template>
          <template v-else>
            <NuxtLink to="/login">{{ $t('nav.login') }}</NuxtLink>
            <NuxtLink to="/register">{{ $t('nav.register') }}</NuxtLink>
          </template>
        </nav>
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl grow p-4">
      <slot />
    </main>
    <footer class="bg-[var(--wl-surface)]">
      <div class="mx-auto flex max-w-5xl items-center justify-between p-4 text-sm">
        <span>{{ $t('footer.tagline') }}</span>
        <div class="flex items-center gap-4">
          <button v-if="editorUrl" class="underline cursor-pointer" @click="openEditor">{{ $t('footer.openEditor') }}</button>
          <button class="underline cursor-pointer" @click="openPanel">{{ $t('footer.shopAppearance') }}</button>
          <button class="underline cursor-pointer" @click="openBanner">{{ $t('footer.privacySettings') }}</button>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
    <ConsentBanner />
    <WhitelabelPanel />
  </div>
</template>
