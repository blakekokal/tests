// The page markup uses inline handlers (onclick="fn()"), which can only see globals.
// Each module lists the functions its markup calls and publishes them here.
export function expose(handlers) {
  Object.assign(window, handlers);
}
