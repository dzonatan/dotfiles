return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      window = {
        width = 50,
        mappings = {
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
