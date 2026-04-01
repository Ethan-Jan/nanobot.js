import type OpenAI from "openai";

export function toolDefinitions(allowShell: boolean, allowWrite = true): OpenAI.Chat.ChatCompletionTool[] {
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "read_file",
        description:
          "Read a UTF-8 text file from the workspace. Paths outside the workspace are rejected.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path from workspace root" },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_dir",
        description: "List files and directories at a path relative to the workspace root.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory relative to workspace root (use . for root)",
            },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_repo",
        description:
          "Search for a literal substring in text files under the workspace (skips common large/vendor dirs). Returns matching lines with file paths.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Text to search for (substring match)" },
            path: {
              type: "string",
              description: "Optional subdirectory relative to workspace (default: whole workspace)",
            },
            max_results: {
              type: "number",
              description: "Cap on result lines (default 80, max 200)",
            },
          },
          required: ["query"],
        },
      },
    },
  ];

  if (allowWrite) {
    tools.splice(2, 0, {
      type: "function",
      function: {
        name: "write_file",
        description:
          "Create or overwrite a UTF-8 text file under the workspace (parent dirs created). Blocked: .env*, SSH private key filenames, .nanobot-runtime/weixin/account.json, .pem/.p12/.pfx.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path from workspace root" },
            content: { type: "string", description: "Full new file contents" },
          },
          required: ["path", "content"],
        },
      },
    });
  }

  if (allowShell) {
    tools.push({
      type: "function",
      function: {
        name: "run_shell",
        description:
          "Run a shell command in the workspace root (non-interactive). Use with care.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "Command to run" },
          },
          required: ["command"],
        },
      },
    });
  }

  return tools;
}
