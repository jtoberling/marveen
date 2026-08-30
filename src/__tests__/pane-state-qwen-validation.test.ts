import { describe, it, expect } from 'vitest'
import { detectPaneState, isReadyForPrompt, shouldRetrySubmit, decidePaneErrorAlert } from '../pane-state.js'

// Qwen pane-state validation fixtures.
//
// Every fixture is a hand-rolled model of what the REAL Qwen Code TUI renders
// inside a tmux pane (session width 80, per useTerminalSize.ts `|| 80` default
// in packages/cli/src/ui/hooks/useTerminalSize.ts:13-19), derived from the
// shipping source at /usr/src/qwen-code — NOT from any ~/.qwen session-log.
//
// Source-of-truth strings (file:line-anchored):
//   - Idle prompt line: InputPrompt.tsx:2324-2353 / BaseTextInput.tsx:294
//       prefix `>` (DEFAULT) or `* ` (YOLO), placeholder `Type your message`
//   - Idle footer hint: Footer.tsx:146-163 / en.js:289 — `? for shortcuts`
//   - Approval pill: AutoAcceptIndicator.tsx:26-50 — `YOLO mode` / `⏸ Ask permissions`
//   - Busy footer: Footer.tsx:140-145 / en.js:1820 — `Enter to steer · Ctrl+Q to queue`
//   - Busy spinner frames: RespondingSpinner.tsx:21-34 — tmux renders `. ` / `..`
//   - Token counter: ContextUsageDisplay.tsx:42 — `{pct}% context used`
//   - Permission prompt: ConsentPrompt.tsx (round-border, Yes/No) / en.js
//       `Y/Enter to confirm · N/Esc to cancel`
//   - Menu nav hint: PluginChoicePrompt.tsx:186 — `Use ↑↓ or j/k to navigate, Enter to select, Escape to cancel`
//   - Error chrome: StatusMessages.tsx:79-94 — `✕` glyph
//
// The `──` separator (U+2500, 80 wide) frames the live input box exactly like
// the Claude fixtures in pane-state.test.ts. SEP must be the same character.

const SEP = '─'.repeat(80)

// ---------------------------------------------------------------------------
// 1. IDLE — Qwen renders the idle prompt line with a leading prompt glyph and
//    the inline placeholder, plus the `? for shortcuts` footer hint.
// ---------------------------------------------------------------------------
const QWEN_IDLE_PLACEHOLDER = [
  '',
  SEP,
  '❯ ',
  SEP,
  '  ? for shortcuts',
].join('\n')

// YOLO approval mode: the input prefix is `* ` (approvalModeVisuals.ts) and the
// idle footer shows the approval-mode pill `YOLO mode` (AutoAcceptIndicator.tsx).
const QWEN_IDLE_YOLO = [
  '',
  SEP,
  '❯ ',
  SEP,
  '  YOLO mode',
].join('\n')

// Idle with the approval pill `Ask permissions` (DEFAULT approval mode, the
// `⏸ Ask permissions` AutoAcceptIndicator rendered in the footer).
const QWEN_IDLE_askpermissions = [
  '',
  SEP,
  '❯ ',
  SEP,
  '  ⏸ Ask permissions',
].join('\n')

// ---------------------------------------------------------------------------
// 2. BUSY — Qwen busy state. Two independent load-bearing signals, both of
//    which must classify the pane as busy:
//    (a) the `{pct}% context used` token counter, and
//    (b) the busy footer hint `Enter to steer · Ctrl+Q to queue`.
//    The tmux spinner renders a static `. ` / `..` frame (RespondingSpinner.tsx).
// ---------------------------------------------------------------------------
const QWEN_BUSY_TOKEN = [
  '  37% context used',
  '',
  SEP,
  '❯ ',
  SEP,
  '  ? for shortcuts',
].join('\n')

const QWEN_BUSY_ENTER_TO_STEER = [
  '',
  SEP,
  '❯ ',
  SEP,
  '  Enter to steer · Ctrl+Q to queue',
].join('\n')

// Both signals together (the typical live-turn render: spinner frame on its
// own line, token counter, then the busy footer).
const QWEN_BUSY_FULL = [
  '. ',
  '  37% context used',
  '',
  SEP,
  '❯ ',
  SEP,
  '  Enter to steer · Ctrl+Q to queue',
].join('\n')

// A busy turn where the model is actively choosing the next action verb.
// Qwen's busy label (`Working`, `Processing`, ...) appears alongside the
// `{pct}% context used` token counter.
const QWEN_BUSY_LABEL = [
  '  Working… (37% context used)',
  '',
  SEP,
  '❯ ',
  SEP,
  '  ? for shortcuts',
].join('\n')

