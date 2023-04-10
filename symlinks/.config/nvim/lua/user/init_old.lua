--              AstroNvim Configuration Table
-- All configuration changes should go inside of the table below

local config = {
  -- Mapping data with "desc" stored directly by vim.keymap.set().
  --
  -- Please use this mappings table to set keyboard mapping since this is the
  -- lower level configuration and more robust one. (which-key will
  -- automatically pick-up stored data by this setting.)
  mappings = {
    n = {
      ["<leader>rr"] = { function() require('spectre').open() end, desc = "Replace" },
      ["<leader>rw"] = { function() require('spectre').open_visual({ select_word = true }) end,
        desc = "Replace Word" },
      ["<leader>rf"] = { function() require('spectre').open_file_search() end, desc = "Replace Buffer" },
    },
  },

  plugins = {
    init = {
      -- find & replace project wide
      ["windwp/nvim-spectre"] = {},

      { "tpope/vim-surround", keys = { "c", "d", "y" } },

      -- lsp status
      { 'j-hui/fidget.nvim' },
    },


    -- All other entries override the require("<key>").setup({...}) call for default plugins

    -- ["null-ls"] = function(config) -- overrides `require("null-ls").setup(config)`
    --   -- config variable is the default configuration table for the setup functino call
    --   local null_ls = require "null-ls"
      -- config.debug = true
      --
      -- Check supported formatters and linters
      -- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/formatting
      -- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/diagnostics
      -- config.sources = {
      --   -- Set a formatter that is manually installed
      --   null_ls.builtins.formatting.prettierd.with({
      --     only_local = "node_modules/.bin",
      --   }),
      -- }
    --   return config -- return final config table to use in require("null-ls").setup(config)
    -- end,

    telescope = {
      defaults = {
        file_ignore_patterns = { ".git/" },
      },
      pickers = {
        live_grep = {
          additional_args = function()
            return { "--hidden" }
          end
        },
      }
    },
  },

  ["which-key"] = {
    register = function(default_register)
      default_register.n["<leader>"].f = nil
      return vim.tbl_deep_extend("force", default_register, {
        n = {
          ["<leader>"] = {
            ["r"] = { name = "Find & Replace" },
          },
        },
      })
    end,
  },
}

return config
