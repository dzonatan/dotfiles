" ============================================================================ "
" ===                           PLUGIN SETUP                               === "
" ============================================================================ "

call plug#begin('~/.vim/vendor')
  Plug 'neoclide/coc.nvim', {'branch': 'release'}
  Plug 'scrooloose/nerdtree'
  " Plug 'easymotion/vim-easymotion'
  Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
  Plug 'junegunn/fzf.vim'
  Plug 'antoinemadec/coc-fzf'
  Plug 'vim-airline/vim-airline'
  Plug 'vim-airline/vim-airline-themes'
  Plug 'tpope/vim-surround'
  Plug 'scrooloose/nerdcommenter'
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
  Plug 'stsewd/fzf-checkout.vim' " git checkout branch window
  Plug 'mhinz/vim-startify' " nice startup screen
  Plug 'jxnblk/vim-mdx-js' " Markdown MDX syntax support
call plug#end()

:lua require('plugins')
:lua require('new-init')


" ============================================================================ "
" ===                             KEY MAPPINGS                             === "
" ============================================================================ "


" Use alt + hjkl to resize windows
nnoremap <silent> ∆    :resize -2<CR>
nnoremap <silent> ˚    :resize +2<CR>
nnoremap <silent> ˙    :vertical resize -2<CR>
nnoremap <silent> ¬    :vertical resize +2<CR>

" Toggle selection comment
vmap / <Plug>NERDCommenterToggle

" Define prefix dictionary
let g:which_key_map =  {} 

" Single mappings
let g:which_key_map['w'] = [ 'w', 'write' ]
let g:which_key_map['q'] = [ 'q', 'quit' ]
let g:which_key_map[';'] = [ ':Commands', 'commands' ]
"let g:which_key_map['d'] = [ ':bd', 'delete buffer' ]
let g:which_key_map['p'] = [ ':FZF', 'open file' ]
let g:which_key_map['d'] = [ ':Bdelete', 'delete buffer' ]
let g:which_key_map['b'] = [ ':Buffers', 'open buffer' ]
let g:which_key_map['n'] = [ ':NERDTreeToggle', 'toggle file explorer' ]
let g:which_key_map['N'] = [ ':NERDTreeFind', 'open current file explorer' ]
let g:which_key_map['F'] = [ ':RG', 'search text' ]
let g:which_key_map['R'] = [ '<Plug>(coc-references)', 'show references' ]
let g:which_key_map['r'] = [ '<Plug>(coc-rename)', 'rename' ]
let g:which_key_map['='] = [ '<C-W>=', 'balance windows' ]
let g:which_key_map['/'] = [ '<Plug>NERDCommenterToggle', 'comment/uncomment' ]
let g:which_key_map['P'] = [ ':FZFNeigh', 'neighbour files' ]

nmap <leader>ff  :CocCommand prettier.formatFile<CR>

" FZF
"nmap <silent> <leader>p :FZF<CR>

" Switch between the last two files
"nmap <leader>P <c-^>

" Find and replace
map <leader>h :%s///<left><left>
" Clear highlighted search term while preserving history
"nmap <silent> <leader>/ :nohlsearch<CR>

" Easy-motion highlights first word letters bi-directionally
"nmap <leader>e <Plug>(easymotion-overwin-w)
" Easy-motion to line
"nmap <Leader>l <Plug>(easymotion-overwin-line)
" Easy-motion to word
"nmap <Leader>w <Plug>(easymotion-overwin-w)

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
      "\ 'a' : [':Git add .'                        , 'add all'],
      "\ 'A' : [':Git add %'                        , 'add current'],
      "\ 'c' : [':GBranches'                        , 'checkout'],
      "\ 'P' : [':Git push'                         , 'push'],
      "\ 'p' : [':Git pull'                         , 'pull'],
      "\ 'r' : [':GRemove'                          , 'remove'],
let g:which_key_map.g = {
      \ 'name' : '+git' ,
      \ 'b' : [':Git blame'                        , 'blame'],
      \ 'd' : [':Git diff'                         , 'diff'],
      \ 'D' : [':Gdiffsplit'                       , 'diff split'],
      \ 'g' : [':GGrep'                            , 'git grep'],
      \ 's' : [':Gstatus'                          , 'status'],
      \ 'l' : [':Git log'                          , 'log'],
      \ }

"nmap <leader>df :diffget //2<CR>
"nmap <leader>dj :diffget //3<CR>

" Terminal
tnoremap <Leader>` <C-\><C-n>

nnoremap <silent> <leader> :WhichKey '<Space>'<CR>

" Remember cursor position when switching buffers
"if v:version >= 700
  "au BufLeave * let b:winview = winsaveview()
  "au BufEnter * if(exists('b:winview')) | call winrestview(b:winview) | endif
"endif

" Register which key map
call which_key#register('<Space>', "g:which_key_map")

" With '@' modify only lines that matches
xnoremap @ :<C-u>call ExecuteMacroOverVisualRange()<CR>
function! ExecuteMacroOverVisualRange()
  echo "@".getcmdline()
  execute ":'<,'>normal @".nr2char(getchar())
endfunction

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
