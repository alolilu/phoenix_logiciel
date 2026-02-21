export const PhoenixRoles = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type PhoenixRole = (typeof PhoenixRoles)[keyof typeof PhoenixRoles];
