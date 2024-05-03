local function check_json_key_exists(filename, key)
  -- Open the file in read mode
  local file = io.open(filename, "r")
  if not file then
    return false -- File doesn't exist or cannot be opened
  end

  -- Read the contents of the file
  local content = file:read "*all"
  file:close()

  -- Parse the JSON content
  local json_parsed, json = pcall(vim.fn.json_decode, content)
  if not json_parsed or type(json) ~= "table" then
    return false -- Invalid JSON format
  end

  -- Check if the key exists in the JSON object
  return json[key] ~= nil
end

return {
  { "sainnhe/gruvbox-material" },

  { "ThePrimeagen/harpoon" },

  {
    "kylechui/nvim-surround",
    version = "*", -- Use for stability; omit to use `main` branch for the latest features
    event = "VeryLazy",
    config = function()
      require("nvim-surround").setup({
        -- Configuration here, or leave empty to use defaults
      })
    end
  },

  {
    "nvim-pack/nvim-spectre",
    cmd = "Spectre",
    keys = {
      { '<leader>r', desc = "Search / Replace", function() require("spectre").open() end },
    },
  },

  {
    "stevearc/dressing.nvim",
    opts = {
      input = {
        insert_only  = false,
      },
    }
  },

  {
    "jay-babu/mason-null-ls.nvim",
    opts = {
      handlers = {
        -- for prettierd
        prettierd = function()
          require("null-ls").register(require("null-ls").builtins.formatting.prettierd.with {
            condition = function(utils)
              return check_json_key_exists(vim.fn.getcwd() .. "/package.json", "prettier")
                or utils.root_has_file ".prettierrc"
                or utils.root_has_file ".prettierrc.json"
                or utils.root_has_file ".prettierrc.yml"
                or utils.root_has_file ".prettierrc.yaml"
                or utils.root_has_file ".prettierrc.json5"
                or utils.root_has_file ".prettierrc.js"
                or utils.root_has_file ".prettierrc.cjs"
                or utils.root_has_file "prettier.config.js"
                or utils.root_has_file ".prettierrc.mjs"
                or utils.root_has_file "prettier.config.mjs"
                or utils.root_has_file "prettier.config.cjs"
                or utils.root_has_file ".prettierrc.toml"
            end,
          })
        end,
        -- For eslint_d:
        eslint_d = function()
          require("null-ls").register(require("null-ls").builtins.diagnostics.eslint_d.with {
            condition = function(utils)
              return utils.root_has_file ".eslintrc.json"
                or utils.root_has_file ".eslintrc.js"
            end,
          })
        end,
      },
    },
  },

  {
    "max397574/better-escape.nvim",
    config = function()
      require("better_escape").setup {
        mapping = { "jk", "kj" },
      }
    end,
  },

  -- customize alpha options
  {
    "goolord/alpha-nvim",
    opts = function(_, opts)
      -- customize the dashboard header
      opts.section.header.val = {
        "    ███    ██ ██    ██ ██ ███    ███",
        "    ████   ██ ██    ██ ██ ████  ████",
        "    ██ ██  ██ ██    ██ ██ ██ ████ ██",
        "    ██  ██ ██  ██  ██  ██ ██  ██  ██",
        "    ██   ████   ████   ██ ██      ██",
      }
      return opts
    end,
  },

  {
    "nvim-telescope/telescope.nvim",
    config = function(plugin, opts)
      opts.defaults.file_ignore_patterns = { ".git/" }
      opts.pickers = {
        live_grep = {
          additional_args = function()
            return { "--hidden" }
          end
        },
      }
      require("plugins.configs.telescope")(plugin, opts)
    end,
  }

  -- You can disable default plugins as follows:
  -- { "max397574/better-escape.nvim", enabled = false },
  --
  -- You can also easily customize additional setup of plugins that is outside of the plugin's setup call
  -- {
  --   "L3MON4D3/LuaSnip",
  --   config = function(plugin, opts)
  --     require "plugins.configs.luasnip"(plugin, opts) -- include the default astronvim config that calls the setup call
  --     -- add more custom luasnip configuration such as filetype extend or custom snippets
  --     local luasnip = require "luasnip"
  --     luasnip.filetype_extend("javascript", { "javascriptreact" })
  --   end,
  -- },
  -- {
  --   "windwp/nvim-autopairs",
  --   config = function(plugin, opts)
  --     require "plugins.configs.nvim-autopairs"(plugin, opts) -- include the default astronvim config that calls the setup call
  --     -- add more custom autopairs configuration such as custom rules
  --     local npairs = require "nvim-autopairs"
  --     local Rule = require "nvim-autopairs.rule"
  --     local cond = require "nvim-autopairs.conds"
  --     npairs.add_rules(
  --       {
  --         Rule("$", "$", { "tex", "latex" })
  --           -- don't add a pair if the next character is %
  --           :with_pair(cond.not_after_regex "%%")
  --           -- don't add a pair if  the previous character is xxx
  --           :with_pair(
  --             cond.not_before_regex("xxx", 3)
  --           )
  --           -- don't move right when repeat character
  --           :with_move(cond.none())
  --           -- don't delete if the next character is xx
  --           :with_del(cond.not_after_regex "xx")
  --           -- disable adding a newline when you press <cr>
  --           :with_cr(cond.none()),
  --       },
  --       -- disable for .vim files, but it work for another filetypes
  --       Rule("a", "a", "-vim")
  --     )
  --   end,
  -- },
  -- By adding to the which-key config and using our helper function you can add more which-key registered bindings
  -- {
  --   "folke/which-key.nvim",
  --   config = function(plugin, opts)
  --     require "plugins.configs.which-key"(plugin, opts) -- include the default astronvim config that calls the setup call
  --     -- Add bindings which show up as group name
  --     local wk = require "which-key"
  --     -- wk.register({
  --     --   b = { name = "Buffer" },
  --     -- }, { mode = "n", prefix = "<leader>" })
  --   end,
  -- },
  -- {
  --   "folke/which-key.nvim",
  --   register = function(default_register)
  --     default_register.n["<leader>"].f = nil
  --     return vim.tbl_deep_extend("force", default_register, {
  --       n = {
  --         ["<leader>"] = {
  --           ["r"] = { name = "Find & Replace" },
  --         },
  --       },
  --     })
  --   end,
  -- },
}
