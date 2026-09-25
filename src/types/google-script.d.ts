interface GoogleScriptRunner {
  withSuccessHandler(handler: (value: unknown) => void): GoogleScriptRunner;
  withFailureHandler(handler: (error: unknown) => void): GoogleScriptRunner;
  [functionName: string]: unknown;
}

declare const google: {
  script: {
    run: GoogleScriptRunner;
  };
};
