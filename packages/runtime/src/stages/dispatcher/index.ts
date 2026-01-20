/**
 * Dispatcher stages - handles event routing and agent dispatch orchestration.
 */

export { runDispatch } from "./dispatch";
export { runGlobalPreflight } from "./global-preflight";
export { runRoute } from "./route";
export type { DispatcherContext, RoutingRule } from "./types";
