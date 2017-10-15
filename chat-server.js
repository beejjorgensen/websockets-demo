/**
 * Simple NodeJS websocket demo
 *
 * https://www.npmjs.com/package/websocket
 *
 * For learning purposes only
 */

"use strict";

const websocket = require("websocket");

let wsServer;

// Maintain a list of connections so we know whom to broadcast to
let connectionList = {};

/**
 * Get the object key for a connection.
 *
 * We want to use the connection as a key to reference into connectionList,
 * but you can't use an object as a key. We make a unique key from the
 * connection remote port and IP.
 *
 * (A connection on the Internet is the unique tuple [localIP, localPort,
 * remoteIP, remotePort], but in this case, local port and IP are always the
 * same, so they're not useful as key information, and we ignore them.)
 */
function getConnectionKey(connection) {
	let socket = connection.socket; // The underlying socket

	return socket.remoteAddress + socket.remotePort;
}

/**
 * Store the user name with the connection
 *
 * Hackish. Since we don't have a "change user name" data packet, and the
 * username is transmitted with each packet, we need to check it every time
 * data arrives to see if it has changed.
 *
 * It would be far more Right to have a specific "set-username" request
 * that the client would fire. That's your homework.
 */
function storeUsername(connection, message) {
	if (message.payload && message.payload.username) {

		let k = getConnectionKey(connection);
		let cleanUsername = message.payload.username.trim();

		connectionList[k].username = cleanUsername;
	}
}

/**
 * Message type handlers
 *
 * For specific message types, do the right thing
 */
let messageHandler = {
	/**
	 * When a user joins the chat, add them to the connection list, and
	 * tell everyone else they're here.
	 *
	 * We could simply rebroadcast the incoming message, but we want to
	 * trim the spaces off the username first and/or do other cleanup.
	 */
	"chat-join": function (message) {
		let response = {
			'type': 'chat-join',
			'payload': {
				'username': message.payload.username.trim()
			}
		};

		broadcast(response);
	},

	/**
	 * When a user sends a message, broadcast it to everyone else
	 */
	"chat-message": function (message) {
		let payload = message.payload;
		let text = payload.message.trim();

		// ignore empty messages
		if (text === '') { return; }

		// make a new chat message to broadcast to everyone
		let response = {
			'type': 'chat-message',
			'payload': {
				'username': payload.username.trim(),
				'message': text
			}
		};

		broadcast(response);
	}
};

/**
 * Broadcast a chat message to all connected clients
 *
 * @param response {Object}
 */
function broadcast(response) {
	for (let k in connectionList) if (connectionList.hasOwnProperty(k)) {
		let destConnection = connectionList[k].connection;

		destConnection.send(JSON.stringify(response));
	}
}

/**
 * Connection: Handle incoming messages
 *
 * This is the low-level message accepter.
 */
function onMessage(message) {
	message = JSON.parse(message.utf8Data);

	storeUsername(this, message);

	console.log("Websocket: message: " + this.remoteAddress + ": " + message.type);

	// Try to find the message handler for this message type
	if (message.type in messageHandler) {
		messageHandler[message.type](message, this);
	} else {
		console.log("Websocket: unknown payload type: " + this.remoteAddress + ": " + message.type);
	}
}

/**
 * Connection: Handle close
 */
function onClose(reason, description) {
	let k = getConnectionKey(this);

	// Get the username so we can tell everyone else
	let username = connectionList[k].username;

	// Remove this connection from the list
	delete connectionList[k];

	console.log("Websocket: closed: " + this.remoteAddress + ": " + reason + ": " + description);

	// Tell everyone this user has left
	let response = {
		'type': 'chat-leave',
		'payload': {
			'username': username
		}
	};

	broadcast(response);
}

/**
 * Connection: Handle errors
 */
function onError(error) {
	console.log("Websocket: error: " + this.remoteAddress + ": " + error);
}

/**
 * Returns true if a particular host is in the whitelist
 */
function isWhitelisted(host) {
	// This should contain the URL of the site you're hosting the server
	let whitelist = [
		"localhost",
		"localhost:3490",
		"goat:3490", // my computer on my LAN, so I can test from other hosts
		"192.168.1.2:3490"
	];

	// Return true if we're in the whitelist
	return whitelist.indexOf(host) != -1;
}

/**
 * Server: Handle new connection requests
 *
 * This happens before the connection is opened, and gives us a chance to
 * reject the connection if it comes from an unknown host, or if it is
 * speaking the wrong protocol.
 *
 * We only allow requests from specific URLs. This prevents malicious or
 * other external websites from establishing connections.
 */
function onServerRequest(request) {

	if (!isWhitelisted(request.host)) {
		request.reject(403, "Forbidden");
		console.log("Websocket: denying connection from " + request.host);
		return;
	}

	// Make sure the protocol matches
	// (Note: this should loop through all the requested protocols
	// to see if there's a match, but we know in this case we're
	// only passing one in.)
	if (request.requestedProtocols[0] != 'beej-chat-protocol') {
		request.reject(400, "Unknown protocol");
		console.log("Websocket: unknown protocol");
		return;
	}

	// Ok, we're golden. Accept and specify the protocol.
	request.accept('beej-chat-protocol', request.origin);
	console.log("Websocket: accepted connection from " + request.remoteAddress)

	// at this point, onServerConnect() will be called
}

/**
 * Server: Handle new connections (after being accepted in onServerRequest())
 */
function onServerConnect(connection) {
	let k = getConnectionKey(connection);

	connectionList[k] = {
		'connection': connection
	};

	connection.on('message', onMessage);
	connection.on('error', onError);
	connection.on('close', onClose);
}

/**
 * Server: Handle close
 *
 * This gets called from the server level when a connection closes,
 * but we don't have use for it since we're listening for closes on
 * the connection level.
 */
//function onServerClose(request) {
//}

/**
 * Start the websockets server, attached to this HTTP server
 */
function startWSServer(httpServer) {
	wsServer = new websocket.server({
		httpServer: httpServer
	});

	wsServer.on('request', onServerRequest);
	wsServer.on('connect', onServerConnect);
	//wsServer.on('close', onServerClose);
}

// exports
exports.start = startWSServer;
