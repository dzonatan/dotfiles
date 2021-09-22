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

  use {
    'nvim-telescope/telescope.nvim',
    requires = { {'nvim-lua/plenary.nvim'} }
  }
end)
