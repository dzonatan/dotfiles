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

  use {
    'ThePrimeagen/refactoring.nvim',
    requires = {
      {'nvim-lua/plenary.nvim'},
      {'nvim-treesitter/nvim-treesitter'}
    }
  }
end)
