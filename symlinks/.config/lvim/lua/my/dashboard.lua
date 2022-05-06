lvim.builtin.alpha.active = true
lvim.builtin.alpha.dashboard.section.buttons.entries = {
  { "p", "  Find File", "<CMD>Telescope find_files<CR>" },
  { "f", "  Find Word", "<CMD>Telescope live_grep<CR>" },
  { "n", "  New File", "<CMD>ene!<CR>" },
  { "P", "  Recent Projects ", "<CMD>Telescope projects<CR>" },
  { "r", "  Recently Used Files", "<CMD>Telescope oldfiles<CR>" },
  {
    "c",
    "  Configuration",
    "<CMD>edit " .. require("lvim.config").get_user_config_path() .. " <CR>",
  },
}
