/**
 * Tool Access Control Configuration
 * 
 * Maps each MCP tool to its access level:
 * - 'readonly': Available to both read-only and read-write API keys
 * - 'readwrite': Available only to read-write API keys
 */

export type AccessLevel = 'readonly' | 'readwrite';

export interface ToolAccessConfig {
  [toolName: string]: AccessLevel;
}

/**
 * Complete tool access mapping
 * Tools not listed here are treated as 'readwrite' (see getToolAccessLevel)
 */
export const TOOL_ACCESS_MAP: ToolAccessConfig = {
  // ============================================================================
  // TICKET TOOLS
  // ============================================================================
  
  // Read-only ticket tools
  'tdx-ticket-search': 'readonly',
  'tdx-ticket-get': 'readonly',
  'tdx-ticket-count': 'readonly',
  'tdx-ticket-feed-get': 'readonly',
  'tdx-ticket-types-get': 'readonly',
  
  // Read-write ticket tools (modification)
  'tdx-ticket-create': 'readwrite',
  'tdx-ticket-update': 'readwrite',
  'tdx-ticket-patch': 'readwrite',
  'tdx-ticket-feed-add': 'readwrite',
  'tdx-ticket-add-asset': 'readwrite',
  'tdx-ticket-add-contact': 'readwrite',
  
  // ============================================================================
  // ASSET TOOLS
  // ============================================================================
  
  // Read-only asset tools
  'tdx-asset-search': 'readonly',
  'tdx-asset-get': 'readonly',
  'tdx-asset-categories': 'readonly',
  
  // Read-write asset tools (modification)
  'tdx-asset-create': 'readwrite',
  'tdx-asset-update': 'readwrite',
  'tdx-asset-patch': 'readwrite',
  'tdx-asset-delete': 'readwrite',
  'tdx-asset-feed-add': 'readwrite',
  
  // ============================================================================
  // CMDB (CONFIGURATION MANAGEMENT DATABASE) TOOLS
  // ============================================================================
  
  // Read-only CMDB tools
  'tdx-cmdb-search': 'readonly',
  'tdx-cmdb-get': 'readonly',
  
  // Read-write CMDB tools (modification)
  'tdx-cmdb-create': 'readwrite',
  'tdx-cmdb-update': 'readwrite',
  'tdx-cmdb-delete': 'readwrite',
  'tdx-cmdb-feed-add': 'readwrite',
  'tdx-cmdb-add-relationship': 'readwrite',
  
  // ============================================================================
  // KNOWLEDGE BASE (KB) TOOLS
  // ============================================================================
  
  // Read-only KB tools
  'tdx-kb-search': 'readonly',
  'tdx-kb-get': 'readonly',
  
  // Read-write KB tools (modification)
  'tdx-kb-create': 'readwrite',
  'tdx-kb-update': 'readwrite',
  'tdx-kb-delete': 'readwrite',
  
  // ============================================================================
  // PROJECT TOOLS
  // ============================================================================
  
  // Read-only project tools
  'tdx-project-search': 'readonly',
  'tdx-project-get': 'readonly',
  
  // Read-write project tools (modification)
  'tdx-project-create': 'readwrite',
  'tdx-project-update': 'readwrite',
  
  // ============================================================================
  // PEOPLE TOOLS
  // ============================================================================
  
  // Read-only people tools
  'tdx-people-search': 'readonly',
  'tdx-people-get': 'readonly',
  'tdx-people-lookup': 'readonly',
  
  // Read-write people tools (modification)
  'tdx-people-update': 'readwrite',
  
  // ============================================================================
  // ACCOUNT TOOLS (Always read-only)
  // ============================================================================
  'tdx-account-search': 'readonly',
  'tdx-account-get': 'readonly',
  
  // ============================================================================
  // GROUP TOOLS (Always read-only)
  // ============================================================================
  'tdx-group-search': 'readonly',
  'tdx-group-get': 'readonly',
  
  // ============================================================================
  // ATTRIBUTE TOOLS (Always read-only)
  // ============================================================================
  'tdx-attributes-get': 'readonly',
  
  // ============================================================================
  // STATUS TOOLS (Always read-only)
  // ============================================================================
  'tdx-statuses-get': 'readonly',
};


/**
 * Get the access level required for a specific tool
 * Unmapped tools fail closed as 'readwrite' so a newly added write tool is never
 * exposed to a read-only key just because someone forgot to update the map.
 * @param toolName - The name of the tool
 * @returns The access level required ('readonly' or 'readwrite')
 */
export function getToolAccessLevel(toolName: string): AccessLevel {
  const mapped = TOOL_ACCESS_MAP[toolName];
  if (mapped) {
    return mapped;
  }

  console.warn(`[Tool Access] Unmapped tool '${toolName}' - defaulting to 'readwrite' (hidden from read-only keys)`);
  return 'readwrite';
}

/**
 * Remove any tool a key with the given access level is not allowed to see.
 * Used for both tools/list and the /tools endpoint so a read-only key never
 * learns that write tools exist.
 */
export function filterToolsByAccessLevel<T extends { name?: string }>(
  tools: T[],
  keyAccessLevel: AccessLevel
): T[] {
  return tools.filter((tool) => typeof tool?.name === 'string' && canAccessTool(tool.name, keyAccessLevel));
}

/**
 * Check if an API key with the given access level can call a specific tool
 * @param toolName - The name of the tool
 * @param keyAccessLevel - The access level of the API key ('readonly' or 'readwrite')
 * @returns true if the key can call the tool, false otherwise
 */
export function canAccessTool(toolName: string, keyAccessLevel: AccessLevel): boolean {
  const toolAccessLevel = getToolAccessLevel(toolName);
  
  // Read-write keys can access any tool
  if (keyAccessLevel === 'readwrite') {
    return true;
  }
  
  // Read-only keys can only access read-only tools
  return toolAccessLevel === 'readonly';
}

/**
 * Get a summary of tool access levels
 * @returns Object with counts of read-only and read-write tools
 */
export function getAccessSummary() {
  const counts = {
    readonly: 0,
    readwrite: 0,
  };
  
  for (const toolName in TOOL_ACCESS_MAP) {
    const level = TOOL_ACCESS_MAP[toolName];
    counts[level]++;
  }
  
  return counts;
}
