local M = {}

local function generate(schematic, nameWithFlags, directory)
  local command = 'cd ' .. directory .. ' && ng generate ' .. schematic .. ' ' .. nameWithFlags
  print(command)
  os.execute(command)
  require("nvim-tree.lib").refresh_tree();
end

function M.run()
  local node = require("nvim-tree.lib").get_node_at_cursor()
  local absolute_path = node.link_to or node.absolute_path
  local is_folder = node.open ~= nil
  local basedir = is_folder and absolute_path or vim.fn.fnamemodify(absolute_path, ":h")
  local relative_path = require('nvim-tree.utils').path_relative(basedir, require('nvim-tree.core').get_cwd())

  vim.ui.select({ 'module', 'component', 'directive', 'pipe', 'service', 'resolver', 'interceptor', 'guard', 'library',
    'application' }, { prompt = 'What you would like to generate?' }, function(schematic)
    if schematic == '' or schematic == nil then return end

    vim.ui.input({ prompt = 'Enter the name [flags]: ' }, function(nameWithFlags)
      if nameWithFlags == '' or nameWithFlags == nil then return end
      generate(schematic, nameWithFlags, relative_path)
    end)
  end);
end

return M
