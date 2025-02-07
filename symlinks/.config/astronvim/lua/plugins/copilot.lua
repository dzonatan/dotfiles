return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = "User AstroFile",
    opts = {
      suggestion = { auto_trigger = true, debounce = 151 },
      filetypes = { markdown = true },
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
      model = "claude-3.5-sonnet",
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
