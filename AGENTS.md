# Architecture rules

- WorldProvider wraps GameProvider; battle data and operations use the active world to prevent mixing campaigns.
- Confirmed battle attacks, healing and HP corrections use battle_apply_action; transactional receipts prevent replay and preserve existing damage/XP formulas.
- Battle controls live under components/battle, with shared numeric validation in lib/battle, so presentation stays separate from persisted game rules.