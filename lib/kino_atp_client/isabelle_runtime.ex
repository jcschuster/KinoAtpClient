defmodule KinoAtpClient.IsabelleRuntime do
  @moduledoc """
  Lazy singleton that auto-manages a local Isabelle server + `HOL` session for
  the Smart Cell's Isabelle backend, mirroring the workflow demonstrated in
  the `isabelle_elixir` livebooks: spawn a local server, open one session,
  load the bundled `TPTP.thy`, and re-use both across calls.

  Compared with `AtpClient.Isabelle.query_tptp/2`, this:

    * **needs zero configuration** when the `isabelle` executable is on
      `PATH` (or `ISABELLE_TOOL` is set) — no `:password`, no `:local_dir`,
      no `:isabelle_dir`;
    * **persists** the server + session for the lifetime of the BEAM node,
      so the ~30 s `HOL` start-up only happens on the first solve click;
    * writes theory files into the **session's own `tmp_dir`** rather than
      a configured shared directory, so the BEAM and the Isabelle server
      always agree on where the theory lives.

  The runtime is started as a permanent child of the package's application
  supervision tree but stays *idle* until the first `query_tptp/2` call — no
  Isabelle process is spawned just by loading the package.
  """

  use GenServer

  alias AtpClient.ResultNormalization
  alias IsabelleClient.{Server, TPTP}

  @session "HOL"
  @start_timeout 180_000
  @check_timeout 120_000

  # ─── Public API ──────────────────────────────────────────────────────────

  @doc "Starts the runtime supervisor child. Does not spawn Isabelle yet."
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Returns `:ok` if a local Isabelle executable is reachable on this machine.

  Probes `ISABELLE_TOOL` and then `PATH`; does not spawn anything.
  """
  @spec available?() :: :ok | {:error, term()}
  def available? do
    case Server.executable() do
      {:ok, _exe} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Checks a TPTP/THF `problem` against the auto-managed local Isabelle session
  and returns the per-lemma classification.

  `opts`:

    * `:proof_method` — Isabelle tactic appended after each generated `lemma`
      (default `"by auto"`).

  Returns `{:ok, [%{line:, name:, result:}]}` on success or
  `{:error, reason}` if Isabelle is unavailable, the TPTP fragment failed to
  parse, or the server reported a task failure.
  """
  @spec query_tptp(String.t(), keyword()) ::
          {:ok, [ResultNormalization.lemma_result()]} | {:error, term()}
  def query_tptp(problem, opts \\ []) when is_binary(problem) do
    GenServer.call(__MODULE__, {:query_tptp, problem, opts}, :infinity)
  end

  @doc """
  Stops the running session (if any) and tears down the local server.

  Useful for tests; not strictly necessary in production since the runtime
  is terminated when the application shuts down.
  """
  def reset, do: GenServer.call(__MODULE__, :reset, :infinity)

  # ─── GenServer callbacks ─────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Process.flag(:trap_exit, true)
    {:ok, %{server: nil, client: nil}}
  end

  @impl true
  def handle_call({:query_tptp, problem, opts}, _from, state) do
    case ensure_session(state) do
      {:ok, ready_state} ->
        {:reply, run_query(ready_state.client, problem, opts), ready_state}

      {:error, _} = err ->
        {:reply, err, state}
    end
  end

  def handle_call(:reset, _from, state) do
    {:reply, :ok, shutdown(state)}
  end

  # IsabelleClient drives the local server through a Port, which sends an
  # `{:EXIT, port, :normal}` message back to whichever process opened it once
  # the connection is established and the port closes. We trap exits so the
  # runtime survives that, but the message itself is benign — discard.
  @impl true
  def handle_info({:EXIT, _from, _reason}, state), do: {:noreply, state}

  def handle_info(_msg, state), do: {:noreply, state}

  @impl true
  def terminate(_reason, state) do
    _ = shutdown(state)
    :ok
  end

  # ─── Session lifecycle ───────────────────────────────────────────────────

  defp ensure_session(%{client: %IsabelleClient{}} = state), do: {:ok, state}

  defp ensure_session(state) do
    server_name = unique_server_name()

    with :ok <- available?(),
         {:ok, server} <- IsabelleClient.start_server(server_name: server_name),
         {:ok, raw_client} <- IsabelleClient.connect(server),
         {:ok, session_client, _start_task} <-
           IsabelleClient.start_session(
             raw_client,
             [session: @session],
             @start_timeout
           ),
         {:ok, _tptp_task} <- TPTP.load(session_client, @start_timeout) do
      {:ok, %{state | server: server, client: session_client}}
    else
      {:error, _} = err ->
        # Best-effort cleanup if the server started but session start failed.
        _ = safe(fn -> Server.kill(server_name) end)
        err

      other ->
        _ = safe(fn -> Server.kill(server_name) end)
        {:error, {:isabelle_session_init_failed, other}}
    end
  end

  defp shutdown(%{client: nil, server: nil} = state), do: state

  defp shutdown(%{client: client, server: server} = state) do
    # Try the polite path first (so the Isabelle server gets a chance to
    # flush its log), then fall back to `isabelle server -x` which works
    # even when the socket is already gone.
    if is_struct(client, IsabelleClient) do
      _ = safe(fn -> IsabelleClient.shutdown_server(client) end)
      _ = safe(fn -> IsabelleClient.close(client) end)
    end

    if match?(%Server.Info{}, server) do
      _ = safe(fn -> Server.kill(server.name) end)
    end

    %{state | client: nil, server: nil}
  end

  defp safe(fun) do
    fun.()
  rescue
    _ -> :error
  catch
    _, _ -> :error
  end

  defp unique_server_name do
    "kino_atp_client_#{System.unique_integer([:positive])}"
  end

  # ─── Query logic ─────────────────────────────────────────────────────────

  defp run_query(client, problem, opts) do
    proof_method = Keyword.get(opts, :proof_method, "by auto")

    with {:ok, isabellized} <- safe_isabellize(problem) do
      body = build_body(isabellized, proof_method)
      name = derive_name(problem)

      case IsabelleClient.check_text(
             client,
             name,
             body,
             [imports: ~s("TPTP"), unicode_symbols: true],
             @check_timeout
           ) do
        {:ok, %IsabelleClient.Task{status: :finished, result: %{} = payload}} ->
          # check_text writes `theory <name> imports … begin\n<body>\nend`, so
          # body line 1 = source file line 2 → subtract 1 to map Isabelle
          # positions back to the user's text.
          {:ok, ResultNormalization.per_lemma_results(payload, line_offset: 1)}

        {:error, %IsabelleClient.Task{status: :failed, result: payload}} ->
          {:error, {:isabelle_failed, payload}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp build_body(isabellized, proof_method) do
    "unbundle from_TPTP\n\n" <> inject_proof_method(isabellized, proof_method)
  end

  # Mirrors AtpClient.Isabelle's helper: append the configured tactic line
  # after every isabellized `lemma` so the goal closes (or fails cleanly).
  defp inject_proof_method(text, method) do
    text
    |> String.split(~r/\n\n+/)
    |> Enum.map_join("\n\n", fn item ->
      if String.starts_with?(String.trim_leading(item), "lemma ") do
        String.trim_trailing(item) <> "\n  " <> method
      else
        item
      end
    end)
  end

  defp safe_isabellize(problem) do
    {:ok, TPTP.isabellize_theory(problem)}
  rescue
    e -> {:error, {:tptp_parse, Exception.message(e)}}
  end

  defp derive_name(problem) do
    hash = :crypto.hash(:sha256, problem) |> Base.encode16(case: :lower)
    "KinoAtp_" <> binary_part(hash, 0, 12)
  end
end
