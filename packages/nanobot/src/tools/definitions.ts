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
    {
      type: "function",
      function: {
        name: "git_status",
        description: "Get the current git status of the workspace (branch, modified files, untracked files).",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "git_diff",
        description: "Get the diff of changes in the workspace. Can show staged changes, unstaged changes, or both.",
        parameters: {
          type: "object",
          properties: {
            staged: { 
              type: "boolean", 
              description: "Show staged changes (default: false shows unstaged)" 
            },
            path: {
              type: "string",
              description: "Optional specific file path to diff",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "file_stats",
        description: "Get statistics about files in the workspace: line counts, file types, sizes. Can target a specific subdirectory.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Optional subdirectory to analyze (default: whole workspace)",
            },
            top_n: {
              type: "number",
              description: "Number of largest files to show (default: 10)",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_package_info",
        description: "Read and summarize package.json from the workspace, including scripts, dependencies, and project metadata.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    // ===== Utility Tools =====
    {
      type: "function",
      function: {
        name: "calculate",
        description: "Evaluate a mathematical expression. Supports basic math (+, -, *, /, %, **), bitwise operations, and common functions (abs, round, floor, ceil, sqrt, min, max, sin, cos, tan, log, exp).",
        parameters: {
          type: "object",
          properties: {
            expression: { 
              type: "string", 
              description: "Mathematical expression to evaluate, e.g., '2 + 2 * 3', 'sqrt(16)', 'max(1, 5, 3)'" 
            },
          },
          required: ["expression"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "hash",
        description: "Calculate hash of a string or file. Supported algorithms: md5, sha1, sha256, sha512.",
        parameters: {
          type: "object",
          properties: {
            input: { 
              type: "string", 
              description: "String to hash, or file path (relative to workspace) if is_file is true" 
            },
            algorithm: { 
              type: "string", 
              enum: ["md5", "sha1", "sha256", "sha512"],
              description: "Hash algorithm to use (default: sha256)" 
            },
            is_file: {
              type: "boolean",
              description: "If true, treat input as a file path instead of string",
            },
          },
          required: ["input"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "uuid",
        description: "Generate UUIDs or random strings. Useful for creating unique identifiers.",
        parameters: {
          type: "object",
          properties: {
            version: { 
              type: "string", 
              enum: ["v4", "v7", "nanoid"],
              description: "UUID version: v4 (random), v7 (time-sortable), nanoid (URL-friendly)" 
            },
            count: {
              type: "number",
              description: "Number of UUIDs to generate (default: 1, max: 10)",
            },
            length: {
              type: "number",
              description: "For nanoid: length of the ID (default: 21)",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "datetime",
        description: "Get current date and time information, or format a timestamp. Supports multiple timezones.",
        parameters: {
          type: "object",
          properties: {
            format: { 
              type: "string", 
              description: "Output format: 'iso', 'locale', 'date', 'time', 'full', or custom strftime format (default: iso)" 
            },
            timezone: { 
              type: "string", 
              description: "Timezone, e.g., 'UTC', 'America/New_York', 'Asia/Shanghai' (default: local)" 
            },
            timestamp: {
              type: "number",
              description: "Unix timestamp to format (ms). If omitted, uses current time.",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "env_info",
        description: "Get environment information: Node.js version, OS platform, CPU architecture, available memory, etc.",
        parameters: {
          type: "object",
          properties: {
            detail: { 
              type: "string", 
              enum: ["basic", "full"],
              description: "Level of detail: 'basic' (default) or 'full' for more system info" 
            },
          },
        },
      },
    },
    // ===== Todo Management Tools =====
    {
      type: "function",
      function: {
        name: "todo_add",
        description: "Add a new todo task to the workspace todo list.",
        parameters: {
          type: "object",
          properties: {
            title: { 
              type: "string", 
              description: "Title of the todo task (required)" 
            },
            description: { 
              type: "string", 
              description: "Optional detailed description" 
            },
            priority: { 
              type: "string", 
              enum: ["low", "medium", "high"],
              description: "Priority level (default: medium)" 
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization",
            },
            dueAt: {
              type: "number",
              description: "Optional due date as Unix timestamp (milliseconds)",
            },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "todo_list",
        description: "List todos with optional filtering by status, priority, or tag.",
        parameters: {
          type: "object",
          properties: {
            status: { 
              type: "string", 
              enum: ["pending", "in_progress", "done", "all"],
              description: "Filter by status (default: all)" 
            },
            priority: { 
              type: "string", 
              enum: ["low", "medium", "high"],
              description: "Filter by priority" 
            },
            tag: {
              type: "string",
              description: "Filter by tag name",
            },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "todo_update",
        description: "Update an existing todo by ID. Can change status, priority, title, description, or tags.",
        parameters: {
          type: "object",
          properties: {
            id: { 
              type: "string", 
              description: "Todo ID or prefix (required)" 
            },
            title: { 
              type: "string", 
              description: "New title" 
            },
            description: { 
              type: "string", 
              description: "New description" 
            },
            status: { 
              type: "string", 
              enum: ["pending", "in_progress", "done"],
              description: "New status" 
            },
            priority: { 
              type: "string", 
              enum: ["low", "medium", "high"],
              description: "New priority" 
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "New tags (replaces existing)",
            },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "todo_delete",
        description: "Delete a todo by ID.",
        parameters: {
          type: "object",
          properties: {
            id: { 
              type: "string", 
              description: "Todo ID or prefix (required)" 
            },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "todo_stats",
        description: "Get statistics about todos: total count, completion rate, by status and priority.",
        parameters: {
          type: "object",
          properties: {},
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
