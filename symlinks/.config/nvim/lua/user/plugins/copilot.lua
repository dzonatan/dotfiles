return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = "InsertEnter",
    config = function()
      vim.schedule(function()
        require("copilot").setup({
          suggestion = {
            auto_trigger = true
          },
          filetypes = {
            markdown = true,
          },
        })
      end, 100)
    end,
  },
}
