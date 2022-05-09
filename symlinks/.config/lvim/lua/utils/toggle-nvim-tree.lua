local M = {}

local is_toggled = false
function M.toggle_full_width()
  if is_toggled then
    require 'nvim-tree'.resize(40)
  else
    require 'nvim-tree'.resize(98)
  end
  is_toggled = not is_toggled
end

return M
