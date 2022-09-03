lvim.log.level = "warn"
lvim.format_on_save = true
lvim.colorscheme = "gruvbox-material"

vim.opt.relativenumber = true
vim.opt.wrap = true

vim.opt.list = true
vim.opt.listchars:append("trail:•")

lvim.builtin.terminal.active = true
lvim.builtin.notify.active = true

-- default also includes `package.json` which gives a bad DX for mono-repo projects
lvim.builtin.project.patterns = { ".git" }
