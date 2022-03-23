local M = {}

function M.live_grep_visual()
  local visual_selection = function()
    local save_previous = vim.fn.getreg "a"
    vim.api.nvim_command 'silent! normal! "ay'
    local selection = vim.fn.trim(vim.fn.getreg "a")
    vim.fn.setreg("a", save_previous)
    return vim.fn.substitute(selection, [[\n]], [[\\n]], "g")
  end
  require("telescope.builtin").live_grep {
    default_text = visual_selection(),
  }
end

return M
