--              AstroNvim Configuration Table
-- All configuration changes should go inside of the table below

local config = {
  -- Set colorscheme to use
  -- colorscheme = "tokyonight-moon",
  colorscheme = "gruvbox-material",

  -- Set dashboard header
  header = {
    "    ███    ██ ██    ██ ██ ███    ███",
    "    ████   ██ ██    ██ ██ ████  ████",
    "    ██ ██  ██ ██    ██ ██ ██ ████ ██",
    "    ██  ██ ██  ██  ██  ██ ██  ██  ██",
    "    ██   ████   ████   ██ ██      ██",
  },

  options = {
    opt = {
      wrap = true,
      list = true,
    },
  },

  -- set vim options here (vim.<first_key>.<second_key> =  value)
  -- options = {
  --   opt = {
  --     relativenumber = true, -- sets vim.opt.relativenumber
  --   },
  -- },

  -- Mapping data with "desc" stored directly by vim.keymap.set().
  --
  -- Please use this mappings table to set keyboard mapping since this is the
  -- lower level configuration and more robust one. (which-key will
  -- automatically pick-up stored data by this setting.)
  mappings = {
    n = {
      ["<leader>fw"] = false,
      ["<leader>fW"] = false,
      ["<leader>ff"] = false,
      ["<leader>fb"] = false,
      ["<leader>fh"] = false,
      ["<leader>fm"] = false,
      ["<leader>fo"] = false,
      ["<leader>fc"] = false,
      ["<leader>fF"] = false,
      ["<leader>fn"] = false,

      ["<leader>f"] = { function() require("telescope.builtin").find_files { hidden = true } end,
        desc = "Find files" },
      ["<leader>n"] = { function() require("telescope.builtin").find_files { cwd = '%:p:h', hidden = true } end,
        desc = "Find neighboring files" },
      ["<leader>F"] = { function() require("telescope.builtin").live_grep() end, desc = "Live grep" },
      ["<leader>R"] = { "<cmd>Telescope resume<CR>", desc = "Resume last search" },

      -- harpoon
      ["<leader>a"] = { function() require('harpoon.mark').add_file() end, desc = "Harpoon add file" },
      ["<leader>m"] = { function() require('harpoon.ui').toggle_quick_menu() end,
        desc = "Harpoon quick menu" },
      ["<leader>j"] = { function() require('harpoon.ui').nav_prev() end, desc = "Harpoon next file" },
      ["<leader>k"] = { function() require('harpoon.ui').nav_next() end, desc = "Harpoon previous file" },

      ["<leader>rr"] = { function() require('spectre').open() end, desc = "Replace" },
      ["<leader>rw"] = { function() require('spectre').open_visual({ select_word = true }) end,
        desc = "Replace Word" },
      ["<leader>rf"] = { function() require('spectre').open_file_search() end, desc = "Replace Buffer" },

      ["<leader>lj"] = { function() vim.diagnostic.goto_next() end, desc = "Next diagnostic" },

      ["<leader>bh"] = { "<cmd>BufferLineCloseLeft<cr>", desc = "Close buffers on the left" },
      ["<leader>bl"] = { "<cmd>BufferLineCloseRight<cr>", desc = "Close buffers on the right" },
    },
    i = {

    },
    v = {
      --find by text
      ["<leader>F"] = { function() require('user.telescope').live_grep_visual() end, desc = "Live grep" },

      -- don't put the replaced value to clipboard
      -- ["p"] = '"_dP',
    },
  },

  -- Diagnostics configuration (for vim.diagnostics.config({...})) when diagnostics are on
  diagnostics = {
    virtual_text = false,
    underline = true,
  },

  lsp = {
    formatting = {
      format_on_save = false, -- enable or disable automatic formatting on save
    },
  },

  plugins = {
    init = {
      -- themes
      ["folke/tokyonight.nvim"] = {},
      ["sainnhe/gruvbox-material"] = {},

      -- find & replace project wide
      ["windwp/nvim-spectre"] = {},

      { "ThePrimeagen/harpoon" },
      { "tpope/vim-surround", keys = { "c", "d", "y" } },

      -- lsp status
      { 'j-hui/fidget.nvim' },
    },

    -- All other entries override the require("<key>").setup({...}) call for default plugins

    ["neo-tree"] = {
      window = {
        width = 50,
        mappings = {
          ["l"] = "open",
          ["h"] = "close_node",
        },
      },
      source_selector = {
        winbar = false
      },
    },

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

    better_escape = {
      mapping = { "jk", "kj" },
    }
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

  ["mason-null-ls"] = {
    setup_handlers = {
      prettierd = function()
        require("null-ls").register(require("null-ls").builtins.formatting.prettierd.with({
          condition = function(utils)
            return utils.root_has_file("package.json") or utils.root_has_file(".prettierrc") or
                utils.root_has_file(".prettierrc.json") or utils.root_has_file(".prettierrc.js")
          end
        }))
      end,
      -- eslint_d = function()
      --   require("null-ls").register(require("null-ls").builtins.diagnostics.eslint_d.with({
      --     condition = function(utils)
      --       return utils.root_has_file("package.json") or utils.root_has_file(".eslintrc.json") or
      --           utils.root_has_file(".eslintrc.js")
      --     end
      --   }))
      -- end,
    }
  },

  -- This function is run last and is a good place to configuring
  -- augroups/autocommands and custom filetypes also this just pure lua so
  -- anything that doesn't fit in the normal config locations above can go here
  polish = function()
    -- ...
    vim.opt.listchars:append("trail:•")
  end,
}

return config
