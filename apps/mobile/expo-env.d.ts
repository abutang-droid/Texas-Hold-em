/// <reference types="expo/types" />

declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}
