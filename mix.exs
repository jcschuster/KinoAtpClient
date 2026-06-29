defmodule KinoAtpClient.MixProject do
  use Mix.Project

  @version "0.2.1"
  @source_url "https://github.com/jcschuster/KinoAtpClient"

  def project do
    [
      app: :kino_atp_client,
      description:
        "Livebook Smart Cells for AtpClient: a unified frontend over SystemOnTPTP, " <>
          "StarExec, Isabelle, and local TPTP-compliant prover binaries.",
      version: @version,
      elixir: "~> 1.19",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      package: package(),
      name: "KinoAtpClient",
      source_url: @source_url,
      docs: docs()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {KinoAtpClient.Application, []}
    ]
  end

  defp deps do
    [
      {:kino, "~> 0.19"},
      {:atp_client, "~> 0.3"},
      {:ex_doc, "~> 0.40", only: :dev, runtime: false},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false}
    ]
  end

  defp package do
    [
      licenses: ["MIT"],
      links: %{"GitHub" => @source_url},
      files: ~w(lib examples mix.exs README* LICENSE*)
    ]
  end

  defp docs do
    [
      main: "KinoAtpClient",
      extras: ["README.md", "examples/demo.livemd"],
      source_url: @source_url,
      source_ref: "v#{@version}"
    ]
  end
end
