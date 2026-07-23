<script setup lang="ts">
const { register } = useAuth();
const { t } = useI18n();

const email = ref('');
const password = ref('');
const random = ref(false);
const error = ref('');

function randomAcc(): void {
  const randomEmail = `demo+${Math.random().toString(36).substring(2, 8)}@example.com`;
  email.value = randomEmail;
  password.value = randomEmail;
  random.value = true;
  navigator.clipboard.writeText(randomEmail).then();
}

async function submit(): Promise<void> {
  error.value = '';
  try {
    await register(email.value, password.value);
    await navigateTo('/');
  } catch {
    error.value = t('register.error');
  }
}
</script>

<template>
  <div class="mx-auto my-12 max-w-sm">
    <h1 class="mb-6 text-3xl font-semibold">{{ $t('register.title') }}</h1>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1">
        <span class="text-sm">{{ $t('register.email') }}</span>
        <input v-model="email" type="email" required class="rounded border border-slate-400 p-2" @input="random = false" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm">{{ $t('register.password') }}</span>
        <input v-model="password" type="password" required minlength="6" class="rounded border border-slate-400 p-2" @input="random = false" />
      </label>
      <p class="text-sm text-slate-600">{{ $t('register.privacyHint') }}</p>
      <p class="text-sm text-slate-600">{{ $t('register.accountsDeletedHint') }}</p>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p class="text-sm text-slate-600">
        {{ $t('register.randomPrompt') }}
        <button type="button" class="underline cursor-pointer" @click="randomAcc">{{ $t('register.generateButton') }}</button>
      </p>
      <p v-if="random" class="text-sm text-slate-600">{{ $t('register.randomGenerated') }}</p>
      <button type="submit" class="rounded bg-(--wl-primary) px-4 py-2 text-white cursor-pointer">{{ $t('register.submit') }}</button>
    </form>
  </div>
</template>
