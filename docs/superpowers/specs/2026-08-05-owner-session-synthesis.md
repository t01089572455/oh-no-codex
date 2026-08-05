# Owner session synthesis → complete prompt-only harness

**Branch intent:** `prompt-only-harness`  
**Sources (full Grok inventory):**  
- Workspace `D:\python_workspace\oh-no-codex` Grok sessions on disk:  
  **only** `019fb706-5e92-7b01-908f-fd31b3e5566b`  
  (verified: folder listing + `session_search.sqlite` `cwd LIKE %oh-no-codex%`)  
- That session’s full `prompt_history` + chat + compaction segments 000–011  
  (compaction = same session history shards, **not** extra sessions)  
- Related field-trial Grok workspace LoveBuddy-v11 session  
  `019fb717-ed6a-72c2-aeef-e462e2498e68` (6 Oh No–related prompts)  
- Full dump: `2026-08-05-all-grok-sessions-inventory.md`  
- Earlier dump: `2026-08-05-owner-session-prompts-extracted.md`  
- `docs/CODEX-SINS.md` + Owner field-trial commentary  

**If you expected more Grok sessions “for this repo”:** Grok binds sessions to  
**cwd**. Only one session was ever opened with cwd = oh-no-codex. Other product  
talk lives in LoveBuddy / other cwd sessions (mined when they mention Oh No).

**Product rule for this branch:** do **not** add coding hard-gates.  
Hooks/harness only **inject** `OHNO_PROMPT_RAILS` so Codex self-restricts by reading Truth.

---

## 1. Problems Owner named (condensed)

| Theme | Owner complaint (essence) |
| --- | --- |
| Drift | Long context forgets latest goal; freestyle without Truth |
| Premature code | Codes before requirements clear |
| Scope expand | Builds frames/systems instead of user function |
| Fake done | Local green / agent prose as complete |
| Soft tests | Black-box says “go read playbook” then Agent asks Owner |
| Block-to-Owner | On FAIL, stops and asks instead of reading Truth and auto-fix |
| CLI museum | Too many parameters, caps, confirmations; Owner fatigued |
| Not auto | Plan accepted but Agent does not self-drive seals/verify/repair |
| Useless Truth | Truth/REQUIREMENTS exist but not forced open |
| Governance bloat | Fear of becoming VibeTether R3 OS |
| Sins incomplete | Eighteen sins not fully constrained in practice |
| Change | Need re-walk clarify→design→plan→tests when requirements change |

---

## 2. Solutions Owner authorized (condensed)

1. **Human surface ≈ cut** — setup once, talk; internals automatic.  
2. **Codex as PM first** — clarify demand; tech/arch self-decides.  
3. **All Owner prompts = raw Truth; latest wins.**  
4. **Design + full route OK** once, then split tasks with full detail.  
5. **Oh No’s job = force READ Truth** before decide (not semantic court).  
6. **FAIL → read Truth → A implement vs B plan/design → auto-adjust.**  
7. **Never default-block Owner** when docs answer.  
8. **Done = real verify + user-visible function.**  
9. **CHANGE → full re-walk under harness.**  
10. **Eighteen sins as prompt rails**, not 18 subsystems.  
11. **Prompt-only branch:** no new coding denies; inject law via hooks.  
12. **Stay light:** no DB/daemon/gateway/plan-count caps/param tax.

---

## 3. Injection map (implementation)

| Surface | Payload |
| --- | --- |
| UserPromptSubmit | full `OHNO_PROMPT_RAILS` + live `OHNO_PIPELINE` |
| Stop continue | same (via pipeline block) |
| `ohno pipeline` / bare `ohno` | full rails after phase next |
| SessionStart / resume | `OHNO_PROMPT_RAILS_STAMP` (≤4KiB) |
| PreToolUse | `OHNO_PROMPT_ADVISORY` only (no deny) |
| skill `oh-no-control` | short mirror of law |

Canonical text: `src/prompt-rails.ts`.

---

## 4. Honesty

Prompt-only means: model can still ignore text.  
Success criterion: repeated injection of Owner-complete law + force-read algorithm.  
Not claimed: OS enforcement or semantic understanding.
