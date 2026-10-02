/**
 * Routes that are referenced from more than one place.
 *
 * `health` is the only one so far, and it has to agree between the controller
 * that serves it, the global prefix that excludes it and the Docker health
 * check that polls it.
 */
export const HEALTH_ROUTE = 'health';
