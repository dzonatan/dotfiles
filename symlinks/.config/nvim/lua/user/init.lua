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

  -- Mapping data with "desc" stored directly by vim.keymap.set().
  --
  -- Please use this mappings table to set keyboard mapping since this is the
  -- lower level configuration and more robust one. (which-key will
  -- automatically pick-up stored data by this setting.)
  mappings = {
    n = {
      ["<leader>p"] = { "<cmd>Telescope find_files<CR>", desc = "Find files" },
      ["<leader>P"] = { "<cmd>lua require('telescope.builtin').find_files({ cwd='%:p:h' })<CR>",
        desc = "Find relative file" },
      ["<leader>f"] = { "<cmd>Telescope live_grep<CR>", desc = "Live grep" },
      ["<leader>F"] = { "<cmd>Telescope resume<CR>", desc = "Resume last search" },

      -- harpoon
      ["<leader>a"] = { "<cmd>lua require('harpoon.mark').add_file()<CR>", desc = "Harpoon add file" },
      ["<leader>m"] = { "<cmd>lua require('harpoon.ui').toggle_quick_menu()<CR>", desc = "Harpoon quick menu" },
      ["<leader>j"] = { "<cmd>lua require('harpoon.ui').nav_prev()<CR>", desc = "Harpoon next file" },
      ["<leader>k"] = { "<cmd>lua require('harpoon.ui').nav_next()<CR>", desc = "Harpoon previous file" },

      ["<leader>rr"] = { "<cmd>lua require('spectre').open()<cr>", desc = "Replace" },
      ["<leader>rw"] = { "<cmd>lua require('spectre').open_visual({select_word=true})<cr>", desc = "Replace Word" },
      ["<leader>rf"] = { "<cmd>lua require('spectre').open_file_search()<cr>", desc = "Replace Buffer" },
    },
    i = {
      -- second key is the lefthand side of the map
      -- mappings seen under group name "Buffer"
      ["kj"] = { "<ESC>" },
    },
    v = {
      ["<leader>F"] = { "<cmd>lua require('user.telescope').live_grep_visual()<cr>", desc = "Live grep" },

      ["p"] = '"_dP',
    },
  },

  -- Diagnostics configuration (for vim.diagnostics.config({...})) when diagnostics are on
  diagnostics = {
    virtual_text = false,
    underline = true,
  },

  plugins = {
    init = {
      -- themes
      ["folke/tokyonight.nvim"] = {},
      ["sainnhe/gruvbox-material"] = {},
      -- find & replace project wide
      ["windwp/nvim-spectre"] = {},
    }
  },

  ["which-key"] = {
    -- Add bindings which show up as group name
    register = {
      n = {
        -- second key is the prefix, <leader> prefixes
        ["<leader>"] = {
          -- third key is the key to bring up next level and its displayed
          -- group name in which-key top level menu
          ["b"] = { name = "Buffer" },
        },
      },
    },
  },
}

return config
