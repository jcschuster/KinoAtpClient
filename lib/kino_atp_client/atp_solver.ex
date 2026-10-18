defmodule KinoAtpClient.AtpSolver do
  @moduledoc """
  TPTP editor Smart Cell with a backend mode switch.

  The cell drives all four AtpClient backends — `SystemOnTPTP`, `StarExec`,
  `Isabelle`, `LocalExec` — from a single TPTP problem editor. Switching the
  backend dropdown swaps both the per-call controls in the header (solver
  picker for SoTPTP, proof method for Isabelle, …) and the output rendering
  (raw prover text for SoTPTP, normalized SZS badge for StarExec/LocalExec,
  per-lemma table for Isabelle).

  Cross-cutting credentials (StarExec base URL, Isabelle password, …) live in
  `KinoAtpClient.BackendConfig` so this cell stays focused on a single
  problem run.
  """

  use Kino.JS, assets_path: "lib/assets/atp_solver"
  use Kino.JS.Live
  use Kino.SmartCell, name: "ATP Solver"

  alias AtpClient.Analyzer.Tptp4x
  alias AtpClient.Config
  alias AtpClient.Result
  alias AtpClient.System
  alias AtpClient.SystemOnTptp
  alias Tptp.Analysis
  alias Tptp.Diagnostic
  alias Tptp.Printer.Canonical
  alias Tptp.Span

  @default_backend "sotptp"

  @persisted_keys [
    :problem_str,
    :backend,
    :system,
    :time_limit,
    :proof_method,
    :theme,
    :tptp4x_enabled
  ]

  @persisted_string_keys Enum.map(@persisted_keys, &Atom.to_string/1)

  @impl true
  def init(attrs, ctx) do
    state = %{
      problem_str: Map.get(attrs, "problem_str", "thf(test, conjecture, $true => $true)."),
      backend: Map.get(attrs, "backend", @default_backend),
      system: Map.get(attrs, "system", ""),
      time_limit: Map.get(attrs, "time_limit", 5),
      proof_method: Map.get(attrs, "proof_method", "by auto"),
      theme: Map.get(attrs, "theme", "Dracula"),
      tptp4x_enabled: Map.get(attrs, "tptp4x_enabled", false),
      solvers: [],
      backends: backends_payload(),
      lint_task: nil,
      query_task: nil
    }

    send(self(), :fetch_solvers)
    {:ok, assign(ctx, state)}
  end

  @impl true
  def handle_connect(ctx) do
    payload = Map.drop(ctx.assigns, [:lint_task, :query_task])
    {:ok, payload, ctx}
  end

  # ─── Async message handling ──────────────────────────────────────────────

  @impl true
  # The systems agent starts from atp_client's shipped snapshot and refreshes
  # itself in the background, so reading it here never blocks on tptp.org.
  # The dropdown lists bare names (`"Vampire"`): SystemOnTPTP resolves a name
  # to its latest advertised version, so saved cells survive version bumps.
  def handle_info(:fetch_solvers, ctx) do
    solvers =
      [capability: :prove]
      |> SystemOnTptp.systems()
      |> Enum.map(& &1.name)
      |> Enum.uniq()

    selected = pick_solver(ctx.assigns.system, solvers)

    broadcast_event(ctx, "solvers_fetched", %{
      "solvers" => solvers,
      "selected" => selected
    })

    {:noreply, assign(ctx, solvers: solvers, system: selected)}
  end

  def handle_info(
        {ref, {:lint_ok, payload}},
        %{assigns: %{lint_task: %Task{ref: ref}}} = ctx
      ) do
    Process.demonitor(ref, [:flush])
    broadcast_event(ctx, "lint_result", payload)

    {:noreply, assign(ctx, lint_task: nil)}
  end

  def handle_info(
        {ref, {:broadcast, event, payload}},
        %{assigns: %{query_task: %Task{ref: ref}}} = ctx
      ) do
    Process.demonitor(ref, [:flush])
    broadcast_event(ctx, event, payload)
    {:noreply, assign(ctx, query_task: nil)}
  end

  # Stale Task replies (superseded by a newer task, or cancelled via
  # `Task.shutdown/2`). Discard quietly — the live task ref no longer matches.
  def handle_info({ref, _stale_payload}, ctx) when is_reference(ref) do
    Process.demonitor(ref, [:flush])
    {:noreply, ctx}
  end

  def handle_info({:DOWN, _ref, :process, _pid, _reason}, ctx) do
    {:noreply, ctx}
  end

  # Cells saved before the dropdown listed names hold an identifier such as
  # `"E---3.5.1"`; `System.name/1` maps it to the name it now selects.
  defp pick_solver(current, []), do: current

  defp pick_solver(current, [first | _] = solvers) do
    name = System.name(current)
    if name in solvers, do: name, else: first
  end

  # ─── User edits ──────────────────────────────────────────────────────────

  @impl true
  def handle_event("update", params, ctx) do
    updates =
      for {k, v} <- params, k in @persisted_string_keys, into: %{} do
        {String.to_existing_atom(k), v}
      end

    {:noreply, assign(ctx, updates)}
  end

  # ─── Lint trigger ────────────────────────────────────────────────────────

  def handle_event("check_syntax", %{"problem" => problem}, ctx) when is_binary(problem) do
    cancelled_ctx = cancel_task(ctx, :lint_task)
    tptp4x? = cancelled_ctx.assigns.tptp4x_enabled

    task =
      Task.async(fn ->
        try do
          {:lint_ok, lint(problem, tptp4x?)}
        rescue
          _ -> {:lint_ok, %{"diagnostics" => [], "symbols" => []}}
        end
      end)

    {:noreply, assign(cancelled_ctx, lint_task: task)}
  end

  # ─── Solve trigger ───────────────────────────────────────────────────────

  def handle_event("solve", _params, ctx) do
    cancelled_ctx = cancel_task(ctx, :query_task)
    assigns = cancelled_ctx.assigns

    broadcast_event(cancelled_ctx, "solve_started", %{"backend" => assigns.backend})

    task =
      Task.async(fn ->
        try do
          run_backend(assigns)
        rescue
          e -> error_event(Exception.message(e))
        catch
          kind, reason -> error_event(Exception.format(kind, reason))
        end
      end)

    {:noreply, assign(cancelled_ctx, query_task: task)}
  end

  # Pattern-matched dispatch — one clause per backend. Each clause returns
  # the `{:broadcast, event, payload}` tuple the parent process turns into
  # a `broadcast_event/3` call.

  defp run_backend(%{backend: "sotptp", problem_str: prob, system: sys, time_limit: tl}) do
    case SystemOnTptp.query_system(prob, sys, time_limit_sec: tl) do
      {:ok, %Result{output: output, system: ran}} ->
        {:broadcast, "preview", %{"text" => output, "system" => ran || sys}}

      {:error, reason} ->
        error_event(reason)
    end
  end

  defp run_backend(%{backend: "starexec", problem_str: prob, time_limit: tl}) do
    prob
    |> AtpClient.StarExec.query(cpu_timeout_s: tl)
    |> atp_result_event()
  end

  defp run_backend(%{backend: "local_exec", problem_str: prob, time_limit: tl}) do
    prob
    |> AtpClient.LocalExec.query(cpu_timeout_s: tl)
    |> atp_result_event()
  end

  defp run_backend(%{backend: "isabelle", problem_str: prob, proof_method: method}) do
    case isabelle_query(prob, proof_method: method) do
      {:ok, %Result{details: %{lemmas: lemmas}}} ->
        {:broadcast, "lemma_results", %{"lemmas" => Enum.map(lemmas, &lemma_payload/1)}}

      {:error, reason} ->
        error_event(reason)
    end
  end

  # Dispatch order:
  #   1. The user explicitly configured a remote Isabelle (`:password` is set
  #      in the Application env) → use `AtpClient.Isabelle.query/2`.
  #   2. A local `isabelle` executable is available → use the auto-managed
  #      `KinoAtpClient.IsabelleRuntime` (no directory / password setup).
  #   3. Neither → defer to `AtpClient.Isabelle.query/2` so its config
  #      error surfaces with the canonical "missing required setting"
  #      message.
  defp isabelle_query(problem, opts) do
    cond do
      remote_isabelle_configured?() ->
        problem
        |> AtpClient.Isabelle.query(opts)
        |> annotate_remote_isabelle_error()

      KinoAtpClient.IsabelleRuntime.available?() == :ok ->
        KinoAtpClient.IsabelleRuntime.query(problem, opts)

      true ->
        AtpClient.Isabelle.query(problem, opts)
    end
  end

  # `AtpClient.Isabelle.prove_theory` surfaces bare posix atoms (`:enoent`,
  # `:eacces`, …) from `File.mkdir_p`/`File.write` against the configured
  # `:local_dir`, which would otherwise display in the UI as a cryptic
  # `:enoent`. Rewrap with the path so users know what to fix.
  defp annotate_remote_isabelle_error({:error, posix})
       when posix in [:enoent, :eacces, :eisdir, :enotdir, :erofs, :enospc, :eperm] do
    location =
      "local_dir=" <> inspect(Config.get(:isabelle) |> Keyword.fetch!(:local_dir))

    {:error,
     "Isabelle backend filesystem error #{inspect(posix)} on " <>
       location <>
       ". Check that the directory exists and " <>
       "is writable, or pick a different one in the ATP Backend Configuration cell."}
  end

  defp annotate_remote_isabelle_error(other), do: other

  defp remote_isabelle_configured? do
    :atp_client
    |> Application.get_env(:isabelle, [])
    |> Keyword.get(:password)
    |> is_binary()
  end

  defp atp_result_event({:ok, %Result{status: status}}) do
    {:broadcast, "atp_result", %{"kind" => "ok", "status" => Atom.to_string(status)}}
  end

  defp atp_result_event({:error, reason}), do: error_event(reason)

  defp lemma_payload(%{name: name, status: status}) do
    %{"name" => name, "kind" => "ok", "status" => Atom.to_string(status)}
  end

  defp error_event(reason),
    do: {:broadcast, "preview_error", %{"message" => format_reason(reason)}}

  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(:internal_error), do: "Prover reported an internal error."

  defp format_reason({:unknown_system, system}) when is_binary(system),
    do: "SystemOnTPTP does not offer a system named #{system}."

  defp format_reason({:unknown_szs_status, word}) when is_binary(word),
    do: "Prover reported a status outside the SZS ontology: " <> word

  defp format_reason({:prover_not_found, exe}) when is_binary(exe),
    do: "Prover executable not found on PATH: #{exe}"

  defp format_reason({:unrecognized_output, output}) when is_binary(output),
    do: "Prover finished without a recognisable SZS status. Raw output:\n\n" <> output

  defp format_reason({:tptp_parse, msg}) when is_binary(msg),
    do: "Failed to parse the TPTP problem: " <> msg

  defp format_reason({:tptp_thy_copy_failed, reason}),
    do: "Failed to install the TPTP support theory: " <> inspect(reason)

  # AtpClient.Isabelle.prove_tptp/3 annotates "Cannot load theory file" failures
  # with a keyword list whose first entry is `{:hint, explanation}`.
  defp format_reason({:isabelle_failed, _payload, [{:hint, hint} | _]}) when is_binary(hint),
    do: hint

  defp format_reason({:isabelle_failed, %{"message" => msg}, _}) when is_binary(msg),
    do: "Isabelle server error: " <> msg

  defp format_reason({:isabelle_failed, _, _}),
    do: "Isabelle server reported a task failure."

  # 2-tuple variant produced by KinoAtpClient.IsabelleRuntime.
  defp format_reason({:isabelle_failed, %{"message" => msg}}) when is_binary(msg),
    do: "Isabelle server error: " <> msg

  defp format_reason({:isabelle_failed, _}),
    do: "Isabelle server reported a task failure."

  defp format_reason(reason), do: inspect(reason, pretty: true, width: 80)

  # ─── Lint payload ──────────────────────────────────────────────────────

  # `Tptp.analyze/2` runs the parser and `Tptp.Lint` in one traversal and also
  # yields the symbol table the editor uses for hovers and completion.
  defp lint(problem, tptp4x?) do
    analysis = problem |> Tptp.analyze() |> Analysis.with_line_index()

    diagnostics =
      Diagnostic.sort(analysis.diagnostics ++ remote_diagnostics(analysis, tptp4x?))

    %{
      "diagnostics" => Enum.map(diagnostics, &diagnostic_payload(analysis, &1)),
      "symbols" => Enum.map(Map.values(analysis.table.symbols), &symbol_payload(analysis, &1))
    }
  end

  # TPTP4X only runs on input the local pass accepts: its view of a file that
  # does not parse just duplicates the local error.
  defp remote_diagnostics(_analysis, false), do: []

  defp remote_diagnostics(analysis, true) do
    if Diagnostic.any_errors?(analysis.diagnostics),
      do: [],
      else: Tptp4x.analyze(analysis, [])
  end

  defp diagnostic_payload(analysis, %Diagnostic{span: span} = diagnostic) do
    {line, column} = Analysis.line_column(analysis, span.offset)
    {end_line, end_column} = Analysis.line_column(analysis, Span.ending(span))

    %{
      "severity" => Atom.to_string(diagnostic.severity),
      "message" => diagnostic_message(diagnostic),
      "source" => diagnostic.code,
      "line" => line,
      "column" => column,
      "end_line" => end_line,
      "end_column" => end_column
    }
  end

  defp diagnostic_message(%Diagnostic{message: message, hint: nil}), do: message
  defp diagnostic_message(%Diagnostic{message: message, hint: hint}), do: message <> "\n" <> hint

  defp symbol_payload(analysis, %{name: name, declared_as: type, declared_at: span}) do
    %{"name" => name, "type" => symbol_type(type), "line" => symbol_line(analysis, span)}
  end

  defp symbol_type(nil), do: nil
  defp symbol_type(node), do: Canonical.to_string(node)

  defp symbol_line(_analysis, nil), do: nil

  defp symbol_line(analysis, %Span{offset: offset}),
    do: analysis |> Analysis.line_column(offset) |> elem(0)

  # ─── Task lifecycle helpers ──────────────────────────────────────────────

  defp cancel_task(ctx, key) do
    case Map.get(ctx.assigns, key) do
      %Task{} = task ->
        Task.shutdown(task, :brutal_kill)
        assign(ctx, [{key, nil}])

      _ ->
        ctx
    end
  end

  # ─── Persistence ─────────────────────────────────────────────────────────

  @impl true
  def to_attrs(ctx), do: Map.take(ctx.assigns, @persisted_keys)

  @impl true
  def to_source(%{backend: backend} = attrs), do: render_source(backend, attrs)
  def to_source(attrs), do: render_source(@default_backend, attrs)

  defp render_source("sotptp", %{problem_str: prob, system: sys, time_limit: tl}) do
    """
    # Generated by ATP Solver (backend: SystemOnTPTP)
    problem = #{inspect(prob)}
    system = #{inspect(sys)}
    time_limit = #{inspect(tl)}

    case AtpClient.SystemOnTptp.query_system(problem, system, time_limit_sec: time_limit) do
      {:ok, result} ->
        IO.puts(result.output)
        result

      {:error, reason} ->
        raise "SystemOnTPTP error: \#{inspect(reason)}"
    end
    """
  end

  defp render_source("starexec", %{problem_str: prob, time_limit: tl}) do
    """
    # Generated by ATP Solver (backend: StarExec)
    problem = #{inspect(prob)}

    AtpClient.StarExec.query(problem, cpu_timeout_s: #{inspect(tl)})
    """
  end

  defp render_source("local_exec", %{problem_str: prob, time_limit: tl}) do
    """
    # Generated by ATP Solver (backend: LocalExec)
    problem = #{inspect(prob)}

    AtpClient.LocalExec.query(problem, cpu_timeout_s: #{inspect(tl)})
    """
  end

  defp render_source("isabelle", %{problem_str: prob, proof_method: method}) do
    """
    # Generated by ATP Solver (backend: Isabelle)
    problem = #{inspect(prob)}

    # Uses the auto-managed local Isabelle server when `isabelle` is on PATH,
    # otherwise falls back to AtpClient.Isabelle's remote-config path.
    case KinoAtpClient.IsabelleRuntime.available?() do
      :ok -> KinoAtpClient.IsabelleRuntime.query(problem, proof_method: #{inspect(method)})
      {:error, _} -> AtpClient.Isabelle.query(problem, proof_method: #{inspect(method)})
    end
    """
  end

  # ─── Backend metadata ────────────────────────────────────────────────────

  defp backends_payload do
    for module <- AtpClient.backends() do
      %{"key" => Atom.to_string(module.config_key()), "label" => module.label()}
    end
  end
end
