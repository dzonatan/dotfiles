-- turn off virtual lsp diagnostics
lvim.lsp.diagnostics.virtual_text = false

-----------------
-- lsp servers --
-----------------
local utils = require "my.utils"

-- schedule needed because of https://github.com/LunarVim/LunarVim/issues/3415
vim.schedule(function()
  -- enable Angular LSP
  require("lvim.lsp.manager").setup("angularls")

  -- enable emmet ls
  require('lvim.lsp.manager').setup('emmet_ls')
end)

-- turn off rename for tsserver as it conflicts with angularls
lvim.lsp.on_attach_callback = function(client)
  if client.name == 'tsserver' then
    client.server_capabilities.renameProvider = false
  end
end

-- if (vim.fn.glob ".eslintrc.json" ~= "") then
--   require("lvim.lsp.manager").setup "eslint"
-- end

----------------
-- formatters --
----------------
local formatters = require "lvim.lsp.null-ls.formatters"
local formatters_table = {}

if (vim.fn.glob ".prettierrc*" ~= "" or utils.is_in_package_json "prettier") then
  local prettierArgs = {}

  if (utils.is_in_package_json "prettier") then
    local prettierPath = vim.fn.getcwd() .. "/node_modules/.bin/prettier"
    prettierArgs = { "--pretier-path", prettierPath }
  end

  table.insert(formatters_table, {
    exe = "prettier_d_slim",
    args = prettierArgs,
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
  -- else
  --   table.insert(formatters_table, {
  --     exe = "prettier_d_slim",
  --     args = { "--end-of-line", "lf" },
  --     filetypes = {
  --       "html",
  --       "json",
  --       "markdown",
  --       "yaml",
  --     },
  --   })
end


table.insert(formatters_table, {
  command = "rustfmt",
  filetypes = { "rust" },
})

-- if (vim.fn.glob ".eslintrc.json" ~= "") then
--   table.insert(formatters_table, { command = "eslint_d", filetypes = { "typescript", "javascript" } })
-- end

formatters.setup(formatters_table)

-------------
-- linters --
-------------
local linters = require "lvim.lsp.null-ls.linters"
local linters_table = {}

-- if (vim.fn.glob ".eslintrc.json" ~= "") then
-- vim.fn.setenv('ESLINT_D_LOCAL_ESLINT_ONLY', 1)
-- table.insert(linters_table, { exe = "eslint_d", filetypes = { "typescript", "javascript" } })
-- end

linters.setup(linters_table)

------------------
-- code actions --
------------------
local code_actions = require "lvim.lsp.null-ls.code_actions"
local code_actions_table = {}

if (vim.fn.glob ".eslintrc.json" ~= "") then
  table.insert(code_actions_table, { exe = "eslint_d", filetypes = { "typescript", "javascript" } })
end

code_actions.setup(code_actions_table)
