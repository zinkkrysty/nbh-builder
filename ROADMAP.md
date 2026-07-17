# NaboCity — North-Star Roadmap

## Product Direction

> **Build a small place where people know one another, help shape their surroundings, and create stories the player wants to remember.**

NaboCity is a cozy neighborhood-building game, not a conventional city-management game at a smaller scale. The player is a caretaker, designer, and participant in a community. Progress comes from knowing residents, creating expressive places, strengthening relationships, completing shared projects, and building a history—not from maximizing population, density, traffic throughput, or tax revenue.

This roadmap is intentionally narrow. Work that does not yet make the neighborhood more **personal, expressive, connected, or memorable** is deferred, even when it would improve simulation realism or visual variety.

## Roadmap Rules

A roadmap item must support at least two of the project’s design principles:

1. Help the player know a resident.
2. Help the player express themselves.
3. Create a visible neighborhood moment.
4. Make an existing place more meaningful.
5. Create a story worth remembering.
6. Support multiple valid play styles.
7. Create delight without demanding optimization.

Additional rules:

- **Depth before breadth:** deepen a few residents and places before adding more building categories.
- **Visible outcomes:** important systems must produce behavior or changes the player can see in the world.
- **Persistent meaning:** residents, relationships, projects, names, and memories must survive save/load.
- **Gentle friction:** needs create invitations to care, not failure spirals.
- **Small is successful:** expansion and density are optional, not the main measure of progress.
- **Atmosphere follows interaction:** weather, seasons, services, and transport features return only when they support resident stories and activities.

---

## Existing Foundation

The following completed systems are foundations for the new direction rather than goals by themselves:

- [x] Low-poly 3D world, orthographic camera, procedural assets, and performant grid rendering.
- [x] Roads, zoning, utilities, economy, growth, and save/load simulation.
- [x] Day/night lighting, warm emissive windows, shadows, and procedural lofi soundscape.
- [x] Traffic, pedestrians, sidewalks, crosswalks, parks, and boardwalk paths.
- [x] Water, bridges, waterfront boardwalks, docks, and associated props.
- [x] Citizen profiles and home/work associations.
- [x] Topography, hills, terrain sculpting, and elevation-aware movement.

These systems may be simplified, reframed, or replaced where they conflict with the north star. Existing implementation is not a reason to preserve the old city-builder loop.

---

# Current Priority: The First Five Neighbors

The next milestone is a complete emotional vertical slice. It must answer one question:

> **Is it satisfying to know a few residents, create a place for them, and watch that place become part of their lives?**

The target experience:

1. The player prepares a home for an arriving household.
2. The household arrives and remains persistent.
3. The player learns their names, preferences, routine, and current hope.
4. A resident asks for a small shared place, such as a garden or picnic spot.
5. The player shapes and decorates that place.
6. Residents visit it, meet one another, and perform a visible activity.
7. The completed moment becomes a persistent neighborhood memory.
8. That story helps attract or introduce the next household.

Do not expand the feature set until this loop is coherent, legible, and enjoyable.

## Milestone 2.0 — Persistent Households

Turn citizens from temporary population visualizations into people the player can know.

- [ ] Introduce stable IDs and serializable state for citizens and households.
- [ ] Assign each developed home one persistent household.
- [ ] Store household members, home, workplace, preferences, current hope, relationships, and memories.
- [ ] Preserve residents and household state across save/load.
- [ ] Reconcile citizen state safely when a home or workplace changes.
- [ ] Add direct citizen selection in the 3D world.
- [ ] Replace the tile-first residential inspector with a household-first view.
- [ ] Show a concise resident profile: name, portrait/model, home, occupation, preferences, routine, and current hope.
- [ ] Give residents deterministic enough schedules that the player can recognize their habits.

### Done when

The player can follow a named resident through a normal day, inspect where they live and go, save the game, reload it, and continue following the same person.

## Milestone 2.1 — Meaningful Destinations and Routines

