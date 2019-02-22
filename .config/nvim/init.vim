" ============================================================================ "
" ===                           PLUGIN SETUP                               === "
" ============================================================================ "

call plug#begin('~/.vim/vendor')
  Plug 'neoclide/coc.nvim', {'branch': 'release'}
  Plug 'scrooloose/nerdtree'
  Plug 'easymotion/vim-easymotion'
  "Plug '/usr/local/opt/fzf'
  Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
  Plug 'junegunn/fzf.vim'
  Plug 'antoinemadec/coc-fzf'
  Plug 'vim-airline/vim-airline'
  Plug 'vim-airline/vim-airline-themes'
  Plug 'tpope/vim-surround'
  Plug 'scrooloose/nerdcommenter'
  Plug 'mhartington/oceanic-next'
  Plug 'morhetz/gruvbox' " theme
  Plug 'sheerun/vim-polyglot'
  Plug 'leafgarland/typescript-vim'
  Plug 'mattn/emmet-vim'
  Plug 'unblevable/quick-scope' " Highlight f, F jumps.
  Plug 'jremmen/vim-ripgrep'
  Plug 'tpope/vim-fugitive' " git plugin
  Plug 'liuchengxu/vim-which-key'
  Plug 'honza/vim-snippets'
  Plug 'jtmkrueger/vim-c-cr' " expand {} [] () with <c-cr>
  "Plug 'justinmk/vim-sneak'
  "Plug 'Shougo/denite.nvim', { 'do': ':UpdateRemotePlugins' } " Fuzzy finding, buffer management
call plug#end()

" ============================================================================ "
" ===                           GENERAL OPTIONS                            === "
" ============================================================================ "

set clipboard=unnamed " Yank and paste with the system clipboard
set number " Show line numbers
set relativenumber " Show relative lie numbers
set laststatus=2 " Show the status line all the time
set showcmd " Show incomplete commands
set noshowmode " Don't show which mode disabled for PowerLine
set cmdheight=1 " Command bar height
set showmatch " Show matching braces
set autoread " Auto read file if file was changed outside of vim
set ignorecase " Case insensitive searching
set smartcase " Case-sensitive if expresson contains a capital letter
set hlsearch " Highlight search results
set incsearch " Set incremental search, like modern browsers
set expandtab " Insert spaces when TAB is pressed.
set softtabstop=2 " Change number of spaces that a <Tab> counts for during editing ops
set shiftwidth=2 " Indentation amount for < and > commands.
set hidden " Current buffer can be put into background
set list " Toggle invisible characters
set listchars=tab:→\ ,trail:⋅,nbsp:·,extends:❯,precedes:❮
set shortmess+=c " Don't pass messages to |ins-completion-menu|
set laststatus=2 " Show the status line all the time
set splitbelow " Horizontal splits will automatically be below
set splitright " Vertical splits will automatically be to the right
set showbreak=↪ " Change break lines symbol
set termguicolors
set background=dark
"colorscheme OceanicNext
colorscheme gruvbox

" ============================================================================ "
" ===                             KEY MAPPINGS                             === "
" ============================================================================ "

" Remap leader key to <Space>
nnoremap <Space> <Nop>
let g:mapleader="\<Space>"
"
" Define prefix dictionary
let g:which_key_map =  {} 

" Better escape
inoremap kj <esc>
inoremap jk <esc>
cnoremap kj <esc>
cnoremap jk <esc>

" Better indenting
vnoremap < <gv
vnoremap > >gv

" Split panes 
nnoremap <c-j> <c-w><c-j>
nnoremap <c-k> <c-w><c-k>
nnoremap <c-l> <c-w><c-l>
nnoremap <c-h> <c-w><c-h>

" Use alt + hjkl to resize windows
nnoremap <silent> ∆    :resize -2<CR>
nnoremap <silent> ˚    :resize +2<CR>
nnoremap <silent> ˙    :vertical resize -2<CR>
nnoremap <silent> ¬    :vertical resize +2<CR>

" Move lines up down with J and K in visual
vnoremap J :m '>+1<CR>gv=gv
vnoremap K :m '<-2<CR>gv=gv

" Insert line above but keep in normal mode
"nnoremap <leader>o <Esc>o<Esc>k$
"nnoremap <leader>O <Esc>O<Esc>j$

" Next/previous buffer in list
nnoremap <silent> <c-w> :bn<CR>
nnoremap <silent> <c-q> :bp<CR>

" Toggle selection comment
vmap / <Plug>NERDCommenterToggle

