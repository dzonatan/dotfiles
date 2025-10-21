local toggle_quick_fix = function()
  local qf_exists = false
  for _, win in pairs(vim.fn.getwininfo()) do
    if win["quickfix"] == 1 then qf_exists = true end
  end
  if qf_exists == true then
    vim.cmd "cclose"
    return
  end
  if not vim.tbl_isempty(vim.fn.getqflist()) then vim.cmd "copen" end
end

---@type LazySpec
return {
  "AstroNvim/astrocore",
  ---@type AstroCoreOpts
  opts = {
    -- Configure core features of AstroNvim
    -- features = {
    -- large_buf = { size = 1024 * 256, lines = 10000 }, -- set global limits for large files for disabling features like treesitter
    -- autopairs = true, -- enable autopairs at start
    -- cmp = true, -- enable completion at start
    -- diagnostics = { virtual_text = true, virtual_lines = false }, -- diagnostic settings on startup
    -- highlighturl = true, -- highlight URLs at start
    -- notifications = true, -- enable notifications at start
    -- },
    -- Diagnostics configuration (for vim.diagnostics.config({...})) when diagnostics are on
    -- diagnostics = {
    --   virtual_text = true,
    --   underline = true,
    -- },
    options = {
      opt = { -- vim.opt.<key>
        relativenumber = true, -- sets vim.opt.relativenumber
        -- number = true, -- sets vim.opt.number
        -- spell = false, -- sets vim.opt.spell
        -- signcolumn = "yes", -- sets vim.opt.signcolumn to yes
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
    -- Mappings can be configured through AstroCore as well.
    -- NOTE: keycodes follow the casing in the vimdocs. For example, `<Leader>` must be capitalized
    mappings = {
      n = {
        ["]b"] = false,
        ["[b"] = false,

        ["<C-q>"] = { function() toggle_quick_fix() end, desc = "Toggle quick fix list" },
        ["<S-h>"] = { function() require("astrocore.buffer").nav(-vim.v.count1) end, desc = "Previous buffer" },
        ["<S-l>"] = { function() require("astrocore.buffer").nav(vim.v.count1) end, desc = "Next buffer" },

        -- harpoon
        ["<Leader>m"] = { desc = "Harpoon" },
        ["<Leader>ma"] = { function() require("harpoon"):list():add() end, desc = "Harpoon add file" },
        ["<Leader>mm"] = {
          function() require("harpoon").ui:toggle_quick_menu(require("harpoon"):list()) end,
          desc = "Harpoon quick menu",
        },
        ["<Leader>j"] = { function() require("harpoon"):list():next() end, desc = "Harpoon next file" },
        ["<Leader>k"] = { function() require("harpoon"):list():prev() end, desc = "Harpoon previous file" },

        ["<Leader>lj"] = { function() vim.diagnostic.goto_next() end, desc = "Next diagnostic" },

        ["<Leader>o"] = { "<cmd>Neotree reveal<CR>", desc = "Toggle explorer (focus current)" },

        -- search (new)
        ["<Leader>s"] = { desc = "(S)earch" },
        ["<Leader>sa"] = { function() require("snacks").picker.git_files() end, desc = "Find files (git)" },
        ["<Leader>sn"] = {
          function() require("snacks").picker.files { hidden = true, cwd = vim.fn.expand "%:p:h" } end,
          desc = "Find neighboring files",
        },
        ["<Leader>sf"] = {
          function() require("snacks").picker.files { hidden = true } end,
          desc = "Find files (skip ignored)",
        },
        ["<Leader>sF"] = {
          function() require("snacks").picker.files { hidden = true, ignored = true } end,
          desc = "Find files (all)",
        },
        ["<Leader>sg"] = {
          function() require("snacks").picker.grep { hidden = true } end,
          desc = "Live grep (skip ignored)",
        },
        ["<Leader>sG"] = {
          function() require("snacks").picker.grep { hidden = true, ignored = true } end,
          desc = "Live grep (everything)",
        },
        ["<Leader>sr"] = { function() require("snacks").picker.resume() end, desc = "Resume last search" },
        ["<Leader>so"] = { function() require("snacks").picker.search_history() end, desc = "Find history" },
        ["<Leader>sw"] = {
          function() require("snacks").picker.grep_word() end,
          desc = "Find word under cursor",
        },
        -- ["<Leader>st"] = { "<Cmd>TodoTelescope<CR>", desc = "Find TODOs" },
        -- ["<Leader>s/"] = {
        --   function() require("telescope.builtin").current_buffer_fuzzy_find() end,
        --   desc = "Find words in current buffer",
        -- },
        ["<Leader>ss"] = {
          function() require("snacks").picker.lsp_symbols() end,
          desc = "Find document symbols",
        },
        ["<Leader>sS"] = {
          function() require("snacks").picker.lsp_workspace_symbols() end,
          desc = "Find workspace symbols",
        },
        ["<Leader>sd"] = {
          function() require("snacks").picker.diagnostics_buffer() end,
          desc = "Find document symbols",
        },
        -- ["<Leader>sm"] = { function() toggle_telescope(harpoon:list()) end, desc = "Find in harpoon" },
        ["<Leader><Leader>"] = {
          function() require("snacks").picker.buffers() end,
          desc = "Smart search",
        },
        ["<Leader>sb"] = {
          function() require("snacks").picker.buffers() end,
          desc = "Search current buffers",
        },

        ["<Leader>a"] = { desc = "(A)rtificial Inteligence" },
        -- CopilotChat
        -- ["<Leader>ac"] = { ":CopilotChatToggle<CR>", desc = "Toggle copilot chat" },
        -- ["<Leader>ax"] = { ":CopilotChatReset<CR>", desc = "Reset copilot chat" },
        -- ["<Leader>as"] = { ":CopilotChatStop<CR>", desc = "Stop copilot chat" },
        -- ["<Leader>am"] = { ":CopilotChatModels<CR>", desc = "Select copilot chat model" },
        -- ["<Leader>ap"] = {
        --   function() require("CopilotChat").select_prompt() end,
        --   desc = "Select copilot prompt",
        -- },
        -- CodeCompanion
        ["<Leader>ac"] = { ":CodeCompanionChat Toggle<CR>", desc = "Open code companion chat" },
        ["<Leader>ap"] = { ":CodeCompanion<CR>", desc = "Code companion prompt" },
        ["<Leader>ak"] = { ":CodeCompanionActions<CR>", desc = "Code companion action" },
      },
      i = {
        ["<C-f>"] = { function() require("copilot.suggestion").accept() end, desc = "Accept Copilot suggestion" },
      },
      v = {
        ["<Leader>f"] = {
          function() require("snacks").picker.grep_word { hidden = true } end,
          desc = "Find word under cursor (skip ignored)",
        },
        ["<Leader>F"] = {
          function() require("snacks").picker.grep_word { hidden = true, ignored = true } end,
          desc = "Find word under cursor (everything)",
        },

        ["<Leader>a"] = { desc = "(A)rtificial Inteligence" },
        -- CopilotChat
        -- ["<Leader>ac"] = { ":CopilotChat<CR>", desc = "Open copilot chat" },
        -- ["<Leader>ap"] = {
        --   function() require("CopilotChat").select_prompt() end,
        --   desc = "Select copilot prompt",
        -- },
        -- CodeCompanion
        ["<Leader>ac"] = { ":'<,'>CodeCompanionChat Toggle<CR>", desc = "Open code companion chat" },
        ["<Leader>ap"] = { ":'<,'>CodeCompanion<CR>", desc = "Code companion prompt" },
        ["<Leader>ak"] = { ":'<,'>CodeCompanionActions<CR>", desc = "Code companion action" },
        ["ga"] = { ":'<,'>CodeCompanionChat Add<CR>", desc = "Add selection to AI chat" },
      },
      x = {
        -- do not override clipboard when pasting
        ["p"] = "P",
      },
    },
  },
}
