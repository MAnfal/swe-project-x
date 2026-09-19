---
id: bibles/swe/testing
description: Testing patterns that hand-written fixtures miss — test transforms against real generated output
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Testing — Patterns and Anti-Patterns

## Test third-party dependency output against real generated files

When writing tests for code that walks or transforms a third-party dependency's generated output (brace matchers, AST-lite walkers, CSS parsers), test against that dependency's **real full output** — both pretty-printed and minified — including nested at-rules (`@supports`, `@media`, `@layer`, `@container`).

**Why hand-rolled flat fixtures fail**: flat fixtures only exercise the simple case. Real dependency output contains nested conditional blocks that a flat matcher desynchronizes on, leaking inner rules as top-level unscoped output.

**Pattern**:
```ts
// Run the real generator and capture its output, then test your transformer against it
import { generate } from '@unocss/preset-wind4';
const realOutput = generate(['...classes...']);
// Test your transformer against realOutput — NOT a hand-rolled flat fixture
const scoped = scopePreflight(realOutput.css);
expect(scoped).toMatchSnapshot();
```

**Rule**: for any transform that walks generated CSS/HTML/JS output, add a fixture that is the REAL generator output, not a hand-crafted approximation. If the real output changes across versions, the test will catch the drift.

Failure mode observed: `scopeBasePreflight` used a flat `indexOf('}')` brace matcher on UnoCSS's base preflight reset. The wind4 preset's real reset contains `@supports{::placeholder{...}}` followed by `textarea{resize:vertical}`. The flat matcher prelude-prefixed the `@supports` block (invalid — rule dropped) and desynced, leaking `textarea` as a top-level unscoped rule. Unit fixtures were flat-rule only and missed the at-rule nesting entirely. Fixed with a depth-tracked, comment/string-aware brace matcher — verified against the real installed preset, not a hand-rolled fixture.


## Assert the resolved value, not the input

When a test asserts configuration, assert the value the **consumer actually receives** — not the object the caller handed in. A config assertion that reads back your own input proves the literal was typed correctly and nothing else.

Two forms of the same error:

```ts
// WRONG — reads back the input literal; proves nothing about resolution
const config = buildConfig({ timeout: 5000 });
expect(config.timeout).toBe(5000);

// CORRECT — assert what a real consumer sees at the boundary it uses
const resolved = resolveConfig(config);
expect(resolved.effectiveTimeout).toBe(5000);
```

The distinction matters when the config goes through a merge, override, or default-fill step between construction and use. A test that passes the literal to the builder and reads the same literal back has never exercised that step and gives false confidence that the configuration is correct.

A related shape: testing that a mock was called with the right argument proves the call was made, not that the system under test behaves correctly when the real dependency returns a different value. Assert on the observable output of the behavior, not the inputs to the mock.
