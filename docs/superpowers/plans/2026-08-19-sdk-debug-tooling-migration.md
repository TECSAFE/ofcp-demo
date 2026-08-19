# ofcp-demo Debug Widget Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work this plan
> task by task. Steps use checkbox (`- [ ]`) syntax for tracking. **You are running inside an
> `omo` developer job: do NOT dispatch subagents.** Execute inline, committing after each task.

**Goal:** Replace ofcp-demo's local `DebugWidget` subclass with the SDK's `createDebugWidget()`,
and enable both new SDK debug features from `whitelabel.debugWidget`.

**Architecture:** `useTecsafe()` reads the whitelabel settings and passes `debugWidget` into the
`WidgetManagerConfig` as both `debugWidget` and `sdkDebugger` — the demo's single debug switch
turns on both SDK features. Because both flags are constructor-time settings, the existing
plugin that already recreates the manager when `trackingAllowed` changes gains one more watcher
for the debug flag.

**Tech Stack:** Nuxt 4 (`ssr: false`), Vue 3 `<script setup lang="ts">`, Vitest (`pnpm test` in
`ui/`), `vue-tsc`, pnpm. Commands below run from `ui/` unless stated otherwise.

**Spec:** the "Context" and "API CONTRACT" sections above.

## Global Constraints

- **Repo:** `ofcp-demo` only. Do not touch the `api/` workspace — this change is UI-only.
- **Code style:** match the surrounding files — semicolons on, single quotes, 2-space indent,
  explanatory comments in the existing voice (the repo's composables document *why*, not *what*).
- **No new dependencies.**
- The committed `ui/package.json` must reference `@tecsafe/widget-sdk` by npm version.
- **This repo DOES commit superpowers plan docs** (`docs/superpowers/plans/`, existing files are
  named `YYYY-MM-DD-<slug>.md`). Save this plan — the part of this document from the
  `# ofcp-demo Debug Widget Migration Implementation Plan` heading onward — as
  `docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md` and commit it with Task 1,
  following the existing scheme. Do **not** reference it from any code comment, JSDoc or commit
  message.
- **Commit messages:** conventional-commit style, no `Co-authored-by:` trailer for any AI.
- Leave the `InMessageRequestArticleInfo` handler in `useTecsafe.ts` exactly as it is. It reads
  `e.event.articleNumber`, which matches the SDK payload type on `main`
  (`defineMessage<{ articleNumber: string }>('request-article-info')`) — it is correct, not a
  bug. A change to a plural multi-article payload exists as unmerged work elsewhere; if and when
  it lands it becomes its own follow-up job. Do not anticipate it here.

## File Structure

**Create:**
- `docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md` — this plan.
- `ui/tests/tecsafe-debug-config.spec.ts` — unit coverage for the flag mapping.

**Modify:**
- `ui/app/composables/useTecsafe.ts` — delete the local `DebugWidget` class; read whitelabel
  settings; pass `debugWidget` + `sdkDebugger` into `WidgetManagerConfig`; `createDebugWidget()`
  delegates to the manager.
- `ui/app/plugins/tecsafe.client.ts` — recreate the manager when the debug flag flips.
- `ui/app/pages/product/[articleNumber].vue` — drop the now-redundant `widget.show()`.
- `ui/package.json` — bump `@tecsafe/widget-sdk` to `^0.3.0`.

**Keep untouched:** `ui/app/utils/whitelabel.ts` (it already has `debugWidget: boolean`),
`ui/app/utils/whitelabel-share.ts`, `ui/app/components/WhitelabelPanel.vue`,
`ui/tests/whitelabel.spec.ts`, `ui/tests/whitelabel-share.spec.ts` — the whitelabel shape does
not change, so those tests should keep passing untouched. If any of them fail, that is a signal
you changed more than you needed to.

---

### Task 1: Bump the SDK dependency and land the plan doc

**Files:**
- Modify: `ui/package.json` (`"@tecsafe/widget-sdk": "^0.2.1"`)
- Create: `docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md`

**Interfaces:**
- Produces: an installed `@tecsafe/widget-sdk` exposing `createDebugWidget`, `DebugWidget` and
  the two config flags, consumed by Tasks 2–4.

- [ ] **Step 1: Bump the dependency**

In `ui/package.json`, change the `dependencies` entry to:

```json
    "@tecsafe/widget-sdk": "^0.3.0",
```

- [ ] **Step 2: Install**

Run (from `ui/`): `pnpm install`

Expected: succeeds once `@tecsafe/widget-sdk@0.3.0` is published. **If it fails with
`No matching version found for @tecsafe/widget-sdk@^0.3.0`**, that is the expected parallel-work
lag:
1. Record the exact error text for your handover.
2. For local verification only: build the sibling checkout
   (`pnpm --dir ../../widget-sdk install && pnpm --dir ../../widget-sdk build`) and link it
   (`pnpm add "@tecsafe/widget-sdk@link:../../widget-sdk"`). Before your final commit, restore
   `package.json` to the `^0.3.0` npm form and drop the lockfile change
   (`git checkout -- package.json pnpm-lock.yaml`, then re-apply Step 1 by hand).
3. Note the block clearly at the top of your handover.

- [ ] **Step 3: Save the plan doc**

Write the portion of this document from `# ofcp-demo Debug Widget Migration Implementation Plan`
to the end into `docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md`, matching the
formatting of the existing plans in that directory.

- [ ] **Step 4: Commit**

```bash
git add ui/package.json ui/pnpm-lock.yaml docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md
git commit -m "chore: require widget-sdk 0.3.0 for the built-in debug tooling"
```

(If the lockfile could not be updated because the version is unpublished, commit without it and
say so in the handover.)

---

### Task 2: Delegate `createDebugWidget` to the SDK and wire the flags

**Files:**
- Modify: `ui/app/composables/useTecsafe.ts` (imports at lines 1–19; `ensureManager()`'s
  `WidgetManagerConfig` at lines ~59–68; `createDebugWidget()` at lines ~97–104)
- Test: `ui/tests/tecsafe-debug-config.spec.ts` (create)

**Interfaces:**
- Consumes: `manager.createDebugWidget(el)`, `WidgetManagerConfig.debugWidget`,
  `WidgetManagerConfig.sdkDebugger`, `useWhitelabel().settings`.
- Produces: `useTecsafe().createDebugWidget(el: HTMLElement): BaseWidget` — same signature as
  today, so `ui/app/pages/product/[articleNumber].vue` keeps compiling. Also produces
  `buildWidgetManagerConfig` (see below), consumed by the new test.

**Testability note:** `ensureManager()` cannot be unit-tested without a DOM manager and Nuxt
context, so extract the config construction into a pure exported helper and test that. Add to
`ui/app/composables/useTecsafe.ts`, above `useTecsafe()`:

```ts
/**
 * Builds the SDK configuration. Extracted so the flag mapping is testable without a manager:
 * the demo's single whitelabel debug switch turns on both SDK debug features - the debug
 * console widget and the host-page SDK debugger overlay.
 */
export function buildWidgetManagerConfig(input: {
  trackingAllowed: boolean;
  languageRFC4647: string;
  widgetBaseUrl: string;
  debug: boolean;
}): WidgetManagerConfig {
  return new WidgetManagerConfig({
    trackingAllowed: input.trackingAllowed,
    languageRFC4647: input.languageRFC4647,
    currencyCodeISO4217: 'EUR',
    taxIncluded: true,
    widgetBaseURL: input.widgetBaseUrl,
    allowedOrigins: [new URL(input.widgetBaseUrl).origin],
    debugWidget: input.debug,
    sdkDebugger: input.debug,
  });
}
```

- [ ] **Step 1: Write the failing test**

Create `ui/tests/tecsafe-debug-config.spec.ts`. Check how the sibling specs in `ui/tests/`
import from `~/...` or relative paths and follow whichever they use (look at
`ui/tests/whitelabel.spec.ts` and `ui/tests/quantity.spec.ts` first, plus any `vitest.config.*`
alias setup — match them rather than inventing a new import style).

```ts
import { describe, expect, it } from 'vitest';
import { buildWidgetManagerConfig } from '../app/composables/useTecsafe';

const base = {
  trackingAllowed: false,
  languageRFC4647: 'de-DE',
  widgetBaseUrl: 'https://app-ui.example.com/iframe',
};

describe('buildWidgetManagerConfig', () => {
  it('leaves both SDK debug features off by default', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: false });
    expect(config.debugWidget).toBe(false);
    expect(config.sdkDebugger).toBe(false);
  });

  it('turns on both SDK debug features from the single demo debug switch', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: true });
    expect(config.debugWidget).toBe(true);
    expect(config.sdkDebugger).toBe(true);
  });

  it('allows exactly the widget base URL origin', () => {
    const config = buildWidgetManagerConfig({ ...base, debug: false });
    expect(config.allowedOrigins).toEqual(['https://app-ui.example.com']);
    expect(config.widgetBaseURL).toBe('https://app-ui.example.com/iframe');
  });

  it('passes tracking and language through unchanged', () => {
    const config = buildWidgetManagerConfig({
      ...base,
      trackingAllowed: true,
      languageRFC4647: 'en-US',
      debug: false,
    });
    expect(config.trackingAllowed).toBe(true);
    expect(config.languageRFC4647).toBe('en-US');
    expect(config.currencyCodeISO4217).toBe('EUR');
    expect(config.taxIncluded).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `ui/`): `pnpm test -- tests/tecsafe-debug-config.spec.ts`
Expected: FAIL — `buildWidgetManagerConfig` is not exported. (If it fails instead because the
installed SDK has no `debugWidget`/`sdkDebugger` on `WidgetManagerConfig`, that is the
unpublished-version lag from Task 1 — proceed and note it.)

- [ ] **Step 3: Rewrite `useTecsafe.ts`**

Four changes. First the imports — `BaseWidget` is still needed as a **type** for the return
value, but no longer as a base class:

```ts
import {
  IN_MESSAGES,
  OUT_MESSAGES,
  TecsafeWidgetManager,
  WidgetManagerConfig,
} from '@tecsafe/widget-sdk';
import type { BaseWidget } from '@tecsafe/widget-sdk';
```

Second, delete the local class and its comment block entirely:

```ts
// DELETE these lines:
// The SDK ships no factory for the debug console; it is a BaseWidget whose
// iframe path is `debug`. widgetBaseURL already ends in `/iframe`, so the
// iframe resolves to `<widgetBaseUrl>/debug` (e.g. .../iframe/debug).
class DebugWidget extends BaseWidget {
  protected override readonly uiPath = 'debug';
}
```

Third, in `useTecsafe()`, read the whitelabel settings alongside the other composables and use
the new helper. Add next to the existing `const { consent } = useConsent();`:

```ts
  const { settings } = useWhitelabel();
```

and replace the inline `new WidgetManagerConfig({ ... })` argument in `ensureManager()` with:

```ts
      buildWidgetManagerConfig({
        trackingAllowed: consent.value.tracking,
        languageRFC4647:
          $i18n.locales.value.find((l) => l.code === $i18n.locale.value)?.language ??
          $i18n.locale.value,
        widgetBaseUrl: config.public.widgetBaseUrl,
        debug: settings.value.debugWidget,
      }),
```

Fourth, replace `createDebugWidget`:

```ts
  function createDebugWidget(el: HTMLElement): BaseWidget {
    // The SDK's factory registers and shows the widget itself, and only works when
    // config.debugWidget is on - which ensureManager() derives from the whitelabel switch.
    return ensureManager().createDebugWidget(el);
  }
```

Note `config.public.widgetBaseUrl` is used twice today (once for `widgetBaseURL`, once to derive
`allowedOrigins`); the helper does both from its single `widgetBaseUrl` input, so the behaviour
is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- tests/tecsafe-debug-config.spec.ts`
Expected: PASS (all four cases)

- [ ] **Step 5: Full test run and type check**

```bash
pnpm test
pnpm vue-tsc --noEmit
```
Expected: the existing `whitelabel*.spec.ts`, `consent.spec.ts`, `i18n.spec.ts`,
`logo-store.spec.ts`, `proxy-target.spec.ts` and `quantity.spec.ts` all still pass, untouched.

- [ ] **Step 6: Commit**

```bash
git add ui/app/composables/useTecsafe.ts ui/tests/tecsafe-debug-config.spec.ts
git commit -m "refactor: use the SDK debug widget factory and enable the SDK debugger"
```

---

### Task 3: Recreate the manager when the debug switch flips

**Files:**
- Modify: `ui/app/plugins/tecsafe.client.ts` (the plugin body, currently 24 lines)

**Interfaces:**
- Consumes: `useTecsafe().destroy()`, `useWhitelabel().settings`.
- Produces: nothing consumed elsewhere.

**Why this task exists.** Both new SDK flags are read in the `TecsafeWidgetManager`
**constructor**. The manager in this demo is module-level and long-lived
(`useTecsafe.ts`'s `let manager`). So if a visitor opens the whitelabel panel and ticks the debug
switch while a manager already exists, that manager still has `debugWidget: false` and the very
next `createDebugWidget()` call would throw
`createDebugWidget requires WidgetManagerConfig.debugWidget = true`, and no overlay would appear.

The repo already solves exactly this shape of problem for `trackingAllowed`: `tecsafe.client.ts`
destroys the manager, and because the plugin's watcher is registered **before** the product
page's watcher it runs first, so the page's `mountWidget()` then rebuilds the manager with the
new setting (see the comments at `ui/app/pages/product/[articleNumber].vue:53-60`). Follow that
pattern rather than inventing a new one.

- [ ] **Step 1: Add the watcher**

In `ui/app/plugins/tecsafe.client.ts`, add `const { settings } = useWhitelabel();` next to the
other composable calls, and add this watcher **after** the existing `consent` watcher and
**before** the `user` watcher:

```ts
  // The debug switch maps to the SDK's debugWidget/sdkDebugger flags, which are
  // constructor-time settings. Tear the manager down so the PDP's own watcher rebuilds
  // it with the flags applied (this watcher is registered first, so it runs first).
  watch(
    () => settings.value.debugWidget,
    async () => {
      await tecsafe.destroy();
    },
  );
```

- [ ] **Step 2: Verify the ordering assumption holds**

Read `ui/app/pages/product/[articleNumber].vue` and confirm its
`watch(() => settings.value.debugWidget, mountWidget)` is still present and still calls
`mountWidget`, which calls `tecsafe.ensureManager()`. Both watchers observe the same
`settings.value.debugWidget`; the plugin's runs first because plugins initialise before page
components. If you find this assumption does not hold in the browser check below, do **not**
paper over it with a `nextTick` or a timer — mail the PM.

- [ ] **Step 3: Commit**

```bash
pnpm test
git add ui/app/plugins/tecsafe.client.ts
git commit -m "fix: rebuild the widget manager when the demo debug switch flips"
```

---

### Task 4: Drop the redundant `show()` on the product page

**Files:**
- Modify: `ui/app/pages/product/[articleNumber].vue` (`mountWidget()`, lines ~39–51)

**Interfaces:** none produced.

Both branches of `mountWidget()` now come from SDK factories, and every SDK factory already calls
`show()` on the widget it registers. The trailing `widget.show();` is a no-op left over from the
hand-rolled path, which did not show the widget itself.

- [ ] **Step 1: Remove the line**

In `mountWidget()`, delete the trailing `widget.show();` so the function ends:

```ts
  widget = settings.value.debugWidget
    ? tecsafe.createDebugWidget(container.value)
    : manager.createProductDetailWidget(container.value, articleNumber);
```

Leave the rest of the function — the `try`/`catch` around `widget?.destroy()`, the consent and
container guards, and all three watchers — exactly as they are.

- [ ] **Step 2: Type check and test**

```bash
pnpm vue-tsc --noEmit
pnpm test
```
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add "ui/app/pages/product/[articleNumber].vue"
git commit -m "refactor: drop the redundant show() call after SDK widget creation"
```

---

### Task 5: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Full pipeline**

From the repo root:

```bash
pnpm --dir ui install
pnpm --dir ui test
pnpm --dir ui exec vue-tsc --noEmit
pnpm --dir ui build
```
All must pass. Capture the real output. The `api/` workspace is untouched by this job, but if the
repo's root `pnpm test` runs both, run it too and confirm the api side is unaffected.

- [ ] **Step 2: Confirm the acceptance criteria by hand**

```bash
grep -rn "extends BaseWidget" --include="*.ts" --include="*.vue" ui/app
```
Expected: no hits — no local `BaseWidget` subclass remains.

```bash
grep -rn "getWidgets()" --include="*.ts" --include="*.vue" ui/app
```
Expected: no hits — the manual registry push is gone.

- [ ] **Step 3: Walk the demo in the browser**

Start the demo (`pnpm dev` from the repo root, which runs the api on :4000 and the ui on :3000)
and check, in order:

1. Open a product page, accept data-exchange consent. With the debug switch **off**:
   the normal product detail widget renders, and there is **no** "open sdk debugger" launcher
   anywhere on the page.
2. Open the whitelabel panel, tick the debug switch, save. The page should now show the debug
   console iframe **and** exactly one "open sdk debugger" launcher bottom-right. No
   `createDebugWidget requires WidgetManagerConfig.debugWidget = true` error in the console —
   this is what Task 3 exists for.
3. Expand the overlay: the widget selector lists the app widget and the debug widget; traffic
   appears in both directions; "reset widget" and "send message" act on the selected widget.
4. Untick the debug switch, save. The product detail widget returns and the launcher disappears.
5. Withdraw data-exchange consent: widget and overlay both go away (the plugin's existing
   `destroy()` path plus the SDK's `destroyAll()`).
6. Reload with the switch on and confirm state survives (whitelabel is persisted in
   localStorage).
7. Check the browser console throughout: no uncaught errors.

If the SDK version is unpublished, use the local-link fallback from Task 1 Step 2 for this walk
and say so.

- [ ] **Step 4: Verify before claiming done**

Use the superpowers:verification-before-completion skill. Paste actual command output for
`pnpm --dir ui test`, the type check and `pnpm --dir ui build` into your handover, plus what you
observed at each of the seven browser steps.

- [ ] **Step 5: Handover**

State explicitly in your handover:
- whether `@tecsafe/widget-sdk@0.3.0` resolved from npm, or the PR is blocked on that release
  (with the exact install error);
- that the committed `ui/package.json` references `^0.3.0` and not a local link;
- that the plan doc landed at
  `docs/superpowers/plans/2026-08-19-sdk-debug-tooling-migration.md`;
- anything where the real SDK API differed from the frozen contract above — the PM turns those
  into small follow-up jobs, do not paper over them silently.
