return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = "User AstroFile",
    opts = {
      suggestion = { auto_trigger = true },
      filetypes = { markdown = true },
      copilot_model = "gpt-4o-copilot",
    },
  },

  {
    "olimorris/codecompanion.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {
      strategies = {
        chat = {
          adapter = "copilot",
        },
        inline = {
          adapter = "copilot",
        },
      },
      adapters = {
        http = {
          copilot = function()
            return require("codecompanion.adapters").extend("copilot", {
              name = "copilot",
              schema = {
                model = {
                  default = "gpt-4.1",
                },
              },
            })
          end,
        },
      },
    },
  },

  {
    "CopilotC-Nvim/CopilotChat.nvim",
    dependencies = {
      -- { "zbirenbaum/copilot.lua" },
      { "nvim-lua/plenary.nvim", branch = "master" }, -- for curl, log and async functions
    },
    build = "make tiktoken", -- Only on MacOS or Linux
    opts = {
      -- set default model
      model = "gpt-4.1", --"claude-3.7-sonnet",
      contexts = {
        -- custom contexts
        fileg = {
          description = "Includes content of all files matched by glob pattern.",
          resolve = function(input)
            -- input is expected to be a glob pattern (e.g. foo/bar/**/*)
            local context = require "CopilotChat.context"
            local files = vim.fn.glob(input, false, true)
            local out = {}
            for _, file in ipairs(files) do
              -- Check if file exists and is readable
              if vim.fn.filereadable(file) == 1 then table.insert(out, context.file(file)) end
            end
            return out
          end,
        },
      },
    },
  },
}
