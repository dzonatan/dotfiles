- Make a plan extremely concise. Sacrifice grammar for the sake of concision.
- ALWAYS prefer built-in tools (Read, Edit, Write, Grep, Glob) over Bash for file operations. Never use awk, sed, grep, rg, find, cat, head, tail, Python/Node one-liners, or shell loops for searching/editing files. Use Bash only for actual system commands (git, npm, build tools, etc). This is strict — no exceptions for "bulk" or "multi-file" operations.

<!-- nono-sandbox-start -->
## Nono Sandbox - CRITICAL

**You are running inside the nono security sandbox.** This is a capability-based sandbox that CANNOT be bypassed or modified from within the session.

### On ANY "operation not permitted" or "EPERM" error:

**IMMEDIATELY tell the user:**
> This path is not accessible in the current nono sandbox session. You need to exit and restart with:
> `nono run --allow /path/to/needed -- claude`

**NEVER attempt:**
- Alternative file paths or locations
- Copying files to accessible directories
- Using sudo or permission changes
- Manual workarounds for the user to try
- ANY other approach besides restarting nono

The sandbox is a hard security boundary. Once applied, it cannot be expanded. The ONLY solution is to restart the session with additional --allow flags.
<!-- nono-sandbox-end -->
