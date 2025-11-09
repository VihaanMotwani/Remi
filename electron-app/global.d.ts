declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Types for the preload-exposed API
declare global {
  interface Window {
    api: {
      platform: string;
      ping: () => Promise<string>;
      orchestrate: () => Promise<{ success: boolean; output: string; error?: string }>;
    };
  }
}
