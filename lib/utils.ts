import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type JsonSafe<T> = T extends bigint ? string : T extends Date ? string : T extends Array<infer U> ? JsonSafe<U>[] : T extends object ? { [K in keyof T]: JsonSafe<T[K]> } : T;

export function jsonSafe<T>(value: T): JsonSafe<T> {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item)) as JsonSafe<T>;
}
