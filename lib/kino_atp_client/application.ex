defmodule KinoAtpClient.Application do
  use Application

  @impl true
  def start(_type, _args) do
    Kino.SmartCell.register(KinoAtpClient.AtpSolver)
    Kino.SmartCell.register(KinoAtpClient.BackendConfig)

    children = [
      KinoAtpClient.IsabelleRuntime
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: __MODULE__)
  end
end
