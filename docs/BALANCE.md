# Balance notes

Tunables live primarily in `src/core/constants.ts` and `src/systems/difficulty.ts`.

| Lever | Story | Normal | Overdrive |
| --- | --- | --- | --- |
| Hunter speed | 0.78× | 1× | 1.22× |
| Catch radius | 0.88× | 1× | 1.08× |
| Heat gain | 0.75× | 1× | 1.28× |
| Heat decay | 1.35× | 1× | 0.72× |
| Resonance gain | 1.2× | 1× | 0.9× |
| Extra hunters | 0 | 0 | +1 |

Mission curve (`campaign.ts`): size, hunters, hazards, wells, and special walls scale with level 1–33. Sound-eater hunters appear from mission 18+.

Hide niches (`h`) damp footsteps and skip catch while heat &lt; 0.22 or Shift held. Key pickup relocates respawn checkpoint.