Make existing places part of residents’ lives instead of decorative happiness modifiers.

- [ ] Replace random walks with destination-based routes to home, work, parks, and boardwalks.
- [ ] Define simple activities for each supported place: work, stroll, sit, picnic, garden, read, shop, or watch the water.
- [ ] Give activities visible staging, duration, and resident state.
- [ ] Let preferences influence destination and activity choices.
- [ ] Surface resident intent in the inspector, such as “Walking to Harbor Park to read.”
- [ ] Ensure routines favor readable, recurring behavior over maximal simulation complexity.

### Done when

The player can understand why a resident is traveling somewhere and can watch them perform an activity that reflects who they are.

## Milestone 2.2 — Household Invitations and Named Homes

Replace anonymous residential growth with intentional arrivals.

- [ ] Introduce a small household application or invitation panel.
- [ ] Present meaningful, non-optimal choices between prospective households.
- [ ] Show each household’s members, personality, preferences, and reason for moving.
- [ ] Let the player prepare or select a home before inviting a household.
- [ ] Name homes and preserve their history.
- [ ] Add a short visible arrival and welcome moment.
- [ ] Decouple successful progression from residential demand and automatic density upgrades.
- [ ] Remove RCI demand from the primary player guidance once invitations can replace it.

### Done when

A new resident arrives because the player chose to welcome them, not because a demand bar filled.

## Milestone 2.3 — Hopes, Requests, and Gentle Needs

Turn resident needs into personal invitations to shape the neighborhood.

- [ ] Give households one legible current hope at a time.
- [ ] Generate requests from personality, routine, relationships, and nearby places.
- [ ] Start with a small authored request set rather than a broad procedural quest generator.
- [ ] Support requests such as creating a quiet bench, shared garden, picnic place, scenic path, or welcoming storefront.
- [ ] Make ignored requests wait or change rather than punish the player.
- [ ] Replace opaque happiness optimization with a small set of understandable qualities where needed: belonging, comfort, purpose, nature, and delight.
- [ ] Show why a place or resident feels the way they do using plain language.

### Done when

A player can receive a personal request, understand why it matters to that resident, and satisfy it through a visible change to the neighborhood.

## Milestone 2.4 — Place-Making and Personal Expression

Give players enough authorship to make requested places feel personal.

- [ ] Add a focused first set of place details: benches, picnic tables, planters, lamps, flowerbeds, fences, and signs.
- [ ] Separate functional placement from decorative placement where practical.
- [ ] Support simple rotation and placement previews for details.
- [ ] Add a small set of home color or exterior variants.
- [ ] Let residents add one or two personality-driven details to their own homes over time.
- [ ] Preserve placed details and resident customizations across save/load.
- [ ] Favor a polished, combinable set over a large catalog of isolated props.

### Done when

Two players can fulfill the same request in visibly different ways, and both outcomes feel valid.

## Milestone 2.5 — Relationships and Shared Moments

Make neighbors recognize and seek out one another.

- [ ] Add persistent familiarity and friendship between residents.
- [ ] Increase familiarity through repeated meetings and shared activities.
- [ ] Let relationships influence destination and activity choices.
- [ ] Add visible greetings and one shared two-person activity.
- [ ] Create the first small gathering, such as a picnic or garden meetup.
- [ ] Show important relationships in resident and household inspectors.
- [ ] Avoid complex dialogue or social simulation until simple interactions are readable and charming.

### Done when

The player can explain how two residents met, see that relationship in the interface, and watch it alter their behavior.

## Milestone 2.6 — Memories and Neighborhood History

Make completed moments persist emotionally as well as technically.

- [ ] Record a small set of meaningful events: arrival, request completion, first friendship, project opening, and gathering.
- [ ] Attach memories to relevant residents, households, and places.
- [ ] Add a simple neighborhood scrapbook or timeline.
- [ ] Include names, dates, participants, location, and a short description.
- [ ] Let the player rename important homes and shared places.
- [ ] Preserve the timeline across save/load and migrations.
- [ ] Use past events to influence occasional future requests or activity text.

