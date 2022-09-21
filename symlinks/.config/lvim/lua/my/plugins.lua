-- Additional Plugins (After changing exit and reopen LunarVim, Run :PackerInstall :PackerCompile)
lvim.plugins = {
  -- theme
  { "sainnhe/gruvbox-material" },

  -- surround
  { "tpope/vim-surround", keys = { "c", "d", "y" } },

  -- MDX support
  { "jxnblk/vim-mdx-js" },

  -- Global find and replace
  {
    "windwp/nvim-spectre",
    event = "BufRead",
    config = function()
      require("spectre").setup()
    end,
  },

  -- lsp status
  { 'j-hui/fidget.nvim' },

  -- nicer code actions (telescope no longer support lsp actions)
  -- might not be needed in the future if LunarVim improves this natively
  { 'stevearc/dressing.nvim' },

  -- debugger
  {
    "rcarriga/nvim-dap-ui",
    requires = { "mfussenegger/nvim-dap" },
    config = function()
      require("dapui").setup()
    end
  },
}

require('lvim.lsp.manager').setup('emmet_ls')

require "fidget".setup {}