" Single mappings
let g:which_key_map['w'] = [ 'w', 'write' ]
let g:which_key_map['q'] = [ 'q', 'quit' ]
let g:which_key_map[';'] = [ ':Commands', 'commands' ]
"let g:which_key_map['d'] = [ ':bd', 'delete buffer' ]
let g:which_key_map['p'] = [ ':FZF', 'open file' ]
let g:which_key_map['b'] = [ ':Buffers', 'open buffer' ]
let g:which_key_map['F'] = [ ':RG', 'search text' ]
let g:which_key_map['R'] = [ '<Plug>(coc-references)', 'show references' ]
let g:which_key_map['r'] = [ '<Plug>(coc-rename)', 'rename' ]
let g:which_key_map['='] = [ '<C-W>=', 'balance windows' ]
let g:which_key_map['/'] = [ '<Plug>NERDCommenterToggle', 'comment/uncomment' ]
let g:which_key_map['P'] = [ ':FZFNeigh', 'neighbour files' ]

nmap <leader>ff  :CocCommand prettier.formatFile<CR>

" Toggle NERDTree on/off
nmap <silent> <leader>n :NERDTreeToggle<CR>
" Opens current file location in NERDTree
nmap <silent> <leader>c :NERDTreeFind<CR>

" FZF
"nmap <silent> <leader>p :FZF<CR>

" Switch between the last two files
"nmap <leader>P <c-^>

" Find and replace
map <leader>h :%s///<left><left>
" Clear highlighted search term while preserving history
"nmap <silent> <leader>/ :nohlsearch<CR>

" Easy-motion highlights first word letters bi-directionally
nmap <leader>e <Plug>(easymotion-overwin-w)
" Easy-motion to line
"nmap <Leader>l <Plug>(easymotion-overwin-line)
" Easy-motion to word
"nmap <Leader>w <Plug>(easymotion-overwin-w)

" Fix autofix problem of current line
"nmap <leader>qf <Plug>(coc-fix-current)
"let g:which_key_map.g.r = 'find references'

" Use <C-l> for trigger snippet expand.
imap <C-l> <Plug>(coc-snippets-expand)

" l is for language server protocol
let g:which_key_map.l = {
      \ 'name' : '+lsp' ,
      \ '.' : [':CocConfig'                          , 'config'],
      \ ';' : ['<Plug>(coc-refactor)'                , 'refactor'],
      \ 'a' : ['<Plug>(coc-codeaction)'              , 'line action'],
      \ 'A' : ['<Plug>(coc-codeaction-selected)'     , 'selected action'],
      \ 'b' : [':CocNext'                            , 'next action'],
      \ 'B' : [':CocPrev'                            , 'prev action'],
      \ 'c' : [':CocFzfList commands'                   , 'commands'],
      \ 'd' : ['<Plug>(coc-definition)'              , 'definition'],
      \ 'D' : ['<Plug>(coc-declaration)'             , 'declaration'],
      \ 'e' : [':CocFzfList extensions'                 , 'extensions'],
      \ 'f' : ['<Plug>(coc-format-selected)'         , 'format selected'],
      \ 'F' : ['<Plug>(coc-format)'                  , 'format'],
      \ 'h' : ['<Plug>(coc-float-hide)'              , 'hide'],
      \ 'i' : ['<Plug>(coc-implementation)'          , 'implementation'],
      \ 'I' : [':CocFzfList diagnostics'                , 'diagnostics'],
      \ 'j' : ['<Plug>(coc-float-jump)'              , 'float jump'],
      \ 'l' : ['<Plug>(coc-codelens-action)'         , 'code lens'],
      \ 'n' : ['<Plug>(coc-diagnostic-next)'         , 'next diagnostic'],
      \ 'N' : ['<Plug>(coc-diagnostic-next-error)'   , 'next error'],
      \ 'o' : ['<Plug>(coc-openlink)'                , 'open link'],
      \ 'p' : ['<Plug>(coc-diagnostic-prev)'         , 'prev diagnostic'],
      \ 'P' : ['<Plug>(coc-diagnostic-prev-error)'   , 'prev error'],
      \ 'q' : ['<Plug>(coc-fix-current)'             , 'quickfix'],
      \ 'r' : ['<Plug>(coc-rename)'                  , 'rename'],
      \ 'R' : ['<Plug>(coc-references)'              , 'references'],
      \ 's' : [':CocList -I symbols'                 , 'references'],
      \ 't' : ['<Plug>(coc-type-definition)'         , 'type definition'],
      \ 'u' : [':CocListResume'                      , 'resume list'],
      \ 'U' : [':CocUpdate'                          , 'update CoC'],
      \ 'z' : [':CocDisable'                         , 'disable CoC'],
      \ 'Z' : [':CocEnable'                          , 'enable CoC'],
      \ }

