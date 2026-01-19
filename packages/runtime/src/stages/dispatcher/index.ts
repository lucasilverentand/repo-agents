/**
 * Dispatcher stages - handles event routing and agent dispatch orchestration.
 */

export { runDispatch } from "./dispatch";
export { runGlobalPreflight } from "./global-preflight";
export { runPrepareContext } from "./prepare-context";
export { runRoute } from "./route";
export type { DispatchContext, DispatcherContext, RoutingRule } from "./types";
