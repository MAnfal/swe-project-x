---
id: bibles/swe/patterns/orchestrator-pattern
description: Thin orchestrators — sequencing, wiring and logging only, with domain logic in the steps
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Orchestrator Pattern

Rules for writing thin orchestrators (pipeline controllers, workflow coordinators).

## Core rule: orchestrators don't contain domain logic

An orchestrator does exactly three things:

1. **Step sequencing** — call services in the right order
2. **I/O wiring** — pass one step's output as the next step's input
3. **Logging** — trace progress through the pipeline

If a method has loops, conditionals on business rules, or direct DB/API calls beyond wiring, it's **domain logic** — move it to a service.

```typescript
// BAD — orchestrator contains domain logic
async buildSite(input: BuildInput): Promise<Site> {
  const users = await this.db.users.find({ active: true });  // DB call = domain logic
  const filtered = users.filter(u => u.tier === 'premium');   // business rule = domain logic
  // ...
}

// GOOD — orchestrator wires services
async buildSite(input: BuildInput): Promise<Site> {
  const users = await this.userService.findPremiumUsers();
  const profile = await this.profileService.generate(users);
  const site = await this.assemblyService.assemble(profile);
  return site;
}
```

## The domain logic test

Ask: "If the business rule changes, would I edit the orchestrator?"

- **Yes** → that logic belongs in a service, not here
- **No** → it's wiring, it belongs in the orchestrator

## Console log pattern

Log each pipeline step with a consistent prefix for traceability:

```typescript
async execute(input: PipelineInput): Promise<PipelineOutput> {
  console.log(`[Pipeline] Step 1: Extracting insights`);
  const insights = await this.extractionService.extract(input);

  console.log(`[Pipeline] Step 2: Generating profile`);
  const profile = await this.profileService.generate(insights);

  console.log(`[Pipeline] Step 3: Assembling output`);
  const result = await this.assemblyService.assemble(profile);

  console.log(`[Pipeline] Complete`);
  return result;
}
```

Use a consistent tag (e.g., `[Pipeline]`, `[BuildSite]`) so logs can be filtered.

## Fire-and-forget pattern

For side effects that shouldn't block the pipeline (analytics, notifications, cache warming):

```typescript
async execute(input: PipelineInput): Promise<PipelineOutput> {
  const result = await this.coreService.process(input);

  // Fire-and-forget — don't await
  this.analyticsService.track(result).catch(err =>
    console.error(`[Pipeline] Analytics failed (non-blocking):`, err),
  );

  return result;
}
```

**Rules for fire-and-forget**:

- Always add `.catch()` to prevent unhandled rejection
- Log failures but don't throw — the main pipeline must not fail for a side effect
- **Place a structured JSDoc contract ABOVE the IIFE** covering: (1) why this work is intentionally detached, (2) failure behavior, (3) manual recovery steps, and (4) the monitoring signal (log pattern). The architecture-reviewer gate rejects both a bare void IIFE and one whose contract lives only inside the catch handler — the docblock must be on the IIFE itself.

```typescript
/**
 * Fire-and-forget: <reason this must not block the response>.
 * Failure: logs to <logger>, drops the work silently — caller is not notified.
 * Recovery: re-trigger via <manual path> if the operation is critical.
 * Monitoring: grep logs for "[<module>] <operation> failed".
 */
void (async () => {
  await this.sideEffect().catch(err =>
    this.logger.error(`[Module] operation failed (non-blocking):`, err),
  );
})();
```

Evidence: two CI round-trips on a fire-and-forget IIFE — first adding the `.catch` with only an inline comment (still flagged by architecture-reviewer), then moving the contract into a JSDoc above the IIFE (passed).

## Parallel execution

When steps are independent, run them in parallel:

```typescript
async execute(input: PipelineInput): Promise<PipelineOutput> {
  console.log(`[Pipeline] Step 1: Parallel resource selection`);
  const [palette, font, skeleton] = await Promise.all([
    this.resourceService.selectPalette(input.classification),
    this.resourceService.selectFont(input.classification),
    this.resourceService.selectSkeleton(input.classification),
  ]);

  console.log(`[Pipeline] Step 2: Assembly`);
  return this.assemblyService.assemble({ palette, font, skeleton });
}
```

Only parallelize steps that have no data dependency on each other.
