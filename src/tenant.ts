import { Effect, FiberRef } from "effect";

/** The id of the user who owns the current request's data. Set per-request by the auth gate
 *  (Effect.locally) and read by the Repo to scope every query to that user. null = no user in
 *  scope (the system/ticker path, which uses its own un-scoped queries).
 *
 *  A FiberRef (not an Effect Context service) on purpose: Better Auth resolves the session OUTSIDE
 *  the Effect context, so threading the user through a Context.Tag would force a conditional
 *  provision the type system fights. A FiberRef stays fiber-local with no effect on the R type. */
export const currentUserId = FiberRef.unsafeMake<string | null>(null);

/** Read the owning user id, dying if unset — a programming error, since every Repo user-method
 *  runs behind the auth gate that sets it. */
export const requireUserId: Effect.Effect<string> = FiberRef.get(currentUserId).pipe(
  Effect.flatMap((id) => (id ? Effect.succeed(id) : Effect.dieMessage("Repo accessed with no current user in scope"))),
);

/** Run `effect` with the current user pinned (used by the gate, and to carry scope into the AI's
 *  detached tool runs which start fresh fibers that don't inherit the request's FiberRef). */
export const withUser = <A, E, R>(userId: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.locally(effect, currentUserId, userId);
