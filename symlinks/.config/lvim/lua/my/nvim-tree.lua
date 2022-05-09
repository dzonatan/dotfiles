lvim.builtin.nvimtree.setup.view.side = "left"
lvim.builtin.nvimtree.show_icons.git = 0
lvim.builtin.nvimtree.filters = {
  dotfiles = false
}
lvim.builtin.nvimtree.setup.view.width = 40
local tree_cb = require 'nvim-tree.config'.nvim_tree_callback
lvim.builtin.nvimtree.setup.view.mappings.list = {
  { key = { "l", "<CR>", "o" }, cb = tree_cb "edit" },
  { key = "h", cb = tree_cb "close_node" },
  { key = "v", cb = tree_cb "vsplit" },
  { key = "C", cb = tree_cb "cd" },
  { key = "f", cb = "<cmd>lua require'lvim.core.nvimtree'.start_telescope('find_files')<cr>" },
  { key = "F", cb = "<cmd>lua require'lvim.core.nvimtree'.start_telescope('live_grep')<cr>" },

  { key = "A", cb = "<cmd>lua require('utils.toggle-nvim-tree').toggle_full_width()<cr>" },
  -- TODO: make angular module / company generator
  { key = "<C-h>", cb = "<cmd>lua require('utils.angular-schematics').run()<cr>" },
}
