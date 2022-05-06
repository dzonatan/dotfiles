lvim.lsp.automatic_servers_installation = true
lvim.lsp.diagnostics.virtual_text = false

-----------------
-- lsp servers --
-----------------
local utils = require "my.utils"

-- Activate LunarVim angular lsp configuration only
-- if project seems to have a angular dependency
if (vim.fn.glob "angular*" ~= "" or utils.is_in_package_json "angular") then
  -- we don't want to pollute every project with angular language service dependencies, take it from the global
  local handle = io.popen('npm root -g')
  local global_node_modules = handle:read("*a")
  handle:close()
  -- local global_node_modules = "/usr/local/lib/node_modules/@angular/language-service"
  local cmd = {"ngserver", "--stdio", "--tsProbeLocations", global_node_modules , "--ngProbeLocations", global_node_modules}
  require("lvim.lsp.manager").setup("angularls", {
    cmd = cmd,
    on_new_config = function(new_config)
      new_config.cmd = cmd
    end,
  })

  -- turn off rename for tsserver as it conflicts with angularls
  lvim.lsp.on_attach_callback = function(client)
    if client.name == 'tsserver' then
      client.resolved_capabilities.rename = false
    end
  end
end

-- Activate LunarVim tailwindcss lsp configuration only
-- if project seems to have a tailwindcss dependency
if (vim.fn.glob "tailwind*" ~= "" or utils.is_in_package_json "tailwindcss") then
  require("lvim.lsp.manager").setup "tailwindcss"
end

----------------
-- formatters --
----------------
local formatters = require "lvim.lsp.null-ls.formatters"
local formatters_table = {
  { command = "eslint_d", filetypes = { "typescript", "javascript"} }
}
if (vim.fn.glob ".prettierrc*" ~= "" or utils.is_in_package_json "prettier") then
  table.insert(formatters_table, {
    exe = "prettierd",
    args = { "--end-of-line", "lf" },
    filetypes = {
      "html",
      "javascript",
      "javascriptreact",
      "json",
      "markdown",
      "svelte",
      "typescript",
      "typescriptreact",
      "vue",
      "yaml",
      "scss"
    },
  })
else
  table.insert(formatters_table, {
    exe = "prettierd",
    args = { "--end-of-line", "lf" },
    filetypes = {
      "html",
      "json",
      "markdown",
      "yaml",
    },
  })
end
formatters.setup(formatters_table)

-------------
-- linters --
-------------
local linters = require "lvim.lsp.null-ls.linters"
linters.setup {
  { exe = "eslint_d", filetypes = { "typescript", "javascript"} }
}
