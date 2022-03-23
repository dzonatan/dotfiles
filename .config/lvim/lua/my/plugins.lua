-- Additional Plugins (After changing exit and reopen LunarVim, Run :PackerInstall :PackerCompile)
lvim.plugins = {
  -- theme
  { "sainnhe/gruvbox-material" },

  -- surround
  { "tpope/vim-surround", keys = {"c", "d", "y"} },

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
}

