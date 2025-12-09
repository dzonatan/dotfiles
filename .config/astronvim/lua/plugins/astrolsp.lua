---@type LazySpec
return {
  "AstroNvim/astrolsp",
  ---@type AstroLSPOpts
  opts = {
    ---@diagnostic disable: missing-fields
    formatting = {
      format_on_save = {
        enabled = false, -- enable or disable format on save globally
      },
      disabled = {
        "vtsls",
      },
    },
    config = {
      vtsls = {
        settings = {
          vtsls = {
            autoUseWorkspaceTsdk = true,
          },
        }
      }
    }
  },
}
