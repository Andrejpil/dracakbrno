# Architecture rules

- WorldProvider wraps GameProvider; battle data and operations use the active world to prevent mixing campaigns.
- Confirmed battle attacks, healing and HP corrections use battle_apply_action; transactional receipts prevent replay and preserve existing damage/XP formulas.
- Undo uses world-locked server snapshots and retains reversed receipts; reject intervening changes to prevent overwriting HP or statistics.
- Battle controls live under components/battle, with shared numeric validation in lib/battle, so presentation stays separate from persisted game rules.
- Every game-data insert and import explicitly sets the active world, and hero initiative triggers copy the hero world; database defaults must never choose a campaign.
- Battle initiative lists all combatants in one sorted list; separate monster cards expose statistics without opening the editing detail.