" s is for search
let g:which_key_map.s = {
      \ 'name' : '+search' ,
      \ '/' : [':History/'     , 'history'],
      \ ';' : [':Commands'     , 'commands'],
      \ 'b' : [':BLines'       , 'current buffer'],
      \ 'B' : [':Buffers'      , 'open buffers'],
      \ 'c' : [':Commits'      , 'commits'],
      \ 'C' : [':BCommits'     , 'buffer commits'],
      \ 'f' : [':Files'        , 'files'],
      \ 'g' : [':GFiles'       , 'git files'],
      \ 'G' : [':GFiles?'      , 'modified git files'],
      \ 'h' : [':History'      , 'file history'],
      \ 'H' : [':History:'     , 'command history'],
      \ 'l' : [':Lines'        , 'lines'] ,
      \ 'm' : [':Marks'        , 'marks'] ,
      \ 's' : [':CocList snippets'     , 'snippets'],
      \ 't' : [':RG'           , 'text Rg'],
      \ 'z' : [':FZF'          , 'FZF'],
      \ }

" g is for git
let g:which_key_map.g = {
      \ 'name' : '+git' ,
      \ 'a' : [':Git add .'                        , 'add all'],
      \ 'A' : [':Git add %'                        , 'add current'],
      \ 'b' : [':Git blame'                        , 'blame'],
      \ 'c' : [':Git commit'                       , 'commit'],
      \ 'd' : [':Git diff'                         , 'diff'],
      \ 'D' : [':Gdiffsplit'                       , 'diff split'],
      \ 'g' : [':GGrep'                            , 'git grep'],
      \ 's' : [':Gstatus'                          , 'status'],
      \ 'l' : [':Git log'                          , 'log'],
      \ 'p' : [':Git push'                         , 'push'],
      \ 'P' : [':Git pull'                         , 'pull'],
      \ 'r' : [':GRemove'                          , 'remove'],
      \ }

"nmap <leader>df :diffget //2<CR>
"nmap <leader>dj :diffget //3<CR>

" Terminal
tnoremap <Leader>` <C-\><C-n>


" Use tab for trigger completion with characters ahead and navigate.
" Use command ':verbose imap <tab>' to make sure tab is not mapped by other plugin.
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-space> coc#refresh()

" Use <cr> to confirm completion, `<C-g>u` means break undo chain at current position.
" Coc only does snippet and additional edit on confirm.
inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"

nnoremap <silent> <leader> :WhichKey '<Space>'<CR>

" Browser currently open buffers
"nmap <leader>; :Denite buffer<CR>
" Browse list of files in current directory
"nmap <leader>t :DeniteProjectDir file/rec<CR>
" Search current directory for occurences of given term and close window if no results
"nnoremap <leader>fa :<C-u>Denite grep:. -no-empty<CR>
" Search current directory for occurences of word under cursor
"nnoremap <leader>j :<C-u>DeniteCursorWord grep:.<CR>
" Search next occurance
"nnoremap <leader>fn :<C-u>Denite -resume -cursor-pos=-1 -immediately<CR>
" Search previous occurance
"nnoremap <leader>fp :<C-u>Denite -resume -cursor-pos=+1 -immediately<CR>

" Remember cursor position when switching buffers
if v:version >= 700
  au BufLeave * let b:winview = winsaveview()
  au BufEnter * if(exists('b:winview')) | call winrestview(b:winview) | endif
endif

" Register which key map
call which_key#register('<Space>', "g:which_key_map")


" ============================================================================ "
" ===                             LOAD PLUGINS                             === "
" ============================================================================ "

source $HOME/.config/nvim/plug-config/fzf.vim
source $HOME/.config/nvim/plug-config/coc.vim
source $HOME/.config/nvim/plug-config/coc-fzf.vim
source $HOME/.config/nvim/plug-config/nerd-tree.vim
source $HOME/.config/nvim/plug-config/quick-scope.vim
source $HOME/.config/nvim/plug-config/airline.vim
source $HOME/.config/nvim/plug-config/which-key.vim
"source $HOME/.config/nvim/plug-config/denite.vim
