-- AstroCore provides a central place to modify mappings, vim options, autocommands, and more!
-- Configuration documentation can be found with `:h astrocore`
-- NOTE: We highly recommend setting up the Lua Language Server (`:LspInstall lua_ls`)
--       as this provides autocomplete and documentation while editing

local live_grep_visual = function()
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

local toggle_quick_fix = function()
  local qf_exists = false
  for _, win in pairs(vim.fn.getwininfo()) do
    if win["quickfix"] == 1 then
      qf_exists = true
    end
  end
  if qf_exists == true then
    vim.cmd "cclose"
    return
  end
  if not vim.tbl_isempty(vim.fn.getqflist()) then
    vim.cmd "copen"
  end
end

---@type LazySpec
return {
  "AstroNvim/astrocore",
  ---@param opts AstroCoreOpts
  opts = function(_, opts)
    local nmaps = opts.mappings.n
    for lhs, key in pairs(nmaps) do
      -- remove all buitl-in mappings from `<leader>f` group so that we are not influenced by timeoutln
      if lhs:match("^<Leader>f") then
        nmaps[lhs] = nil
      end
    end

    return require("astrocore").extend_tbl(opts, {
      -- Diagnostics configuration (for vim.diagnostics.config({...})) when diagnostics are on
      diagnostics = {
        virtual_text = false,
        underline = true,
      },
      -- vim options can be configured here
      options = {
        opt = { -- vim.opt.<key>
          wrap = true,
          list = true,
          scrolloff = 2,
        },
        g = { -- vim.g.<key>
          -- configure global vim variables (vim.g)
          -- NOTE: `mapleader` and `maplocalleader` must be set in the AstroNvim opts or before `lazy.setup`
          -- This can be found in the `lua/lazy_setup.lua` file
        },
      },
      mappings = {
        n = {
          -- better buffer navigation
          ["]b"] = false,
          ["[b"] = false,

          -- ctrl+a is used as a leader key for kitty/tmux
          ["<C-b>"] = { "<C-a>", desc = "Increment number" },
          ["<C-a>"] = { "<Nop>" },

          ["<C-q>"] = { function() toggle_quick_fix() end, desc = "Toggle quick fix" },
          ["<Alt-j>"] = { ":cnext", desc = "Toggle quick fix" },
          ["<Alt-k>"] = { ":cprevious", desc = "Toggle quick fix" },
          ["<S-h>"] = { function() require("astrocore.buffer").nav(-vim.v.count1) end, desc = "Previous buffer" },
          ["<S-l>"] = { function() require("astrocore.buffer").nav(vim.v.count1) end, desc = "Next buffer" },

          -- harpoon
          ["<leader>a"] = { function() require('harpoon.mark').add_file() end, desc = "Harpoon add file" },
          ["<leader>m"] = { function() require('harpoon.ui').toggle_quick_menu() end,
            desc = "Harpoon quick menu" },
          ["<leader>j"] = { function() require('harpoon.ui').nav_prev() end, desc = "Harpoon next file" },
          ["<leader>k"] = { function() require('harpoon.ui').nav_next() end, desc = "Harpoon previous file" },

          -- search (new)
          ["<leader>s"] = { desc = "(S)earch" },
          ["<leader>sf"] = { function() require("telescope.builtin").git_files() end, desc = "Find files (git)" },
          ["<leader>sn"] = { function() require("telescope.builtin").find_files { cwd = '%:p:h', hidden = true } end, desc = "Find neighboring files" },
          ["<leader>sa"] = { function() require("telescope.builtin").find_files { hidden = true } end, desc = "Find all files" },
          ["<leader>sg"] = { function() require("telescope.builtin").live_grep() end, desc = "Live grep" },
          ["<leader>sr"] = { "<cmd>Telescope resume<CR>", desc = "Resume last search" },
          ["<leader>so"] = { function() require("telescope.builtin").oldfiles() end, desc = "Find history" },
          ["<leader>sw"] = { function() require("telescope.builtin").grep_string() end, desc = "Find word under cursor" },
          ["<leader>st"] = { "<Cmd>TodoTelescope<CR>", desc = "Find TODOs" },
          ["<leader>s/"] = { function() require("telescope.builtin").current_buffer_fuzzy_find() end, desc = "Find words in current buffer" },
          ["<leader>ss"] = { function() require("telescope.builtin").lsp_document_symbols() end, desc = "Find document symbols" },
          ["<leader>sS"] = { function() require("telescope.builtin").lsp_dynamic_workspace_symbols() end, desc = "Find workspace symbols" },
          ["<leader>sd"] = { function() require("telescope.builtin").diagnostics { bufnr = 0 } end, desc = "Find document symbols" },

          ["<leader><leader>"] = { function() require("telescope.builtin").buffers() end, desc = "Search current buffers" },

          ["<leader>o"] = { "<cmd>Neotree reveal<CR>", desc = "Toggle explorer (focus current)" },
          
          ["<leader>lj"] = { function() vim.diagnostic.goto_next() end, desc = "Next diagnostic" },
        },
        i = {
          ["<C-CR>"] = { function() require('copilot.suggestion').accept() end, desc = "Accept Copilot suggestion" }
        },
        v = {
          --find by text
          ["<leader>f"] = { function() live_grep_visual() end, desc = "Live grep" },
          ["<leader>F"] = { function() live_grep_visual() end, desc = "Live grep" },
        },
        x = {
          -- do not override clipboard when pasting
          ["p"] = "P"
        },
      },
    })
  end,
}
