require('packer').startup(function()
  use 'wbthomason/packer.nvim'

  use {
    'phaazon/hop.nvim',
    as = 'hop'
  }

  use {
    'nvim-treesitter/nvim-treesitter',
    run = ':TSUpdate'
  }
end)
