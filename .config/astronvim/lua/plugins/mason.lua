---@type LazySpec
return {
  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    opts = {
      ensure_installed = {
        -- web dev
        "angular-language-server",
        "tailwindcss-language-server",
        "yaml-language-server",
        "vtsls",
        "css-lsp",
        "html-lsp",
        "prettierd",

        -- ide
        "lua-language-server",
        "stylua",
      },
    },
  },
}
