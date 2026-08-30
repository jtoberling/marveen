# Qwen CLI Integráció — Terv-checkpoint (RESCUE / RECOVERY FILE)

> **Cél:** Ha a jelen Qwen-integrációs folyamat megszakad, eltör, vagy átkerül
> másik munkamenetbe/agent-be, ez a fájl lehetővé teszi a pontos folytatást
> line-by-line szinten. Minden bejegyzés egy konkrét fájl+soron mutatja a
> **jelenlegi állapotot**, a **célállapotot**, és a **pontos javítást**.
>
> **Dátum:** 2026-08-30
> **Állapot:** Elemzés kész, implementáció félbehagyott. A P1-P5 sorrendben kell
> végrehajtani.
>
> **KÖVETKEZENDŐ LÉPÉS:** Olvasd el ezt a fájlt, majd kezdd a P1-del (shell
> script-ek). Ne feledd: a `CLI_COMMAND` már `qwen`-re default (`config.ts:38`),
> a JS spawner-ök (`agent-process.ts`, `agent-worker.ts`) már qwen-aware.

---

## ALAPÁLLAPOT / KULCSFAKTUMOK (ne veszítsd el)

- **`CLI_COMMAND`** = `env['CLI_COMMAND'] ?? 'qwen'` → `src/config.ts:38`. **Már `qwen`!**
- **`CLAUDE_CLI`** = `resolveFromPath(CLI_COMMAND)` (vagy `CLI_COMMAND` fallback)
  - `agent-process.ts:37-41`, `agent-worker.ts:41-45`
- **`isQwen`** = `CLI_COMMAND === 'qwen' || CLAUDE_CLI.endsWith('qwen')`
  - `agent-process.ts:299`, `agent-worker.ts:327`
- **`qwen` CLI elérhető:** `/home/jtoberling/.local/bin/qwen`
- **SDK fallback:** `src/agent.ts:1` import `@anthropic-ai/claude-agent-sdk`;
  `MARVEEN_AGENT_BACKEND=sdk` → rollback (API billing). **NE TÖRLJ!**
- **Qwen-autójóváhagyás flag:** `--yolo`
- **Qwen-local auth flag-ek:** `--auth-type openai --openai-base-url <url> --openai-api-key <key>`

---

## PRIORITÁS 1 — SHELL SCRIPT-EK (claude fix → $CLI_COMMAND)

**Állapot:** ❌ Mind fix `command -v claude`-al, qwen-ág nélkül.

### `scripts/watchdog.sh`
```
Sor 115: CLAUDE_BIN="$(command -v claude)"
CÉL:   CLAUDE_BIN="$(command -v "$CLI_COMMAND")"

Sor 136: ...${CLAUDE_BIN} --dangerously-skip-permissions --model '$MODEL' \
         --channels plugin:telegram@claude-plugins-official"
CÉL:   qwen-ág: `--yolo` + `--model` hiánya (qwen local-nál) + channels hiánya
```

### `scripts/channel-watchdog.sh`
```
Sor 46:  CLAUDE="$(command -v claude)"
CÉL:   CLAUDE="$(command -v "$CLI_COMMAND")"

Sor 104: RESPAWN_CMD="...$CLAUDE --dangerously-skip-permissions ${MODEL_FLAG} \
            --channels plugin:telegram@claude-plugins-official"
CÉL:   qwen-ág --yolo-val, channels nélkul
```

### `scripts/morning-briefing.sh`
```
Sor 8:   CLAUDE="$(command -v claude)"
CÉL:   CLAUDE="$(command -v "$CLI_COMMAND")"

Sor 24-25: $CLAUDE --dangerously-skip-permissions --channels plugin:...
CÉL:   qwen-ág
```

### `scripts/verify-channels-health.sh`
```
Sor 23-28: CLAUDE_PID pgrep '--channels plugin:' | grep INSTALL_DIR
CÉL:   pgrep "$CLI_COMMAND" vagy --channels hiánya qwen-nál
```

---

## PRIORITÁS 2 — SSH REMOTE (ssh-tmux.ts)

**Állapot:** ⚠️ `isQwen` kiszámolva, de a return szöveg FIX `claude` szót tartalmaz.

### `src/web/ssh-tmux.ts`
```
Sor 154: return `${path} && cd ${shQuote(opts.workdir)} && claude ${cont}${skipFlag}${modelFlag}`
CÉL:   return `${path} && cd ... && ${CLAUDE_CLI} ${cont}${skipFlag}${modelFlag}`
       (CLAUDE_CLI import + CLAUDE_CLI dekláració szük séges)

Sor 158: buildContinueProbeCommand → ~/.claude/projects/ probe
CÉL:   qwen session location (mindig is qwen? akkor a CLAUDE_CLI-al párhuzamosan)
```

---

## PRIORITÁS 3 — PANE DETEKCIÓ (pane-state.ts)

**Állapot:** ⚠️ `YOLO mode` IDLE_FOOTER_RX:50-hoz hozzáadva, de a BUSY/ERROR/MENU regex-ek
**mind Claude-specifikusak.**

**SZABÁLY:** NE TÖRLJ meglévő Claude regex-et! BŐVÍTSD OR-pattern-nel (mindkét CLI).

