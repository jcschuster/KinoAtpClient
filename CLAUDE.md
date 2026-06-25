# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this package is

`kino_atp_client` ships two Livebook Smart Cells that drive [`atp_client`](https://hexdocs.pm/atp_client) — a unified frontend over four automated theorem prover backends: `SystemOnTPTP`, `StarExec`, `Isabelle`, and `LocalExec`. The Elixir side is thin glue around `AtpClient`; almost all of the interesting Elixir work is dispatching the right call to the right backend and reshaping its result. The JS side is a Monaco-backed TPTP editor (`atp_solver`) and a schema-driven configuration form (`backend_config`), each built independently with Vite.

## Common commands

```bash
mix deps.get                          # fetch Hex + git deps (atp_client comes from GitHub)
mix compile
mix format
mix credo --all                       # see .claude/CLAUDE.md: tooling is allowed
mix dialyzer

# Frontend assets — each cell has its own Vite project. After editing JS/CSS in
# assets/<cell>/, rebuild so the compiled bundle in lib/assets/<cell>/ matches.
cd assets/atp_solver     && npm install && npm run build
cd assets/backend_config && npm install && npm run build
# Or `npm run watch` for incremental rebuilds during development.
```

There is no `test/` directory in this repo — exercise the cells end-to-end in a Livebook (see `examples/demo.livemd`).

## Architecture

### Two Smart Cells, four backends

Both cells iterate `AtpClient.backends/0` rather than hard-coding the backend list, so adding a new backend upstream surfaces automatically in the picker and the configuration form. Each backend's UI shape is derived from its `AtpClient.Backend` callbacks:

- `config_key/0` → string key used in the JS-side state map (`"sotptp"`, `"starexec"`, `"isabelle"`, `"local_exec"`).
- `label/0` → display label in the dropdown.
- `config_schema/0` → list of `AtpClient.Config.Field` structs the form renders, grouped by `:group` (Connection / Defaults / Advanced).
- `verify/1` → called by the Verify button so misconfiguration surfaces immediately.

Adding per-cell UI knobs that don't live in `config_schema/0` (e.g. StarExec's "Skip TLS verification") is done via the `@ui_extras` map in `backend_config.ex`; the extra options are merged into both the `verify` call and the generated `Application.put_env/3` source. Use this pattern instead of pushing UI-only flags upstream into `atp_client`.

### Result rendering is per-backend

`AtpSolver.run_backend/1` is one pattern-matched clause per backend; each clause returns a `{:broadcast, event, payload}` tuple that the parent process forwards to the JS side. The JS then picks the right renderer for that event: raw prover output for SystemOnTPTP, a normalized SZS badge for StarExec/LocalExec, a per-lemma table for Isabelle. When adding a backend, add both a `run_backend` clause **and** the matching event handler in `assets/atp_solver/js/`.

### Tasks must be cancellable

Both cells run lint, solve, and verify calls as `Task.async`. Whenever a new task starts, the previous one is killed via `Task.shutdown(:brutal_kill)` (`cancel_task/2`). Stale task replies are silently discarded in `handle_info/2` by checking the task ref against `ctx.assigns[:lint_task | :query_task | :verify_task]`. Preserve this pattern — without it, late results from a superseded prover run will overwrite the current display.

### Isabelle is special

`KinoAtpClient.IsabelleRuntime` is a lazy singleton GenServer that auto-spawns a local `isabelle server`, opens one `HOL` session, loads the bundled `TPTP.thy`, and reuses both across solves. It is started as a permanent child of `KinoAtpClient.Application` but stays *idle* until the first `query_tptp/2` call — no Isabelle process is spawned just by loading the package. The ~30 s `HOL` start-up only happens on the first solve click.

`AtpSolver.isabelle_query/2` dispatches in this order:
1. Remote Isabelle configured (i.e. `:password` set in `Application.get_env(:atp_client, :isabelle)`) → `AtpClient.Isabelle.query_tptp/2`.
2. Local `isabelle` on `PATH` (or `ISABELLE_TOOL` set) → the auto-managed runtime.
3. Neither → defer to `AtpClient.Isabelle.query_tptp/2` so its canonical config error surfaces.

`BackendConfig` has matching special-casing: when the user has entered **no** Isabelle values, Verify probes the local executable instead of trying to log into a non-existent remote server. The banner above the form ("isabelle_notice") changes based on `IsabelleRuntime.available?/0`.

### JS ↔ Elixir bridge

Both cells use `Kino.JS.Live`. The Elixir side declares `assets_path: "lib/assets/<cell>"` — that path is the **Vite build output**, not the source. Source lives in `assets/<cell>/js/` and Vite (`assets/<cell>/vite.config.js`) writes the bundle into `../../lib/assets/<cell>/`. After editing JS, run the `build` script in the corresponding `assets/<cell>/` directory; otherwise the running Livebook will keep serving the old bundle.

State flows: Elixir → JS via `handle_connect/1` (initial payload, with task refs dropped) and `broadcast_event/3` (deltas); JS → Elixir via `handle_event/3`. The list of keys persisted between Livebook reloads is the `@persisted_keys` module attribute on each cell — add to it when introducing new persistent state.
