-- Mapping data with "desc" stored directly by vim.keymap.set().
--
-- Please use this mappings table to set keyboard mapping since this is the
-- lower level configuration and more robust one. (which-key will
-- automatically pick-up stored data by this setting.)
local mappings = {
  -- first key is the mode
  n = {
    -- second key is the lefthand side of the map
    -- mappings seen under group name "Buffer"
    -- better buffer navigation
    ["]b"] = false,
    ["[b"] = false,

    -- ctrl+a is used as a leader key for kitty/tmux
    ["<C-b>"] = { "<C-a>", desc = "Increment number" },
    ["<C-a>"] = { "<Nop>" },

    ["<C-q>"] = { function() require("user.utils").toggle_quick_fix() end, desc = "Toggle quick fix" },
    ["<S-h>"] = { function() require("astronvim.utils.buffer").nav(-(vim.v.count > 0 and vim.v.count or 1)) end, desc =
    "Previous buffer" },
    ["<S-l>"] = { function() require("astronvim.utils.buffer").nav(vim.v.count > 0 and vim.v.count or 1) end, desc =
    "Next buffer" },
    -- ["<leader>bh"] = { "<cmd>BufferLineCloseLeft<cr>", desc = "Close buffers on the left" },
    -- ["<leader>bl"] = { "<cmd>BufferLineCloseRight<cr>", desc = "Close buffers on the right" },
    ["<leader>lj"] = { function() vim.diagnostic.goto_next() end, desc = "Next diagnostic" },
    -- harpoon
    ["<leader>a"] = { function() require('harpoon.mark').add_file() end, desc = "Harpoon add file" },
    ["<leader>m"] = { function() require('harpoon.ui').toggle_quick_menu() end,
      desc = "Harpoon quick menu" },
    ["<leader>j"] = { function() require('harpoon.ui').nav_prev() end, desc = "Harpoon next file" },
    ["<leader>k"] = { function() require('harpoon.ui').nav_next() end, desc = "Harpoon previous file" },
    -- search
    ["<leader>f"] = { function() require("telescope.builtin").find_files { hidden = true } end,
      desc = "Find files" },
    ["<leader>n"] = { function() require("telescope.builtin").find_files { cwd = '%:p:h', hidden = true } end,
      desc = "Find neighboring files" },
    ["<leader>F"] = { function() require("telescope.builtin").live_grep() end, desc = "Live grep" },
    ["<leader>R"] = { "<cmd>Telescope resume<CR>", desc = "Resume last search" },

    ["<leader>s"] = { desc = "(S)earch" },
    ["<leader>sf"] = { function() require("telescope.builtin").find_files { hidden = true } end, desc = "Find files" },
    ["<leader>sn"] = { function() require("telescope.builtin").find_files { cwd = '%:p:h', hidden = true } end,
      desc = "Find neighboring files" },
    ["<leader>sg"] = { function() require("telescope.builtin").live_grep() end, desc = "Live grep" },
    ["<leader>sr"] = { "<cmd>Telescope resume<CR>", desc = "Resume last search" },
    ["<leader>s/"] = { function() require("telescope.builtin").current_buffer_fuzzy_find() end, desc = "Find words in current buffer" },
    ["<leader>ss"] = { function() require("telescope.builtin").lsp_document_symbols() end, desc = "Find document symbols" },
    ["<leader>sw"] = { function() require("telescope.builtin").lsp_dynamic_workspace_symbols() end, desc = "Find workspace symbols" },
    ["<leader>sd"] = { function() require("telescope.builtin").diagnostics { bufnr = 0 } end, desc = "Find document symbols" },
    ["<leader><leader>"] = { function() require("telescope.builtin").buffers() end, desc = "Search current buffers" },

    ["<leader>o"] = { "<cmd>Neotree reveal<CR>", desc = "Toggle explorer (focus current)" },
  },
  i = {
    ["<C-CR>"] = { function() require('copilot.suggestion').accept() end, desc = "Accept Copilot suggestion" }
  },
  t = {
    -- setting a mapping to false will disable it
    -- ["<esc>"] = false,
  },
  v = {
    --find by text
    ["<leader>F"] = { function() require('user.telescope').live_grep_visual() end, desc = "Live grep" },
  },
  x = {
    -- do not override clipboard when pasting
    ["p"] = "P"
  },
}

return function(maps)
  for key, _ in pairs(maps.n) do
    -- remove all buitl-in mappings from `<leader>f` group so that we are not influenced by timeoutln
    if key:match "^<leader>f.*" then maps.n[key] = false end
  end

  return require("astronvim.utils").extend_tbl(maps, mappings)
end
