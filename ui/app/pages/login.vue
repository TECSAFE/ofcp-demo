<script setup lang="ts">
const { login } = useAuth();
const { t } = useI18n();

const email = ref('');
const password = ref('');
const error = ref('');

async function submit(): Promise<void> {
  error.value = '';
  try {
    await login(email.value, password.value);
    await navigateTo('/');
  } catch {
    error.value = t('login.error');
  }
}
</script>

<template>
  <div class="mx-auto my-12 max-w-sm">
    <h1 class="mb-6 text-3xl font-semibold">{{ $t('login.title') }}</h1>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1">
        <span class="text-sm">{{ $t('login.email') }}</span>
        <input v-model="email" type="email" required class="rounded border border-slate-400 p-2" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm">{{ $t('login.password') }}</span>
        <input v-model="password" type="password" required class="rounded border border-slate-400 p-2" />
      </label>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p class="text-sm text-slate-600">{{ $t('login.accountsDeletedHint') }}</p>
      <button type="submit" class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer">{{ $t('login.submit') }}</button>
      <p class="text-sm">
        {{ $t('login.noAccount') }}
        <NuxtLink to="/register" class="underline">{{ $t('login.registerLink') }}</NuxtLink>
      </p>
    </form>
  </div>
</template>