### Done when

The player can open the scrapbook and retell how their first few households and shared places became a neighborhood.

---

# After the Vertical Slice

These phases begin only after “The First Five Neighbors” validates the north star.

## Phase 3 — Named Local Businesses and Crafts

Replace anonymous commercial and industrial growth with resident-owned places.

- [ ] Establish named businesses such as a bakery, café, florist, bookshop, grocer, or repair workshop.
- [ ] Connect owners and workers to real resident profiles.
- [ ] Give each business visible resident activities and opening rhythms.
- [ ] Reframe industrial zoning as neighborhood-scale crafts and production: carpenter, potter, orchard, greenhouse, or boat workshop.
- [ ] Add a few gentle, visible connections such as garden produce supplying a bakery or market.
- [ ] Measure success through usefulness, character, and relationships rather than throughput optimization.

## Phase 4 — Community Projects

Let residents and the player permanently transform shared places together.

- [ ] Add a neighborhood request board for larger shared proposals.
- [ ] Create authored multi-step projects, beginning with one restoration project.
- [ ] Show resident contributions of time, funds, or materials.
- [ ] Let the player make aesthetic and functional choices during a project.
- [ ] Celebrate project completion with an opening event.
- [ ] Record each project in the neighborhood history.

## Phase 5 — Neighborhood Character

Let identity emerge from accumulated choices rather than a selected class or score target.

- [ ] Track traits such as garden village, artistic waterfront, crafting community, or market street.
- [ ] Derive character from residents, places, decorations, activities, and projects.
- [ ] Unlock fitting households, activities, visual details, and projects.
- [ ] Allow mixed identities and avoid a single optimal progression path.
- [ ] Make neighborhood character visible in the world, not only in a meter.

## Phase 6 — Seasons and Traditions

Use time to deepen routines, relationships, and memory.

- [ ] Add seasonal visual transitions only alongside seasonal resident activities.
- [ ] Create a small neighborhood calendar.
- [ ] Let successful gatherings become recurring traditions.
- [ ] Add seasonal projects, decorations, and requests.
- [ ] Record anniversaries and recurring events in neighborhood history.
- [ ] Ensure seasons create rhythm and anticipation rather than deadlines or resource penalties.

---

# Explicitly Deferred

The following work is not a current priority because it does not directly prove the north star:

- Advanced traffic rules, traffic lights, yielding, congestion, and throughput simulation.
- Large-scale public-service coverage and hazard-prevention systems.
- Fire, disease, crime, or disaster failure loops.
- High-density city growth and skyscraper progression.
- Deeper tax-rate, maintenance, or municipal budget optimization.
- Realistic industrial logistics and production throughput.
- Utility simulation expansion beyond what existing neighborhood-building requires.
- Weather implemented only as a visual effect or numerical modifier.
- Forestry management implemented primarily as a resource economy.
- Additional landmarks that function only as expensive happiness bonuses.
- More procedural asset breadth without resident interaction or place-making value.

Deferred does not mean rejected. A feature can return when it has a clear neighborhood-scale purpose—for example, rain that causes residents to gather in a café, a library that creates a reading club, or a street closure that hosts a block party.

---

## Immediate Implementation Order

1. Define serializable `ResidentState` and `HouseholdState` domain models.
2. Migrate spawning so developed homes own persistent households.
3. Save and load those entities safely.
4. Add direct resident selection and a household-first inspector.
5. Add deterministic home/park/boardwalk routines with visible intent.
6. Author one household hope and one shared-place request.
7. Add the minimum decoration set needed to fulfill that request expressively.
8. Add one shared activity between two residents.
9. Record its completion as the first scrapbook memory.

Until these steps form a satisfying loop, new systems should not broaden the simulation.