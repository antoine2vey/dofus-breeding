# Dragodinde breeding tracker

Tracks a Dofus dragodinde-breeding operation: your herd, the enclos that ripen mounts, and the
deterministic plan to obtain every colour up to a target generation. The pure engine lives in
`@dd/core`; an Effect + SQLite backend persists state and a React frontend drives it.

## Language

**Dragodinde**:
A breedable mount — has a colour, a sex, a repro status, a lineage, and lives in your cheptel.
_Avoid_: mount (loosely used in code for the various projections, but the domain noun is dragodinde), animal, horse.

**Cheptel**:
Your whole herd of dragodindes — every one you own, in any repro status and any location.
_Avoid_: herd, inventory, collection.

**Cheptel accounting**:
The derivation, from your cheptel + succès, of the stock sets (usable supply, owned, sink) and the
breeding plan. The one module (`cheptel.ts`) the recommender and the assistant share.
_Avoid_: stock service, inventory calc.

**Colour**:
A dragodinde race (e.g. _Amande_, _Ebène et Rousse_), one per generation tier in the recipe DAG. A
bicolour is bred from two distinct parent colours; a base colour (Amande/Dorée/Rousse) is captured.
_Avoid_: race (the code field is `race`/`color`, but the domain noun is colour), breed, variant.

**Repro status**:
A dragodinde's three-state reproduction readiness: _stérile_ → _fertile_ → _féconde_. Only a féconde
mount can breed; breeding sterilises both parents (fertility = 1).
_Avoid_: fertility boolean, breedable flag.

**Enclos**:
An enclosure that ripens its occupants toward féconde by burning fuel (endurance/maturité/amour).
Capacity 10.
_Avoid_: pen, paddock, pasture.

**Succès**:
An unlocked in-game achievement for a colour. It satisfies the goal (the "own ≥1" sink) so the planner
stops chasing that colour — but never counts as breeding supply, so a done colour that's a parent of
the target is still produced.
_Avoid_: achievement (English), goal, trophy.

**Usable stock / sink / obtained**:
The three accounting distinctions a cheptel produces. _Usable stock_ = non-stérile, non-keeper mounts
(the breeding supply that covers parent-uses). _Sink_ = "own ≥1 of this colour" (an owned copy OR an
unlocked succès). _Obtained_ = colours you own OR have the succès for (the goal/coverage set).

**Clonage**:
Recycling two same-generation stériles into one refreshed survivor (fertile again, gauges reset); the
other is consumed. No new dragodinde is created.
_Avoid_: clone (verb is fine; the feature is clonage), duplication.

**Plan / Roadmap / Next step**:
_Plan_ = the deterministic bill-of-materials to own every colour ≤ target generation. _Roadmap_ = that
plan grouped by generation with per-colour owned/need progress. _Next step_ = the concrete batch to do
right now (raise / breed / clone / capture).
_Avoid_: schedule, pipeline.

**Keeper**:
A dragodinde marked as a trophy to protect — never bred, never cloned, never counted as breeding supply.
_Avoid_: favourite, pinned, locked.
