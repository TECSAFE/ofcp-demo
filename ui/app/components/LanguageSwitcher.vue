<script setup lang="ts">
const { locale, setLocale } = useI18n();
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="cursor-pointer"
      :class="locale === 'de' ? 'font-semibold underline' : ''"
      @click="setLocale('de')"
    >
      {{ $t('language.de') }}
    </button>
    <span aria-hidden="true">·</span>
    <button
      type="button"
      class="cursor-pointer"
      :class="locale === 'en' ? 'font-semibold underline' : ''"
      @click="setLocale('en')"
    >
      {{ $t('language.en') }}
    </button>
  </div>
</template>
