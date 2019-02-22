" This is the default extra key bindings
let g:fzf_action = {
  \ 'ctrl-x': 'split',
  \ 'ctrl-v': 'vsplit' }

" Enable per-command history.
" CTRL-N and CTRL-P will be automatically bound to next-history and
" previous-history instead of down and up. If you don't like the change,
" explicitly bind the keys to down and up in your $FZF_DEFAULT_OPTS.
let g:fzf_history_dir = '~/.local/share/fzf-history'
let g:fzf_buffers_jump = 1

let g:fzf_layout = {'up':'~90%', 'window': { 'width': 0.8, 'height': 0.8,'yoffset':0.5,'xoffset': 0.5 } }


let $FZF_DEFAULT_OPTS = '--layout=reverse --inline-info'
"let $FZF_DEFAULT_COMMAND = "rg --files --hidden --glob '!.git/**'"

" Get Files
"command! -bang -nargs=? -complete=dir Files
    "\ call fzf#vim#files(<q-args>, fzf#vim#with_preview({'options': ['--layout=reverse', '--inline-info']}), <bang>0)

" Make Ripgrep ONLY search file contents and not filenames
"command! -bang -nargs=* Rg
  "\ call fzf#vim#grep(
  "\   'rg --column --line-number --hidden --smart-case --no-heading --color=always '.shellescape(<q-args>), 1,
  "\   <bang>0 ? fzf#vim#with_preview({'options': '--delimiter : --nth 4..'}, 'up:60%')
  "\           : fzf#vim#with_preview({'options': '--delimiter : --nth 4.. -e'}, 'right:50%', '?'),
  "\   <bang>0)

" Ripgrep advanced
function! RipgrepFzf(query, fullscreen)
  let command_fmt = 'rg --column --line-number --no-heading --color=always --smart-case %s || true'
  let initial_command = printf(command_fmt, shellescape(a:query))
  let reload_command = printf(command_fmt, '{q}')
  let spec = {'options': ['--phony', '--query', a:query, '--bind', 'change:reload:'.reload_command]}
  call fzf#vim#grep(initial_command, 1, fzf#vim#with_preview(spec), a:fullscreen)
endfunction

command! -nargs=* -bang RG call RipgrepFzf(<q-args>, <bang>0)

" Neighbouring files
function! s:fzf_neighbouring_files()
  let cwd = expand("%:~:.:h")
  let command = 'rg --files -g "'.cwd.'/*"'
  echo command

  call fzf#run(fzf#wrap({ 'source': command, 'sink': 'e' }))
        "\ 'source': command,
"\ 'options': '-m -x +s'
endfunction

command! FZFNeigh call s:fzf_neighbouring_files()

command! -bang -nargs=? Buffers call fzf#vim#buffers(<q-args>, {'options': '--no-preview'}, <bang>0)
