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

      Mix.install([{:kino_atp_client, "~> 0.6"}])

  After installation, both Smart Cells appear in the Livebook cell picker.
  Insert an "ATP Backend Configuration" cell first to set credentials, then
  one or more "ATP Solver" cells to actually run problems.

  ## Reading the result: the SZS Ontology

  Verdicts from every backend are normalized to the
  [SZS Ontology](https://tptp.org/UserDocs/SZSOntology/), a standardised
  vocabulary shared across TPTP-compliant provers. The badge in the result
  panel prints the SZS tag verbatim (`Theorem`, `CounterSatisfiable`, …).
  For newcomers to automated reasoning, the tags divide as follows.

  ### Success — the prover reached a definite verdict

    * `Theorem` — the conjecture follows from the axioms.
    * `Unsatisfiable` — the clause set has no model. In a refutation-style
      proof (negate the goal, look for a contradiction) this *is* the proof
      of the original conjecture; `Theorem` and `Unsatisfiable` therefore
      often mean the same practical thing on different pipelines, so the
      library preserves the distinction rather than collapsing them.
    * `Satisfiable` — the clause set has a model. In a refutation pipeline
      this refutes the goal; standalone, it just witnesses consistency.
    * `CounterSatisfiable` — the negated conjecture is satisfiable, i.e.
      the original conjecture is *disproven*.
    * `ContradictoryAxioms` — the axioms alone are inconsistent, so
      *anything* follows. Usually a bug in the axiomatisation.
    * `Equivalent`, `CounterEquivalent`, `Tautology`,
      `TautologousConclusion`, `WeakerConclusion`, `EquiSatisfiable`,
      `NoConsequence`, `CounterTheorem`, `EquivalentCounterTheorem` —
      finer-grained comparisons between the conjecture and the axioms;
      most sledgehammer-style workflows won't see these.

  ### NoSuccess — the prover stopped without a verdict

    * `GaveUp` — search exhausted, no proof found; try a different tactic
      or more time.
    * `Timeout`, `ResourceOut`, `MemoryOut` — hit a wall-clock / cpu /
      memory budget. Consider raising the limit or picking a stronger
      solver.
    * `Unknown`, `Incomplete` — the prover cannot decide the input in
      general (e.g. a first-order fragment outside its capability).
    * `Forced`, `User` — the run was interrupted externally.
    * `Inappropriate` — the input is not in the fragment the prover
      accepts (e.g. THF sent to a FOF-only solver).
    * `Error`, `InputError` — the prover reported an error while parsing
      or executing. Check the raw output.

  The badge colouring follows this split: green for proving success,
  blue for models, amber for disproved conclusions, orange for resource
  exhaustion, red for prover errors, grey for undecided.

  See `AtpClient.ResultNormalization` for the exhaustive list of atoms and
  the classifier rules, and
  <https://tptp.org/UserDocs/SZSOntology/> for the ontology itself.
  """
end
