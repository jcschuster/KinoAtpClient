defmodule KinoAtpClient do
  @moduledoc """
  Livebook Smart Cells that drive [`atp_client`](https://hexdocs.pm/atp_client)
  end to end — a single editor for TPTP problems plus a configuration form for
  each backend.

  Two cells are registered:

    * `KinoAtpClient.AtpSolver` ("ATP Solver") — TPTP editor with a backend
      mode switch. Dispatches to `AtpClient.SystemOnTptp`, `AtpClient.StarExec`,
      `AtpClient.Isabelle`, or `AtpClient.LocalExec` and renders the result
      panel appropriately for each (raw output for SystemOnTPTP, normalized SZS
      badge for StarExec/LocalExec, per-lemma table for Isabelle).
    * `KinoAtpClient.BackendConfig` ("ATP Backend Configuration") — schema-
      driven form that walks `AtpClient.backends/0` and renders each backend's
      `c:AtpClient.Backend.config_schema/0`. Validates with `verify/1` and
      generates `Application.put_env/3` source so the rest of the notebook
      picks up the new settings.

  ## Usage

      Mix.install([{:kino_atp_client, "~> 0.3"}])

  After installation, both Smart Cells appear in the Livebook cell picker.
  Insert an "ATP Backend Configuration" cell first to set credentials, then
  one or more "ATP Solver" cells to actually run problems.
  """
end
