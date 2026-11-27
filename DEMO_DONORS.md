# Demo donor accounts

The local Docker Compose setup creates eight sample donor accounts when the backend starts: one for each blood group, all listed in Roorkee. The seed is idempotent and updates the city on existing demo accounts.

All accounts use this password:

```text
OpenVeinDemo2026!
```

| Email | Blood group | City |
| --- | --- | --- |
| `asha.demo@example.test` | O+ | Roorkee |
| `naveen.demo@example.test` | B+ | Roorkee |
| `tara.demo@example.test` | A+ | Roorkee |
| `kabir.demo@example.test` | O- | Roorkee |
| `leela.demo@example.test` | A- | Roorkee |
| `isha.demo@example.test` | AB+ | Roorkee |
| `rohan.demo@example.test` | AB- | Roorkee |
| `amit.demo@example.test` | B- | Roorkee |

These are fictional accounts for local demonstrations. They are not real donors. The backend seeds them at startup by default. Set `SEED_DEMO_DONORS=false` in shared or production deployments to disable demo accounts.
