lvim.lsp.automatic_servers_installation = true
lvim.lsp.diagnostics.virtual_text = false

--
-- lsp servers
--
local utils = require "my.utils"

-- Activate LunarVim angular lsp configuration only
-- if project seems to have a tailwindcss dependency
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
end

-- Activate LunarVim tailwindcss lsp configuration only
-- if project seems to have a tailwindcss dependency
if (vim.fn.glob "tailwind*" ~= "" or utils.is_in_package_json "tailwindcss") then
  require("lvim.lsp.manager").setup "tailwindcss"
end


--
-- formatters
--
local formatters = require "lvim.lsp.null-ls.formatters"
local formatters_table = {}
if (vim.fn.glob ".prettierrc*" ~= "" or utils.is_in_package_json "prettier") then
  table.insert(formatters_table, {
    exe = "prettier",
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
    exe = "prettier",
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

-- local null_ls = require("null-ls")
-- null_ls.setup({
--   sources = {
--     null_ls.builtins.code_actions.eslint.with({
--       command = "eslint",
--       extra_args = { "--fix" },
--       filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
--     }),
--     null_ls.builtins.diagnostics.eslint.with({
--       prefer_local = "node_modules/.bin",
--     }),
--     null_ls.builtins.formatting.prettier.with({
--       prefer_local = "node_modules/.bin",
--     }),
--   },
-- })

-- ---@usage Select which servers should be configured manually. Requires `:LvimCacheRest` to take effect.
-- See the full default list `:lua print(vim.inspect(lvim.lsp.override))`
-- vim.list_extend(lvim.lsp.override, { "pyright" })

-- ---@usage setup a server -- see: https://www.lunarvim.org/languages/#overriding-the-default-configuration
-- local opts = {} -- check the lspconfig documentation for a list of all possible options
-- require("lvim.lsp.manager").setup("pylsp", opts)

-- require("lvim.lsp.manager").setup("tailwindcss", {})
--require("lvim.lsp.manager").setup("angularls", {})

-- you can set a custom on_attach function that will be used for all the language servers
-- See <https://github.com/neovim/nvim-lspconfig#keybindings-and-completion>
-- lvim.lsp.on_attach_callback = function(client, bufnr)
--   local function buf_set_option(...)
--     vim.api.nvim_buf_set_option(bufnr, ...)
--   end
--   --Enable completion triggered by <c-x><c-o>
--   buf_set_option("omnifunc", "v:lua.vim.lsp.omnifunc")
-- end
-- you can overwrite the null_ls setup table (useful for setting the root_dir function)
-- lvim.lsp.null_ls.setup = {
--   root_dir = require("lspconfig").util.root_pattern("Makefile", ".git", "node_modules"),
-- }
-- or if you need something more advanced
-- lvim.lsp.null_ls.setup.root_dir = function(fname)
--   if vim.bo.filetype == "javascript" then
--     return require("lspconfig/util").root_pattern("Makefile", ".git", "node_modules")(fname)
--       or require("lspconfig/util").path.dirname(fname)
--   elseif vim.bo.filetype == "php" then
--     return require("lspconfig/util").root_pattern("Makefile", ".git", "composer.json")(fname) or vim.fn.getcwd()
--   else
--     return require("lspconfig/util").root_pattern("Makefile", ".git")(fname) or require("lspconfig/util").path.dirname(fname)
--   end
-- end

-- -- set a formatter, this will override the language server formatting capabilities (if it exists)
-- local formatters = require "lvim.lsp.null-ls.formatters"
-- formatters.setup {
--   {
--     exe = "prettier",
--   },
-- }

-- -- set additional linters
local linters = require "lvim.lsp.null-ls.linters"
linters.setup {
  { exe = "eslint", filetypes = { "typescript", "javascript"} }
--   { exe = "flake8", filetypes = { "python" } },
--   {
--     exe = "shellcheck",
--     ---@usage arguments to pass to the formatter
--     -- these cannot contain whitespaces, options such as `--line-width 80` become either `{'--line-width', '80'}` or `{'--line-width=80'}`
--     args = { "--severity", "warning" },
--   },
--   {
--     exe = "codespell",
--     ---@usage specify which filetypes to enable. By default a providers will attach to all the filetypes it supports.
--     filetypes = { "javascript", "python" },
--   },
}

-- linters.setup {
--   { command = "black" },
--   {
--     command = "eslint_d",
--     ---@usage specify which filetypes to enable. By default a providers will attach to all the filetypes it supports.
--     filetypes = { "javascript", "javascriptreact" },
--   },
-- }

-- Autocommands (https://neovim.io/doc/user/autocmd.html)
-- lvim.autocommands.custom_groups = {
--   { "BufWinEnter", "*.lua", "setlocal ts=8 sw=8" },
-- }
