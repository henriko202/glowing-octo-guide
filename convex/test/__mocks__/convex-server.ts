// Minimal stub of convex/server for use in vitest unit tests.
// Only stubs the symbols used in source files; actual Convex runtime behaviour
// is not needed for unit tests that exercise plain handler functions.

export function internalMutation(_def: any) {
  return _def;
}

export function internalQuery(_def: any) {
  return _def;
}

export function internalAction(_def: any) {
  return _def;
}

export function query(_def: any) {
  return _def;
}

export function action(_def: any) {
  return _def;
}

export function mutation(_def: any) {
  return _def;
}

export function cronJobs() {
  return {
    hourly: () => {},
    daily: () => {},
    weekly: () => {},
    monthly: () => {},
    interval: () => {},
    cron: () => {},
  };
}

export function httpRouter() {
  return {
    route: () => {},
  };
}

export function httpAction(fn: any) {
  return fn;
}

export function makeFunctionReference<_T extends string>(path: string) {
  return path as any;
}
