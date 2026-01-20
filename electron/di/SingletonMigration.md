/**
 * Singleton Migration Guide
 *
 * This documents the migration of global singletons to the DI container.
 *
 * ## Current Singletons to Migrate:
 *
 * ### High Priority (Direct dependencies):
 * 1. ✅ configStore - Already in DI container
 * 2. ✅ sessionStore - Already in DI container
 * 3. ✅ taskDatabase - Already in DI container
 * 4. ✅ permissionManager - Already in DI container
 * 5. ✅ logs/logger - Already in DI container
 * 6. ✅ performanceMonitor - Already in DI container
 * 7. ✅ cacheManager - Already in DI container
 *
 * ### Medium Priority (Services):
 * 8. ipcService (electron/services/IPCService.ts) - Needs migration
 *
 * ## Migration Strategy:
 *
 * ### Phase 1: Keep backward compatibility
 * - Export both the DI container access and the singleton
 * - Deprecation warning on direct singleton usage
 * - Gradual migration of consumers
 *
 * ### Phase 2: Update consumers
 * - Replace direct imports with DI container usage
 * - Update tests to use container
 *
 * ### Phase 3: Remove deprecated exports
 * - Remove singleton exports after all consumers migrated
 */

/**
 * MIGRATION STATUS:
 *
 * ✅ Completed:
 * - configStore
 * - sessionStore
 * - taskDatabase
 * - permissionManager
 * - logger
 * - performanceMonitor
 * - cacheManager
 *
 * ⏳ In Progress:
 * - IPCService (electron/services/)
 *
 * 📋 Pending:
 * - Update AgentRuntime to use DI container
 * - Update main.ts to use DI container
 * - Update IPC handlers to use DI container
 */

export {};
