---@type LazySpec
return {
  "AstroNvim/astrolsp",
  ---@type AstroLSPOpts
  opts = {
    formatting = {
      format_on_save = {
        enabled = false, -- enable or disable format on save globally
      },
      disabled = {
        "vtsls",
      },
    },
  },
}
