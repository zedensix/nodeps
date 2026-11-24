declare const NODEPS_VERSION: string | undefined;

export const version = typeof NODEPS_VERSION === "undefined" ? "dev" : NODEPS_VERSION;