// ---------------------------------------------------------------------------
// 3. PERMISSION — a live ConsentPrompt dialog overlays the input box with a
//    round-border Yes/No prompt and the hint `Y/Enter to confirm · N/Esc to cancel`.
//    While pending it is NOT idle (waiting for confirmation) and NOT busy
//    (no spinner / token counter / steer hint) — the scheduler must not inject,
//    so this is not a ready-for-prompt surface. We assert it is not 'idle'.
// ---------------------------------------------------------------------------
const QWEN_PERMISSION = [
  '  Allow execution of: `rm -rf /tmp/foo` ?',
  '',
  '    [ Yes ]   [ No ]',
  '  Y/Enter to confirm · N/Esc to cancel',
  '',
  SEP,
  '❯ ',
  SEP,
].join('\n')

// ---------------------------------------------------------------------------
// 4. MENU — a plugin-selection modal with the navigation hint
//    `Use ↑↓ or j/k to navigate, Enter to select, Escape to cancel`. Parked in
//    a modal is not idle and not busy; the scheduler must skip it. Not 'idle'.
// ---------------------------------------------------------------------------
const QWEN_MENU = [
  '  Select a plugin from "claude-plugins-official"',
  '',
  '    ❯ telegram',
  '       slack',
  '       discord',
  '  Use ↑↓ or j/k to navigate, Enter to select, Escape to cancel',
].join('\n')

// ---------------------------------------------------------------------------
// 5. NOT-QWEN (false-positive guard) — a plain shell must stay 'unknown',
//    proving the Qwen idle markers below are real (not every pane is idle).
// ---------------------------------------------------------------------------
const NON_QWEN = [
  'user@host marveen $ npm test',
  '  PASS  src/pane-state.test.ts',
].join('\n')

describe('Qwen pane-state detection (real TUI renderers from /usr/src/qwen-code)', () => {
  it('classifies the Qwen idle prompt + placeholder + `? for shortcuts` footer as idle', () => {
    expect(detectPaneState(QWEN_IDLE_PLACEHOLDER)).toBe('idle')
  })

  it('classifies the Qwen YOLO idle pane (approval pill `YOLO mode`) as idle', () => {
    expect(detectPaneState(QWEN_IDLE_YOLO)).toBe('idle')
  })

  it('classifies the Qwen DEFAULT approval pane (`⏸ Ask permissions`) as idle', () => {
    expect(detectPaneState(QWEN_IDLE_askpermissions)).toBe('idle')
  })

  it('isReadyForPrompt:true on every Qwen idle surface', () => {
    expect(isReadyForPrompt(QWEN_IDLE_PLACEHOLDER)).toBe(true)
    expect(isReadyForPrompt(QWEN_IDLE_YOLO)).toBe(true)
    expect(isReadyForPrompt(QWEN_IDLE_askpermissions)).toBe(true)
  })

  it('classifies the Qwen `{pct}% context used` token counter as busy', () => {
    expect(detectPaneState(QWEN_BUSY_TOKEN)).toBe('busy')
  })

  it('classifies the Qwen busy footer `Enter to steer` as busy', () => {
    expect(detectPaneState(QWEN_BUSY_ENTER_TO_STEER)).toBe('busy')
  })

  it('classifies the combined Qwen busy render (spinner frame + token + steer footer) as busy', () => {
    expect(detectPaneState(QWEN_BUSY_FULL)).toBe('busy')
  })

  it('classifies the Qwen busy label (`Working…`) + token counter as busy', () => {
    expect(detectPaneState(QWEN_BUSY_LABEL)).toBe('busy')
  })

  it('does NOT treat a Qwen permission prompt as ready-for-prompt', () => {
    // Pending permission = waiting for confirmation, not idle. Injection must stop.
    expect(isReadyForPrompt(QWEN_PERMISSION)).toBe(false)
    expect(detectPaneState(QWEN_PERMISSION)).not.toBe('idle')
  })

  it('does NOT treat a Qwen menu/modal as ready-for-prompt', () => {
    expect(isReadyForPrompt(QWEN_MENU)).toBe(false)
    expect(detectPaneState(QWEN_MENU)).not.toBe('idle')
  })

  it('leaves a non-Qwen shell as unknown (Qwen idle markers are real, not universal)', () => {
    expect(detectPaneState(NON_QWEN)).toBe('unknown')
  })
})

describe('Qwen post-send stuck-send detection', () => {
  it('returns false when the Qwen pane is busy (turn in flight)', () => {
    // A busy pane must never be retried — the prompt is being processed.
    expect(shouldRetrySubmit(QWEN_BUSY_FULL, 'deploy the changes')).toBe(false)
  })

  it('returns false when the Qwen pane is in a permission prompt', () => {
    expect(shouldRetrySubmit(QWEN_PERMISSION, 'deploy the changes')).toBe(false)
  })

  it('returns false for a non-Qwen shell pane', () => {
    expect(shouldRetrySubmit(NON_QWEN, 'deploy the changes')).toBe(false)
  })
})
