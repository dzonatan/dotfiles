---@type LazySpec
return {
  "nvim-treesitter/nvim-treesitter",
  opts = {
    ensure_installed = {
      "lua",
      "angular",
      "css",
      "html",
      "javascript",
      "typescript",
      "tsx",
    },
    textobjects = {
      select = {
        enable = true,
        keymaps = {
          ["a="] = { query = "@assignment.outer", desc = "Select outer part of an assignment" },
          ["i="] = { query = "@assignment.inner", desc = "Select inner part of an assignment" },
          -- ["l="] = { query = "@assignment.lhs", desc = "Select left hand side of an assignment" },
          -- ["r="] = { query = "@assignment.rhs", desc = "Select right hand side of an assignment" },

          ["am"] = { query = "@call.outer", desc = "Select outer part of a function call" },
          ["im"] = { query = "@call.inner", desc = "Select inner part of a function call" },

          ["aa"] = { query = "@attribute.outer", desc = "Select outer part of an attribute" },
          ["ia"] = { query = "@attribute.inner", desc = "Select inner part of an attribute" },

          ["ai"] = { query = "@conditional.outer", desc = "Select around if" },
          ["ii"] = { query = "@conditional.inner", desc = "Select inside if" },

          ["al"] = { query = "@loop.outer", desc = "Select around loop" },
          ["il"] = { query = "@loop.inner", desc = "Select inside loop" },

          ["ak"] = { query = "@comment.outer", desc = "Select around comment" },
        },
      },
    },
  },
}
