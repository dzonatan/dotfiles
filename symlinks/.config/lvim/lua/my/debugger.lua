lvim.builtin.dap.active = true

local dap, dapui = require("dap"), require("dapui")

dap.adapters.node2 = {
  type = 'executable',
  command = 'node',
  args = { os.getenv('HOME') .. '/dev/debug-adapters/vscode-node-debug2/out/src/nodeDebug.js' },
}

dap.configurations.typescript = {
  {
    type = 'node2',
    request = 'launch',
    name = 'Debug Current Jest File',
    -- runtimeArgs = { '--inspect-brk', '${workspaceFolder}/node_modules/.bin/jest' },
    program = '${workspaceFolder}/node_modules/.bin/jest',
    args = { '${relativeFile}', '--no-cache', '--no-coverage' },
    console = 'integratedTerminal',
    disableOptimisticBPs = true,
    sourceMaps = 'inline',
    protocol = 'inspector',
    skipFiles = { '<node_internals>/**/*.js' },
    -- port = 9229
  }
}

dap.listeners.after.event_initialized["dapui_config"] = function()
  dapui.open()
end
dap.listeners.before.event_terminated["dapui_config"] = function()
  dapui.close()
end
dap.listeners.before.event_exited["dapui_config"] = function()
  dapui.close()
end
