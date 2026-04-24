defmodule KinoAtpClient.MixProject do
  use Mix.Project

  @version "0.1.2"
  @source_url "https://github.com/jcschuster/KinoAtpClient"

  def project do
    [
      app: :kino_atp_client,
      description: "Provides a Smart Cell for querying external provers on SystemOnTPTP.",
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
      {:atp_client, "~> 0.1.3"},
      {:ex_doc, "~> 0.40"}
    ]
  end

  defp package do
    [
      licenses: ["MIT"],
      links: %{"GitHub" => @source_url},
      files: ~w(lib mix.exs README* LICENSE*)
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