### `src/pane-state.ts`
```
Sor 78-90  BUSY_INDICATORS:
  Jelen: /(?:Combobulating|Beaming|Thinking|...)\s*\(.*\ds\s*·\s*↓/
  CÉL:   Add Qwen busy label-ek (például a tényleges qwen busy szövegeket —
         ha nem ismert, maradj meg a "generic token/working" fallback, és
         jegyezd fel TODO-val: "Qwen busy label-ek pótolandók").

Sor 101    BUSY_ESC_TO_INTERRUPT_RX = /\besc to interrupt\b/
  CÉL:   /(?:esc to interrupt|<qwen interrupt hint>)\b/

Sor 118    PENDING_Paste_RX = /\[Pasted text\s*#\s*\d/
  CÉL:   /\[(?:Pasted text|<qwen paste stub>)\s*#\s*\d/ (ha különbözik)

Sor 216    ERROR_CHROME_RX = /⎿\s*API Error:\s*\d+/
  CÉL:   Add Qwen error chrome (ha különbözik, TODO: "qwen error chrome")

Sor 290    MENU_NAV_RX = /(?:↑\/↓|↑↓)\s+to\s+(?:navigate|select|choose)/
  CÉL:   Qwen menu nav (TODO: qwen menu strings)

Sor 291    MENU_ESC_RX = /\besc to (?:cancel|exit|close|go back|quit)\b/i
  CÉL:   Qwen menu esc (TODO)

Sor 971    TOOL_CALL_PROGRESS_RX = /(?:✻\s*)?(Worked|Brewed|Baked|Cooking|Simmered|Sauteed|Sauted)...
  CÉL:   Qwen tool-progress (TODO: qwen animáció szövegek)

⚠️ MEGJEGYZÉS: A Qwen valós pane-kimenet nélkül ezek TODO-maradnak.
   Ha van qwen tényleges kimeneted, pótold a label-eket.
```

---

## PRIORITÁS 4 — LIFECYCLE (claude-pid detexció → dinamikus bin)

**Állapot:** ❌ `pgrep -P ... claude` fix.

### `src/channel-coordinator/liveness.ts`
```
Sor 42: const child = execFileSync('/usr/bin/pgrep', ['-P', ..., '-x', 'claude'], ...)
CÉL:   a CLI_COMMAND alapján: `pgrep ... -x "$CLI_COMMAND"` (bash context, JS-contextban
       a CLI_COMMAND importálva)
```

### `src/web/channel-poller-reap.ts`
```
Sor 144-162: "argv[0] basename === 'claude'" logika
CÉL:   dinamikusan a CLI_COMMAND (qwen) → basename check dinamikus
```

---

## PRIORITÁS 5 — AUTH / ENV

**Állapot:** ⚠️ Claude local: `ANTHROPIC_*` env; Qwen local: `--auth-type openai ...` flag.

### `src/web/agent-process.ts`
```
Sor 314: apiKeyEnv = `export ANTHROPIC_API_KEY="${agentApiKey}" && `
         (csak `isClaude && authMode==='api'`)
CÉL:   Qwen api-mode → OpenAI kulcs flag (TODO: qwen api-key útvonal)
```

---

## SZABÁLYOK / KORLÁTAK

1. **NE TÖRLJ** Claude regex-et `pane-state.ts`-ban — OR-pattern-nel bővíts!
2. **NE TÖRLJ** Claude test-fixture-eket.
3. **NE TÖRLJ** SDK fallback (`src/agent.ts`).
4. **Dinamikus bin:** minden `command -v claude` → `command -v "$CLI_COMMAND"`.
5. **qwen-autójóváhagyás:** `--yolo`.
6. **qwen-local auth:** `--auth-type openai --openai-base-url --openai-api-key`.

---

## VALIDÁCIÓ (minden prioritás után)

```bash
# 1. TypeScript tiszta
npx tsc --noEmit

# 2. Unit test-ek (qwen-ágak is)
npx vitest run src/pane-state src/web/ssh-tmux

# 3. Shell script-ek syntax-check
bash -n scripts/watchdog.sh
bash -n scripts/channel-watchdog.sh
bash -n scripts/morning-briefing.sh

# 4. Qwen CLI tényleges elindítása (manuális smoke-test)
```

---

## EGYÉB MEGJEGYZÉSEK / TODO

- **macOS Keychain bridge** (`claude-credentials.ts`, `agent-worker.ts:90-107`):
  Qwen-nek nincs Keychain-útja. TODO: qwen auth alternatíva.
- **`CLAUDE_CONFIG_DIR`** (`agent-config.ts`, `agent-worker.ts`): Claude-specifikus.
  Qwen config dir: TODO.
- **`DEFAULT_MODEL`** (`agent-config.ts:10`): `claude-opus-4-8[1m]` → Qwen model id.
- **Plugin unlock** (`channel-plugin-unlock.ts`, `channels.sh:209-261`): Claude TUI recipe.

---

## KÖVÉSZ LÉPÉS

1. Olvasd el ezt a fájlt.
2. Kezdd a **P1** shell script-ekkel.
3. Egy prioritás mentén haladj, validálj (`tsc` + `vitest`).
4. Minden prioritás után jelöld be itt (❌ → ⚠️ → ✅).
