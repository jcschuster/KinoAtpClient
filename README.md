# KinoAtpClient

This package provides custom Smart Cells for connecting to external provers on
SystemOnTptp via the [`atp_client`](https://hexdocs.pm/atp_client) package.

## Installation

Add `kino_atp_client` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:kino_atp_client, "~> 0.1"}
  ]
end
```

## Usage

Install the package with `Mix.install([{:kino_atp_client, "~> 0.1"}])` in your
Livebook. After that, `SystemOnTPTP` will be available as a Smart Cell.
