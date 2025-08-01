function TwoFolderPathFileFormat(item, picker)
  -- Format the file path to always show the first two directories instead of one (default)
  -- this is useful for monorepos
  local defaultFormat = require("snacks.picker.format").file(item, picker)
  local pathParts = vim.split(item.file, "/")
  if #pathParts > 3 then
    local twoFolders = pathParts[1] .. "/" .. pathParts[2]
    -- the second part of the path is always a folder
    defaultFormat[2][1] = defaultFormat[2][1]:gsub(vim.pesc(pathParts[1]), twoFolders, 1)
  end
  return defaultFormat
end

---@type LazySpec
return {
  {
    "folke/snacks.nvim",
    opts = {
      dashboard = {
        preset = {
          header = table.concat({
            "███    ██ ██    ██ ██ ███    ███",
            "████   ██ ██    ██ ██ ████  ████",
            "██ ██  ██ ██    ██ ██ ██ ████ ██",
            "██  ██ ██  ██  ██  ██ ██  ██  ██",
            "██   ████   ████   ██ ██      ██",
          }, "\n"),
        },
      },
      picker = {
        sources = {
          files = {
            format = TwoFolderPathFileFormat,
          },
          grep = {
            format = TwoFolderPathFileFormat,
          },
        },
      },
    },
  },

  {
    "max397574/better-escape.nvim",
    config = function()
      require("better_escape").setup {
        default_mappings = false,
        mappings = {
          i = {
            k = {
              j = "<Esc>",
            },
            j = {
              k = "<Esc>",
            },
          },
        },
      }
    end,
  },

  {
    "ThePrimeagen/harpoon",
    branch = "harpoon2",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function() require("harpoon").setup() end,
  },

  {
    "stevearc/oil.nvim",
    ---@module 'oil'
    ---@type oil.SetupOpts
    opts = {},
    -- Optional dependencies
    dependencies = { { "echasnovski/mini.icons", opts = {} } },
    -- dependencies = { "nvim-tree/nvim-web-devicons" }, -- use if prefer nvim-web-devicons
  },

  {
    "kylechui/nvim-surround",
    version = "^3.0.0", -- Use for stability; omit to use `main` branch for the latest features
    event = "VeryLazy",
    config = function()
      require("nvim-surround").setup {
        -- Configuration here, or leave empty to use defaults
      }
    end,
  },
}
