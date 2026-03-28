export function buildFileSelectionPrompt(question: string, sourceFiles: string[]): string {
  return `A user asked a question about a codebase. Which files are most likely relevant to answering it?

**Question:** ${question}

**Available files:**
${sourceFiles.join("\n")}

Return a JSON array of the most relevant file paths (max 20 files). Consider the question topic and select files that would contain the answer.
Respond ONLY with a JSON array of strings.`;
}

export function buildAnswerPrompt(
  owner: string,
  repo: string,
  question: string,
  fileContents: Record<string, string>,
): string {
  return `You are a knowledgeable assistant for the ${owner}/${repo} repository. A user has asked a question, and you have access to relevant source files. Answer the question with specific references to the code.

**Question:** ${question}

**Source Files:**
${Object.entries(fileContents)
  .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}

Guidelines:
- Reference specific files and line numbers when explaining concepts
- Use code snippets from the actual source to illustrate your points
- If the source files don't contain enough information to fully answer the question, say so
- Structure your answer clearly with headers if needed
- Be concise but thorough`;
}
