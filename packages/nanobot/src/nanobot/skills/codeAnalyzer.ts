/**
 * 代码分析工具 - 提供代码结构分析、依赖分析等功能
 * 对应技能：代码理解、重构建议、架构分析
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative, extname, dirname, join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", 
  "__pycache__", ".venv", "venv", "coverage"
]);

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".scala",
  ".cpp", ".c", ".h", ".hpp", ".cc",
  ".rb", ".php", ".swift"
]);

export interface FileAnalysis {
  path: string;
  imports: string[];
  exports: string[];
  classes: string[];
  functions: string[];
  complexity: number;
}

export interface ProjectStructure {
  totalFiles: number;
  totalLines: number;
  languages: Map<string, { files: number; lines: number }>;
  entryPoints: string[];
  deepestPath: number;
}

/**
 * 分析单个代码文件
 */
export async function analyzeCodeFile(filePath: string, root: string): Promise<FileAnalysis | null> {
  const ext = extname(filePath).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) return null;
  
  try {
    const content = await readFile(filePath, "utf8");
    const relPath = relative(root, filePath);
    
    const lines = content.split("\n");
    const imports: string[] = [];
    const exports: string[] = [];
    const classes: string[] = [];
    const functions: string[] = [];
    let complexity = 1;
    
    // TypeScript/JavaScript 分析
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Import detection
        if (trimmed.match(/^import\s+/)) {
          const match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
          if (match) imports.push(match[1]);
        }
        if (trimmed.match(/^require\s*\(/)) {
          const match = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
          if (match) imports.push(match[1]);
        }
        
        // Export detection
        if (trimmed.match(/^export\s+/)) {
          const nameMatch = trimmed.match(/export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)?\s+(\w+)/);
          if (nameMatch) exports.push(nameMatch[1]);
        }
        
        // Class detection
        const classMatch = trimmed.match(/(?:export\s+)?class\s+(\w+)/);
        if (classMatch) classes.push(classMatch[1]);
        
        // Function detection
        const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) functions.push(funcMatch[1]);
        
        // Arrow function exports
        const arrowMatch = trimmed.match(/export\s+(?:const|let|var)\s+(\w+)\s*[=:]/);
        if (arrowMatch) functions.push(arrowMatch[1]);
        
        // Complexity (simple count of branches)
        if (/\b(if|else|for|while|switch|case|catch|\?\s*[^;]+\s*:)/.test(trimmed)) {
          complexity++;
        }
      }
    }
    
    // Python 分析
    if (ext === ".py") {
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.match(/^(import|from)\s+/)) {
          imports.push(trimmed);
        }
        
        const classMatch = trimmed.match(/^class\s+(\w+)/);
        if (classMatch) classes.push(classMatch[1]);
        
        const funcMatch = trimmed.match(/^def\s+(\w+)/);
        if (funcMatch) functions.push(funcMatch[1]);
        
        if (/\b(if|else|elif|for|while|with|try|except)/.test(trimmed)) {
          complexity++;
        }
      }
    }
    
    return {
      path: relPath,
      imports: [...new Set(imports)],
      exports: [...new Set(exports)],
      classes: [...new Set(classes)],
      functions: [...new Set(functions)],
      complexity
    };
  } catch {
    return null;
  }
}

/**
 * 扫描项目结构
 */
export async function scanProjectStructure(root: string): Promise<ProjectStructure> {
  const result: ProjectStructure = {
    totalFiles: 0,
    totalLines: 0,
    languages: new Map(),
    entryPoints: [],
    deepestPath: 0
  };
  
  async function walk(dir: string, depth: number): Promise<void> {
    result.deepestPath = Math.max(result.deepestPath, depth);
    
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      
      const full = resolve(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, depth + 1);
      } else if (e.isFile()) {
        const ext = extname(e.name).toLowerCase();
        if (!CODE_EXTENSIONS.has(ext)) continue;
        
        try {
          const content = await readFile(full, "utf8");
          const lines = content.split("\n").length;
          
          result.totalFiles++;
          result.totalLines += lines;
          
          const lang = ext.slice(1);
          const curr = result.languages.get(lang) || { files: 0, lines: 0 };
          curr.files++;
          curr.lines += lines;
          result.languages.set(lang, curr);
          
          // Detect entry points
          const name = e.name.toLowerCase();
          if (
            name === "index.ts" || name === "index.js" ||
            name === "main.ts" || name === "main.js" ||
            name === "app.ts" || name === "app.js" ||
            name === "cli.ts" || name === "server.ts"
          ) {
            result.entryPoints.push(relative(root, full));
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }
  
  await walk(root, 0);
  return result;
}

/**
 * 生成项目概览报告
 */
export async function generateProjectReport(root: string): Promise<string> {
  const structure = await scanProjectStructure(root);
  
  const parts: string[] = [];
  parts.push("📊 Project Overview");
  parts.push("═".repeat(40));
  parts.push(`Total Files: ${structure.totalFiles.toLocaleString()}`);
  parts.push(`Total Lines: ${structure.totalLines.toLocaleString()}`);
  parts.push(`Max Directory Depth: ${structure.deepestPath}`);
  parts.push("");
  
  parts.push("📁 Languages:");
  const sortedLangs = [...structure.languages.entries()].sort((a, b) => b[1].lines - a[1].lines);
  for (const [lang, info] of sortedLangs) {
    const pct = ((info.lines / structure.totalLines) * 100).toFixed(1);
    parts.push(`  ${lang.padEnd(12)} ${info.files.toString().padStart(4)} files  ${info.lines.toLocaleString().padStart(8)} lines (${pct}%)`);
  }
  parts.push("");
  
  if (structure.entryPoints.length > 0) {
    parts.push("🚪 Likely Entry Points:");
    for (const ep of structure.entryPoints.slice(0, 10)) {
      parts.push(`  • ${ep}`);
    }
  }
  
  return parts.join("\n");
}

/**
 * 查找文件间的循环依赖
 */
export function detectCircularDeps(analyses: FileAnalysis[]): string[][] {
  const graph = new Map<string, Set<string>>();
  
  // Build dependency graph
  for (const a of analyses) {
    const deps = new Set<string>();
    for (const imp of a.imports) {
      // Match relative imports
      if (imp.startsWith(".") || imp.startsWith("/")) {
        deps.add(imp);
      }
    }
    graph.set(a.path, deps);
  }
  
  // Find cycles (simple DFS)
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  
  function dfs(node: string): void {
    if (stack.has(node)) {
      // Found cycle
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;
    
    visited.add(node);
    stack.add(node);
    path.push(node);
    
    const deps = graph.get(node) || new Set();
    for (const dep of deps) {
      // Resolve relative path to find in analyses
      const resolved = analyses.find(a => 
        a.path === dep || 
        a.path.replace(/\.(ts|tsx|js|jsx)$/, "") === dep
      );
      if (resolved) {
        dfs(resolved.path);
      }
    }
    
    path.pop();
    stack.delete(node);
  }
  
  for (const [node] of graph) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}
