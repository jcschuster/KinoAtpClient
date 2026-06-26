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

  alias AtpClient.Lint
  alias AtpClient.Lint.Report
  alias AtpClient.SystemOnTptp

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
  def handle_info(:fetch_solvers, ctx) do
    SystemOnTptp.Provers.refresh_systems_list()
    solvers = SystemOnTptp.list_provers()
    selected = pick_solver(ctx.assigns.system, solvers)

    broadcast_event(ctx, "solvers_fetched", %{
      "solvers" => solvers,
      "selected" => selected
    })

    {:noreply, assign(ctx, solvers: solvers, system: selected)}
  end

  def handle_info(
        {ref, {:lint_ok, %Report{} = report}},
        %{assigns: %{lint_task: %Task{ref: ref}}} = ctx
      ) do
    Process.demonitor(ref, [:flush])

    broadcast_event(ctx, "lint_result", %{
      "diagnostics" => Enum.map(report.diagnostics, &Map.from_struct/1),
      "symbols" => Enum.map(report.symbols, &Map.from_struct/1)
    })

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

  defp pick_solver(current, []), do: current

  defp pick_solver(current, [first | _] = solvers) do
    if current in solvers, do: current, else: first
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
    backends = if cancelled_ctx.assigns.tptp4x_enabled, do: [:local, :tptp4x], else: [:local]

    task =
      Task.async(fn ->
        try do
          {:lint_ok, Lint.analyze(problem, backends: backends)}
        rescue
          _ -> {:lint_ok, %Report{diagnostics: [], symbols: []}}
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
    case SystemOnTptp.query_system(prob, sys, time_limit_sec: tl, raw: true) do
      {:ok, body} ->
        {:broadcast, "preview", %{"text" => body, "system" => sys}}

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
      {:ok, lemmas} ->
        {:broadcast, "lemma_results", %{"lemmas" => Enum.map(lemmas, &lemma_payload/1)}}

      {:error, reason} ->
        error_event(reason)
    end
  end

  # Dispatch order:
  #   1. The user explicitly configured a remote Isabelle (`:password` is set
  #      in the Application env) → use `AtpClient.Isabelle.query_tptp/2`.
  #   2. A local `isabelle` executable is available → use the auto-managed
  #      `KinoAtpClient.IsabelleRuntime` (no directory / password setup).
  #   3. Neither → defer to `AtpClient.Isabelle.query_tptp/2` so its config
  #      error surfaces with the canonical "missing required setting"
  #      message.
  defp isabelle_query(problem, opts) do
    cond do
      remote_isabelle_configured?() ->
        problem
        |> AtpClient.Isabelle.query_tptp(opts)
        |> annotate_remote_isabelle_error()

      KinoAtpClient.IsabelleRuntime.available?() == :ok ->
        KinoAtpClient.IsabelleRuntime.query_tptp(problem, opts)

      true ->
        AtpClient.Isabelle.query_tptp(problem, opts)
    end
  end

  # `AtpClient.Isabelle.prove_theory` surfaces bare posix atoms (`:enoent`,
  # `:eacces`, …) from `File.mkdir_p`/`File.write` against the configured
  # `:local_dir`, which would otherwise display in the UI as a cryptic
  # `:enoent`. Rewrap with the path so users know what to fix.
  defp annotate_remote_isabelle_error({:error, posix})
       when posix in [:enoent, :eacces, :eisdir, :enotdir, :erofs, :enospc, :eperm] do
    location =
      case Application.get_env(:atp_client, :isabelle, []) |> Keyword.get(:local_dir) do
        nil -> "the auto-managed Isabelle theory directory under " <> inspect(System.tmp_dir!())
        dir -> "local_dir=" <> inspect(dir)
      end

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

  defp atp_result_event({:ok, status}) when is_atom(status) do
    {:broadcast, "atp_result", %{"kind" => "ok", "status" => Atom.to_string(status)}}
  end

  defp atp_result_event({:error, reason}), do: error_event(reason)

  defp lemma_payload(%{line: line, name: name, result: {:ok, status}}) when is_atom(status) do
    %{"line" => line, "name" => name, "kind" => "ok", "status" => Atom.to_string(status)}
  end

  defp lemma_payload(%{line: line, name: name, result: {:error, reason}}) do
    %{"line" => line, "name" => name, "kind" => "error", "message" => format_reason(reason)}
  end

  defp error_event(reason),
    do: {:broadcast, "preview_error", %{"message" => format_reason(reason)}}

  defp format_reason(reason) when is_binary(reason), do: reason
  defp format_reason(reason), do: inspect(reason, pretty: true, width: 80)

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

    case AtpClient.SystemOnTptp.query_system(problem, system, time_limit_sec: time_limit, raw: true) do
      {:ok, output} ->
        IO.puts(output)
        output

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
      :ok -> KinoAtpClient.IsabelleRuntime.query_tptp(problem, proof_method: #{inspect(method)})
      {:error, _} -> AtpClient.Isabelle.query_tptp(problem, proof_method: #{inspect(method)})
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
