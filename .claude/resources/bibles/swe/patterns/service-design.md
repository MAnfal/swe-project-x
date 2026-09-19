---
id: bibles/swe/patterns/service-design
description: Interface-first service design — contracts, substitutability, and what a method returns
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Service Design

Patterns for designing a service or module with a public API. The examples are TypeScript;
the rules are not language-specific.

## Interface-first (mandatory for shared services)

Every shared service MUST define an interface in `contracts/` and implement it explicitly. This enforces:

- **Compile-time contracts** — the interface defines the API, the class implements it. Methods can't drift.
- **Substitutability** — swap implementations without changing consumers.
- **Typed methods** — callers get proper return types, not `<T>` generics.

```typescript
// contracts/user-repository.interface.ts — the contract
export interface IUserRepository {
  findById(id: string): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

// services/user-repository.service.ts — the implementation
@Injectable()
export class UserRepositoryService implements IUserRepository {
  async findById(id: string): Promise<User> { ... }
  async findByEmail(email: string): Promise<User | null> { ... }
  async save(user: User): Promise<User> { ... }
}
```

### NestJS provider registration

Register the interface token so consumers inject the abstraction, not the implementation:

```typescript
// module.ts
@Module({
  providers: [
    { provide: 'IUserRepository', useClass: UserRepositoryService },
  ],
})

// consumer.ts
constructor(@Inject('IUserRepository') private readonly userRepo: IUserRepository) {}
```

## Fully hydrated returns

A typed method returns everything the caller needs — no follow-up calls.

```typescript
// BAD — partial entity, consumer does a second query
const ref = await this.repo.find<{ id: string }>('orders', orderId);
const order = await this.db.orders.findWithItems(ref.id); // domain logic leak!

// GOOD — fully hydrated, one call
const order = await this.repo.findOrderWithItems(orderId);
// order.items is already populated
```

**Why**: Partial returns leak data-fetching concerns into the caller and make it impossible to swap implementations cleanly.

## Parameter consistency

Related methods should follow the same parameter pattern:

```typescript
interface IResourceSelector {
  selectPalette(
    classification: Classification,
    filters?: Filters
  ): Promise<Palette>;
  selectFont(classification: Classification, filters?: Filters): Promise<Font>;
  selectSkeleton(
    classification: Classification,
    filters?: Filters
  ): Promise<Skeleton>;
}
```

Consistent ordering makes the API predictable. Methods that need extra context add params before the shared ones:

```typescript
selectItemsForOrder(order: Order, classification: Classification, filters?: Filters): Promise<Item[]>
```

## Substitutability

Design services so implementations can be swapped without touching consumers:

- Define the interface in `contracts/` — separate from the implementation
- Consumers depend on the interface, never the concrete class
- Swap by changing the module provider, not the consumer code

```typescript
// Swap from TagBased to RAG — only the module changes
{ provide: 'IResourceSelector', useClass: RagResourceSelector }
```

## Scope decisions

| Scope               | When to use                                        |
| ------------------- | -------------------------------------------------- |
| **Module-internal** | Used by exactly one module — implementation detail |
| **Module service**  | Used by 2+ components within the same module       |
| **Common service**  | Cross-module infrastructure (DB, AI, tracing)      |

**When unsure**: start with the narrowest scope. Promote to a wider scope when a second consumer needs it.
