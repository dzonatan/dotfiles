lvim.builtin.alpha.active = true
lvim.builtin.alpha.dashboard.section.buttons.entries = {
  { "p", "  Find File", "<CMD>Telescope find_files<CR>" },
  { "f", "  Find Word", "<CMD>Telescope live_grep<CR>" },
  { "n", "  New File", "<CMD>ene!<CR>" },
  { "P", "  Projects ", "<CMD>Telescope projects<CR>" },
  { "r", "  Recent Files", "<CMD>Telescope oldfiles<CR>" },
  {
    "c",
    "  Configuration",
    "<CMD>edit " .. require("lvim.config").get_user_config_path() .. " <CR>",
  },
}

-- smaller graphics to save some screen space
lvim.builtin.alpha.dashboard.section.header.val = {
  [[    __                          _    ___         ]],
  [[   / /   __  ______  ____ _____| |  / (_)___ ___ ]],
  [[  / /   / / / / __ \/ __ `/ ___/ | / / / __ `__ \]],
  [[ / /___/ /_/ / / / / /_/ / /   | |/ / / / / / / /]],
  [[/_____/\__,_/_/ /_/\__,_/_/    |___/_/_/ /_/ /_/ ]],
}
