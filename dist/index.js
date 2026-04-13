"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./app/cli");
(0, cli_1.runCli)().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
