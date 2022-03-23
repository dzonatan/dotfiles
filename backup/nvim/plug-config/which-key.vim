let g:which_key_use_floating_win = 0
"
" Change the colors if you want
highlight default link WhichKey          Conditional
highlight default link WhichKeyGroup     Function
highlight default link WhichKeyDesc      String

" Hide status line
autocmd! FileType which_key
autocmd  FileType which_key set laststatus=0 noshowmode noruler
  \| autocmd BufLeave <buffer> set laststatus=2 noshowmode ruler
