#!/usr/bin/env node

/**
 * This starts the HTTP server, and then starts the Websocket server on
 * top of that.
 */

"use strict";

const httpServer = require("./http-server.js"),
	wsServer = require("./chat-server.js");

let server = httpServer.start();
wsServer.start(server);

console.log("---------------------------------------------------------");
console.log("Point your web browser windows to: http://localhost:3490/");
console.log("---------------------------------------------------------");
