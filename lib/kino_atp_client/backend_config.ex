defmodule KinoAtpClient.BackendConfig do
  @moduledoc """
  Schema-driven configuration Smart Cell for AtpClient backends.

  Iterates `AtpClient.backends/0`, renders each backend's
  `c:AtpClient.Backend.config_schema/0` as a grouped form (Connection /
  Defaults / Advanced), and emits one `Application.put_env/3` call per
  backend the user has filled in. Includes a Verify button that calls
  `c:AtpClient.Backend.verify/1` so the cell can flag bad credentials before
  the rest of the notebook tries to use them.
  """

  use Kino.JS, assets_path: "lib/assets/backend_config"
  use Kino.JS.Live
  use Kino.SmartCell, name: "ATP Backend Configuration"

  @default_backend "sotptp"

  # UI-only toggles that don't appear in any backend's `config_schema/0` but
  # need to be persisted alongside the schema values (e.g. "skip TLS
  # verification" for self-signed dev StarExec instances). Each entry is a
  # `%{key, label, doc}` map; values flow through the same `update_value`
  # event and live under the same `values[backend]` map, distinguished only
  # by being listed here.
  @ui_extras %{
    "starexec" => [
      %{
        "key" => "insecure_tls",
        "label" => "Skip TLS verification",
        "doc" =>
          "Accept self-signed or untrusted certificates. Development only — " <>
            "leave off for any deployment carrying real credentials or data."
      }
    ]
  }

  @impl true
  def init(attrs, ctx) do
    state = %{
      backend: Map.get(attrs, "backend", @default_backend),
      values: Map.get(attrs, "values", %{}),
      backends: backends_payload(),
      schemas: schemas_payload(),
      notices: backend_notices(),
      ui_extras: @ui_extras,
      verify_task: nil,
      verify_status: nil
    }

    {:ok, assign(ctx, state)}
  end

  @impl true
  def handle_connect(ctx) do
    payload = Map.drop(ctx.assigns, [:verify_task])
    {:ok, payload, ctx}
  end

  # ─── User edits ──────────────────────────────────────────────────────────

  @impl true
  def handle_event("update_backend", %{"backend" => backend}, ctx) do
    {:noreply, assign(ctx, backend: backend, verify_status: nil)}
  end

  def handle_event(
        "update_value",
        %{"backend" => backend, "key" => key, "value" => value},
        ctx
      ) do
    new_values =
      Map.update(ctx.assigns.values, backend, %{key => value}, &Map.put(&1, key, value))

    {:noreply, assign(ctx, values: new_values, verify_status: nil)}
  end

  # ─── Server-side folder picker ───────────────────────────────────────────
  #
  # JS sends `list_dir` with the path it wants to browse (empty string ⇒ start
  # from `$HOME` or cwd). We resolve the path, list its directory entries, and
  # broadcast `dir_listing` back so the picker UI can render. The `:backend`
  # and `:key` are echoed so the JS can route the response to the right field
  # when several pickers are mounted simultaneously.
  def handle_event(
        "list_dir",
        %{"backend" => backend, "key" => key, "path" => path},
        ctx
      ) do
    listing =
      path
      |> resolve_browse_path()
      |> directory_listing()
      |> Map.merge(%{"backend" => backend, "key" => key})

    broadcast_event(ctx, "dir_listing", listing)
    {:noreply, ctx}
  end

  def handle_event("verify", %{"backend" => backend}, ctx) do
    cancelled_ctx = cancel_task(ctx, :verify_task)
    raw_values = Map.get(cancelled_ctx.assigns.values, backend, %{})

    task = start_verify_task(backend, raw_values)

    case task do
      nil ->
        {:noreply, cancelled_ctx}

      %Task{} ->
        broadcast_event(cancelled_ctx, "verify_started", %{"backend" => backend})
        {:noreply, assign(cancelled_ctx, verify_task: task)}
    end
  end

  # Isabelle gets a special path: when the user has not entered any values, we
  # interpret that as "use the auto-managed local runtime" and probe the
  # executable instead of trying to log into a (non-existent) remote server.
  defp start_verify_task("isabelle", raw_values) when raw_values == %{} do
    spawn_verify("isabelle", fn ->
      case KinoAtpClient.IsabelleRuntime.available?() do
        :ok -> :ok
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  defp start_verify_task(backend, raw_values) do
    case backend_module(backend) do
      nil ->
        nil

      module ->
        opts = coerce_values_for(backend, raw_values) ++ extra_options(backend, raw_values)
        spawn_verify(backend, fn -> module.verify(opts) end)
    end
  end

  defp spawn_verify(backend, fun) do
    Task.async(fn ->
      try do
        {:verify_result, backend, fun.()}
      rescue
        e -> {:verify_result, backend, {:error, Exception.message(e)}}
      catch
        kind, reason -> {:verify_result, backend, {:error, Exception.format(kind, reason)}}
      end
    end)
  end

  # ─── Async results ───────────────────────────────────────────────────────

  @impl true
  def handle_info(
        {ref, {:verify_result, backend, outcome}},
        %{assigns: %{verify_task: %Task{ref: ref}}} = ctx
      ) do
    Process.demonitor(ref, [:flush])
    status_payload = encode_verify_outcome(backend, outcome)
    broadcast_event(ctx, "verify_result", status_payload)
    {:noreply, assign(ctx, verify_task: nil, verify_status: status_payload)}
  end

  def handle_info({ref, {:verify_result, _, _}}, ctx) when is_reference(ref) do
    Process.demonitor(ref, [:flush])
    {:noreply, ctx}
  end

  def handle_info({:DOWN, _ref, :process, _pid, _reason}, ctx), do: {:noreply, ctx}

  defp encode_verify_outcome(backend, :ok),
    do: %{"backend" => backend, "kind" => "ok"}

  defp encode_verify_outcome(backend, {:error, reason}),
    do: %{"backend" => backend, "kind" => "error", "message" => format_reason(reason)}

  defp format_reason(reason) when is_binary(reason), do: reason

  defp format_reason(%Req.TransportError{reason: :econnrefused}),
    do: "Connection refused — nothing accepted a TCP connection at the configured URL."

  defp format_reason(%Req.TransportError{reason: :nxdomain}),
    do: "Hostname could not be resolved."

  defp format_reason(%Req.TransportError{reason: :timeout}),
    do: "Connection timed out."

  defp format_reason(%Req.TransportError{reason: {:tls_alert, {:bad_certificate, _}}}) do
    "TLS rejected the server certificate (typically self-signed). " <>
      "For development, enable \"Skip TLS verification\" below."
  end

  defp format_reason(%Req.TransportError{reason: reason}),
    do: "Transport error: #{inspect(reason)}"

  defp format_reason(reason), do: inspect(reason, pretty: true, width: 80)

  defp resolve_browse_path(path) when is_binary(path) do
    case String.trim(path) do
      "" -> System.user_home() || File.cwd!()
      trimmed -> Path.expand(trimmed)
    end
  end

  defp directory_listing(path) do
    base = %{
      "path" => path,
      "parent" => parent_path(path),
      "drives" => available_drives()
    }

    case File.ls(path) do
      {:ok, entries} ->
        dirs =
          entries
          |> Enum.filter(fn entry ->
            not String.starts_with?(entry, ".") and
              directory?(Path.join(path, entry))
          end)
          |> Enum.sort()
          |> Enum.map(&%{"name" => &1})

        Map.merge(base, %{"entries" => dirs, "error" => nil})

      {:error, reason} ->
        Map.merge(base, %{"entries" => [], "error" => posix_message(reason, path)})
    end
  end

  # On Windows, `Path.dirname/1` stops at the drive root (e.g. `"C:/"` is its
  # own parent), so the picker would be trapped on one drive. Enumerate live
  # drives by probing `A:/` … `Z:/` and let the UI render them as switch
  # buttons. On non-Windows hosts there's a single root, so we return `[]`.
  defp available_drives do
    case :os.type() do
      {:win32, _} ->
        for letter <- ?A..?Z,
            drive = <<letter, ?:, ?/>>,
            match?({:ok, _}, File.ls(drive)),
            do: drive

      _ ->
        []
    end
  end

  defp directory?(path) do
    case File.stat(path) do
      {:ok, %{type: :directory}} -> true
      _ -> false
    end
  end

  defp parent_path(path) do
    case Path.dirname(path) do
      ^path -> nil
      parent -> parent
    end
  end

  defp posix_message(:enoent, path), do: "No such directory: #{path}"
  defp posix_message(:eacces, path), do: "Permission denied: #{path}"
  defp posix_message(:enotdir, path), do: "Not a directory: #{path}"
  defp posix_message(reason, path), do: "#{inspect(reason)}: #{path}"

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
  def to_attrs(ctx), do: Map.take(ctx.assigns, [:backend, :values])

  @impl true
  def to_source(%{values: values}) do
    blocks =
      for {backend, fields} <- values,
          opts = coerce_values_for(backend, fields) ++ extra_options(backend, fields),
          opts != [] do
        render_put_env(backend, opts)
      end

    case blocks do
      [] -> "# ATP Backend Configuration: no values set yet.\n"
      list -> Enum.join(list, "\n")
    end
  end

  def to_source(_), do: "# ATP Backend Configuration: no values set yet.\n"

  defp render_put_env(backend, opts) do
    key = String.to_existing_atom(backend)

    """
    Application.put_env(:atp_client, #{inspect(key)}, #{inspect(opts, pretty: true)})
    """
  end

  # ─── Schema payload (atoms → strings, JSON-safe) ─────────────────────────

  defp backends_payload do
    for module <- AtpClient.backends() do
      %{"key" => Atom.to_string(module.config_key()), "label" => module.label()}
    end
  end

  # Per-backend banner shown above the form. Currently only Isabelle has one:
  # when `isabelle` is reachable locally, the form fields are optional.
  defp backend_notices do
    %{"isabelle" => isabelle_notice()}
  end

  defp isabelle_notice do
    case KinoAtpClient.IsabelleRuntime.available?() do
      :ok ->
        %{
          "kind" => "info",
          "message" =>
            "A local Isabelle executable is available — the cell will auto-spawn a server " <>
              "and a HOL session on first use, with no further setup. Fill the fields below " <>
              "only if you want to connect to a remote Isabelle server instead."
        }

      {:error, _} ->
        %{
          "kind" => "warn",
          "message" =>
            "No local Isabelle executable found on PATH. Either set ISABELLE_TOOL / install " <>
              "Isabelle, or fill in the connection fields below to use a remote server."
        }
    end
  end

  defp schemas_payload do
    for module <- AtpClient.backends(), into: %{} do
      {Atom.to_string(module.config_key()), Enum.map(module.config_schema(), &field_payload/1)}
    end
  end

  defp field_payload(%AtpClient.Config.Field{} = field) do
    %{
      "key" => Atom.to_string(field.key),
      "type" => Atom.to_string(field.type),
      "required" => field.required?,
      "group" => Atom.to_string(field.group),
      "default" => encode_default(field.default),
      "label" => field.label || humanize(field.key),
      "doc" => field.doc,
      "secret" => field.secret?
    }
  end

  defp encode_default(nil), do: nil
  defp encode_default(value) when is_list(value), do: value

  defp encode_default(value) when is_binary(value) or is_number(value) or is_boolean(value),
    do: value

  defp encode_default(value), do: to_string(value)

  defp humanize(key) do
    key |> Atom.to_string() |> String.replace("_", " ") |> String.capitalize()
  end

  # ─── Coercion: JS-typed values → Elixir-typed for put_env/verify ─────────

  defp backend_module(backend) do
    Enum.find(AtpClient.backends(), fn module ->
      Atom.to_string(module.config_key()) == backend
    end)
  end

  defp coerce_values_for(backend, raw_values) do
    case backend_module(backend) do
      nil ->
        []

      module ->
        for field <- module.config_schema(),
            value = Map.get(raw_values, Atom.to_string(field.key)),
            keep_value?(value),
            do: {field.key, coerce_value(field.type, value)}
    end
  end

  # UI-only extras → Elixir keyword fragments merged into both `verify` opts
  # and the generated `Application.put_env/3` blocks.
  defp extra_options("starexec", %{"insecure_tls" => flag}) when flag in [true, "true"],
    do: [connect_options: [transport_opts: [verify: :verify_none]]]

  defp extra_options(_backend, _values), do: []

  defp keep_value?(nil), do: false
  defp keep_value?(""), do: false
  defp keep_value?([]), do: false
  defp keep_value?(_), do: true

  defp coerce_value(:integer, value) when is_integer(value), do: value
  defp coerce_value(:integer, value) when is_binary(value), do: parse_integer(value)
  defp coerce_value(:boolean, value) when is_boolean(value), do: value
  defp coerce_value(:boolean, "true"), do: true
  defp coerce_value(:boolean, "false"), do: false
  defp coerce_value(:string_list, value) when is_list(value), do: value

  defp coerce_value(:string_list, value) when is_binary(value) do
    value
    |> String.split(~r/[\s,]+/, trim: true)
  end

  defp coerce_value(:string, value), do: to_string(value)
  defp coerce_value(_, value), do: value

  defp parse_integer(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> value
    end
  end
end
