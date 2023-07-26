return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      filesystem = {
        filtered_items = {
          hide_dotfiles = false,
        },
      },
      window = {
        width = 50,
        mappings = {
          f = function(state)
            local node = state.tree:get_node()
            local path = node:get_id()
            require("telescope.builtin").find_files {
              cwd = node.type == "directory" and path or vim.fn.fnamemodify(path, ":h"),
            }
          end,
          F = function(state)
            local node = state.tree:get_node()
            local path = node:get_id()
            require("telescope.builtin").live_grep {
              cwd = node.type == "directory" and path or vim.fn.fnamemodify(path, ":h"),
            }
          end,
          ["<c-g>"] = function(state)
            local node = state.tree:get_node()
            local basedir = node.type ~= 'file' and node.path or vim.fn.fnamemodify(node.path, ":h")
            vim.ui.select(
              { 'module', 'component', 'directive', 'pipe', 'service', 'resolver', 'interceptor', 'guard', 'library',
                'application' }, { prompt = 'What you would like to generate?' }, function(schematic)
                if schematic == '' or schematic == nil then return end
                vim.ui.input({ prompt = 'Enter the name [flags]: ' }, function(nameWithFlags)
                  if nameWithFlags == '' or nameWithFlags == nil then return end
                  local command = 'cd ' .. basedir .. ' && ng generate ' .. schematic .. ' ' .. nameWithFlags
                  os.execute(command)
                end)
              end);
          end
        },
      },
      source_selector = {
        winbar = false
      },
    }
  },
}
