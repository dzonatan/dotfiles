local opt = vim.opt  -- to set options
local cmd = vim.cmd  -- to execute Vim commands e.g. cmd('pwd')
local map = vim.api.nvim_set_keymap -- to map keys

-----------------------------------------------
------------------- OPTIONS -------------------
-----------------------------------------------
cmd 'colorscheme gruvbox'           -- Put your favorite colorscheme here

opt.clipboard = 'unnamed'           -- Yank and paste with the system clipboard
opt.showcmd = true                  -- Show incomplete commands
opt.number  = true                  -- Show line numbers
opt.relativenumber = true           -- Relative line numbers
opt.showmatch = true                -- Show matching braces
opt.autoread = true                 -- Auto read file if file was changed outside of vim
opt.ignorecase = true               -- Case insensitive searching
opt.smartcase = true                -- Case-sensitive if expresson contains a capital letter
opt.hlsearch = true                 -- Highlight search results
opt.incsearch = true                -- Set incremental search, like modern browsers
opt.expandtab = true                -- Insert spaces when TAB is pressed.
opt.hidden = true                   -- Current buffer can be put into background
opt.list = true                     -- Toggle invisible characters
opt.listchars = { tab = '→ ', trail = '⋅', nbsp = '⋅', extends = '❯', precedes = '❮' }
opt.splitbelow = true               -- Horizontal splits will automatically be below
opt.splitright = true               -- Vertical splits will automatically be to the right
opt.termguicolors = true
opt.cmdheight = 2                   -- Command bar height
opt.softtabstop = 2                 -- Change number of spaces that a <Tab> counts for during editing ops
opt.shiftwidth = 2                  -- Indentation amount for < and > commands.
opt.backupcopy = 'yes'              -- Do not delete file when saving (storybook looses pointer)
opt.showbreak = '↪'                 -- Change break lines symbol
opt.laststatus = 2                  -- Show the status line all the time
opt.background = 'dark'

cmd('set noshowmode')               -- Don't show which mode disabled for PowerLine
cmd('set shortmess+=c')             -- Don't pass messages to |ins-completion-menu|

------------------------------------------------
------------------- MAPPINGS -------------------
------------------------------------------------
-- Use space as a leader key
map('n', '<Space>', '<Nop>', { noremap = true })
vim.g.mapleader = ' '

-- Better escape
map('i', 'kj', '<Esc>', { noremap = true })
map('i', 'jk', '<Esc>', { noremap = true })
map('c', 'kj', '<Esc>', { noremap = true })
map('c', 'jk', '<Esc>', { noremap = true })

-- Next/previous buffer in list
map('n', '<C-h>', ':bp<CR>', { noremap = true, silent = true })
map('n', '<C-l>', ':bn<CR>', { noremap = true, silent = true })

-- Next/previous in quickfix list
map('n', '<C-j>', ':cnext<CR>zz', { noremap = true })
map('n', '<C-k>', ':cprevious<CR>zz', { noremap = true })

-- Remember selection after indentation
map('v', '<', '<gv', { noremap = true })
map('v', '>', '>gv', { noremap = true })

-- Clear last search with <Esc>
map('n', '<Esc>', ':nohl<CR>', {})

-- Hop/easy-motion
map('n', '<Leader>e', "<cmd>lua require'hop'.hint_words()<CR>", {})

-- Use // to search for visually selected text
--map('v', '//', 'y/V<C-R>=escape(@",\'/\')<CR><CR>', { noremap = true })

-------------------------------------------------------
------------------- PLUGIN SETTINGS -------------------
-------------------------------------------------------
-- hop
require'hop'.setup()

-- treesitter
require "nvim-treesitter.configs".setup {
  ensure_installed = {"typescript", "javascript", "html", "lua", "regex", "scss", "bash", "yaml", "vue", "tsx"}, -- one of "all", "maintained" (parsers with maintainers), or a list of languages
  highlight = {
    enable = true
  }
}
