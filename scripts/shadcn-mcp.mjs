// Wrapper to keep the shadcn MCP server running over stdio.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { server as shadcnServer } from 'shadcn/mcp'

const transport = new StdioServerTransport()

try {
  // Ensure stdin is flowing so MCP messages are received
  if (process.stdin.isPaused?.()) {
    process.stdin.resume()
  }
  await shadcnServer.connect(transport)
  // Keep the process alive for MCP stdio handshake
  // eslint-disable-next-line no-constant-condition
  setInterval(() => {}, 1 << 30)
} catch (err) {
  console.error('[shadcn-mcp] failed to start:', err)
  process.exit(1)
}
