# KinoAtpClient

Livebook Smart Cells for [`atp_client`](https://hexdocs.pm/atp_client) — a
unified frontend over four automated theorem prover backends:

- **SystemOnTPTP** — the public `tptp.org` HTTP form API.
- **StarExec** — self-hosted StarExec deployments.
- **Isabelle** — `isabelle server` instances via `isabelle_elixir`.
- **LocalExec** — a locally installed TPTP-compliant prover binary
  (E, Vampire, …) invoked through `Port.open/2`.

Two cells ship in this package:

- **ATP Solver** — Monaco-backed TPTP editor with a backend mode switch.
  Live linting via `AtpClient.Lint.analyze/2`; output renders per backend
  (raw prover text for SoTPTP, SZS badge for StarExec/LocalExec, per-lemma
  table for Isabelle).

    Isabelle works **zero-config** when the `isabelle` executable is on
    `PATH` (or `ISABELLE_TOOL` is set): `KinoAtpClient.IsabelleRuntime`
    auto-spawns a local server, opens one `HOL` session, loads the bundled
    `TPTP.thy`, and reuses both across solves. No `host`, `port`, `password`,
    or shared `local_dir` to configure.

- **ATP Backend Configuration** — schema-driven form built from each
  backend's `AtpClient.Config.Field` list. Fields are grouped into
  Connection / Defaults / Advanced sections; a Verify button calls the
  backend's `verify/1` callback so misconfiguration surfaces immediately.
  Generated source uses `Application.put_env/3` so subsequent cells in the
  notebook pick up the new settings.

## Installation

```elixir
def deps do
  [
    {:kino_atp_client, "~> 0.5"}
  ]
end
```

## Usage

Add `KinoAtpClient` to a Livebook:

```elixir
Mix.install([{:kino_atp_client, "~> 0.5"}])
```

Both Smart Cells then appear in the cell picker. Insert an "ATP Backend
Configuration" cell first to wire credentials, then one or more "ATP Solver"
cells to run TPTP problems against the configured backends.

See [`examples/demo.livemd`](examples/demo.livemd) for a worked example.
