return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = "User AstroFile",
    opts = {
      suggestion = { auto_trigger = true },
      filetypes = { markdown = true },
      copilot_model = "gpt-41-copilot",
    },
  },
}
