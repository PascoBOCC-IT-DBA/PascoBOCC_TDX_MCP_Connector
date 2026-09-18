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
 * Tools not listed here default to 'readonly'
 */
export const TOOL_ACCESS_MAP: ToolAccessConfig = {
  // ============================================================================
  // TICKET TOOLS
  // ============================================================================
  
  // Read-only ticket tools
  'ticket-search': 'readonly',
  'ticket-get': 'readonly',
  'ticket-count': 'readonly',
  'ticket-feed-get': 'readonly',
  
  // Read-write ticket tools (modification)
  'ticket-create': 'readwrite',
  'ticket-update': 'readwrite',
  'ticket-patch': 'readwrite',
  'ticket-feed-add': 'readwrite',
  'ticket-add-asset': 'readwrite',
  'ticket-add-contact': 'readwrite',
  
  // ============================================================================
  // ASSET TOOLS
  // ============================================================================
  
  // Read-only asset tools
  'asset-search': 'readonly',
  'asset-get': 'readonly',
  'asset-categories': 'readonly',
  
  // Read-write asset tools (modification)
  'asset-create': 'readwrite',
  'asset-update': 'readwrite',
  'asset-patch': 'readwrite',
  'asset-delete': 'readwrite',
  'asset-feed-add': 'readwrite',
  
  // ============================================================================
  // CMDB (CONFIGURATION MANAGEMENT DATABASE) TOOLS
  // ============================================================================
  
  // Read-only CMDB tools
  'cmdb-search': 'readonly',
  'cmdb-get': 'readonly',
  
  // Read-write CMDB tools (modification)
  'cmdb-create': 'readwrite',
  'cmdb-update': 'readwrite',
  'cmdb-delete': 'readwrite',
  'cmdb-feed-add': 'readwrite',
  'cmdb-add-relationship': 'readwrite',
  
  // ============================================================================
  // KNOWLEDGE BASE (KB) TOOLS
  // ============================================================================
  
  // Read-only KB tools
  'kb-search': 'readonly',
  'kb-get': 'readonly',
  
  // Read-write KB tools (modification)
  'kb-create': 'readwrite',
  'kb-update': 'readwrite',
  'kb-delete': 'readwrite',
  
  // ============================================================================
  // PROJECT TOOLS
  // ============================================================================
  
  // Read-only project tools
  'project-search': 'readonly',
  'project-get': 'readonly',
  
  // Read-write project tools (modification)
  'project-create': 'readwrite',
  'project-update': 'readwrite',
  
  // ============================================================================
  // PEOPLE TOOLS
  // ============================================================================
  
  // Read-only people tools
  'people-search': 'readonly',
  'people-get': 'readonly',
  'people-lookup': 'readonly',
  
  // Read-write people tools (modification)
  'people-update': 'readwrite',
  
  // ============================================================================
  // ACCOUNT TOOLS (Always read-only)
  // ============================================================================
  'account-search': 'readonly',
  'account-get': 'readonly',
  
  // ============================================================================
  // GROUP TOOLS (Always read-only)
  // ============================================================================
  'group-search': 'readonly',
  'group-get': 'readonly',
  
  // ============================================================================
  // ATTRIBUTE TOOLS (Always read-only)
  // ============================================================================
  'attributes-get': 'readonly',
  
  // ============================================================================
  // STATUS TOOLS (Always read-only)
  // ============================================================================
  'statuses-get': 'readonly',
};

/**
 * Get the access level required for a specific tool
 * @param toolName - The name of the tool
 * @returns The access level required ('readonly' or 'readwrite')
 */
export function getToolAccessLevel(toolName: string): AccessLevel {
  return TOOL_ACCESS_MAP[toolName] || 'readonly';
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
