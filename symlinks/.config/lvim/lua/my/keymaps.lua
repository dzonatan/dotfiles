-- [view all the defaults by pressing <leader>Lk]
-- unmap a default keymapping
-- lvim.keys.normal_mode["<C-Up>"] = ""
-- edit a default keymapping
-- lvim.keys.normal_mode["<C-q>"] = ":q<cr>"

lvim.leader = "space"

-- Yank to line end
vim.api.nvim_set_keymap("n", "Y", "y$", { noremap = true, silent = true })

-- Previous/next buffer
lvim.keys.normal_mode["<S-h>"] = ":bprevious<cr>"
lvim.keys.normal_mode["<S-l>"] = ":bnext<cr>"

-- escape to normal mode via jk or kj
lvim.keys.insert_mode["jk"] = "<ESC>"
lvim.keys.insert_mode["kj"] = "<ESC>"

lvim.keys.normal_mode["<C-s>"] = ":w<cr>"
lvim.keys.visual_mode["<leader>F"] = "<cmd>lua require('utils.telescope').live_grep_visual()<cr>"
-- Move text up or down
lvim.keys.visual_mode["<A-j>"] = ":m .+1<CR>=="
lvim.keys.visual_mode["<A-k>"] = ":m .-2<CR>=="
-- Preserve clipboard when pasting
lvim.keys.visual_mode["p"] = '"_dP'

lvim.lsp.buffer_mappings.normal_mode["gr"] = { "<cmd>lua require('telescope.builtin').lsp_references()<cr>", "[G]oto [R]eferences" }

-- Whichkey
-- harpoon navigation
lvim.builtin.which_key.mappings.a = { "<cmd>lua require('harpoon.mark').add_file()<CR>", "Harpoon add file" }
lvim.builtin.which_key.mappings.m = { "<cmd>lua require('harpoon.ui').toggle_quick_menu()<CR>", "Harpoon quick menu" }
lvim.builtin.which_key.mappings.j = { "<cmd>lua require('harpoon.ui').nav_next()<CR>", "Harpoon next file" }
lvim.builtin.which_key.mappings.k = { "<cmd>lua require('harpoon.ui').nav_prev()<CR>", "Harpoon previous file" }
lvim.builtin.which_key.mappings.f = { "<cmd>Telescope live_grep<CR>", "Find word" }
-- overwrite "p" (default is packer) with find files
lvim.builtin.which_key.mappings.L.p = lvim.builtin.which_key.mappings.p
lvim.builtin.which_key.mappings.p = { "<cmd>Telescope find_files<CR>", "Find file" }
lvim.builtin.which_key.mappings.F = { "<cmd>Telescope resume<CR>", "Resume search" }
lvim.builtin.which_key.mappings.P = { "<cmd>lua require('telescope.builtin').find_files({ cwd='%:p:h' })<CR>",
  "Find relative file" }
lvim.builtin.which_key.mappings.r = {
  name = "Replace",
  r = { "<cmd>lua require('spectre').open()<cr>", "Replace" },
  w = { "<cmd>lua require('spectre').open_visual({select_word=true})<cr>", "Replace Word" },
  f = { "<cmd>lua require('spectre').open_file_search()<cr>", "Replace Buffer" },
}

-- lvim.builtin.which_key.mappings["t"] = {
--   name = "+Trouble",
--   r = { "<cmd>Trouble lsp_references<cr>", "References" },
--   f = { "<cmd>Trouble lsp_definitions<cr>", "Definitions" },
--   d = { "<cmd>Trouble lsp_document_diagnostics<cr>", "Diagnostics" },
--   q = { "<cmd>Trouble quickfix<cr>", "QuickFix" },
--   l = { "<cmd>Trouble loclist<cr>", "LocationList" },
--   w = { "<cmd>Trouble lsp_workspace_diagnostics<cr>", "Diagnostics" },
-- }
