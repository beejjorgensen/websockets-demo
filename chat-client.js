/**
 * Chat client code
 * 
 * Runs in browser
 */
;(function () {
	"use strict";

	// A couple helpers to get elements by ID:
	function qs(sel) { return document.querySelector(sel); }
	function qsa(sel) { return document.querySelectorAll(sel); }

	var ws; // the websocket

	/**
	 * Break down a URL into its components
	 */
	function parseLocation(url) {
		var a = document.createElement('a');
		a.href = url;

		return a;
	}

	/**
	 * Escape HTML special characters
	 *
	 * This prevents people from saying things like
	 * "<script>...</script>" and running scripts from
	 * your chat window!!
	 */
	function escapeHTML(s) {
		return s.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/'/g, '&apos;')
			.replace(/"/g, '&quot;')
			.replace(/\//g, '&sol;');
	}

	/**
	 * Helper function to get the chat username
	 */
	function getChatUsername() {
		return qs('#chat-username').value.trim();
	}

	/**
	 * Helper function to get the chat message
	 */
	function getChatMessage() {
		return qs('#chat-input').value.trim();
	}

	/**
	 * Write something to the output portion of the screen
	 */
	function writeOutput(s) {
		var chatOutput = qs('#chat-output');
		var innerHTML = chatOutput.innerHTML;

		// Add a newline before new output
		var newOutput = innerHTML === ''? s: '<br/>' + s;

		chatOutput.innerHTML = innerHTML + newOutput;

		// Scroll to bottom
		chatOutput.scrollTop = chatOutput.scrollHeight;
	}

	/**
	 * Send a message to the server
	 */
	function sendMessage(type, payload) {
		ws.send(makeMessage(type, payload));
	}

	/**
	 * Construct a message
	 */
	function makeMessage(type, payload) {
		return JSON.stringify({
			'type': type,
			'payload': payload
		});
	}

	/**
	 * Send a chat message
	 */
	function send() {
		sendMessage('chat-message', {
			"username": getChatUsername(),
			"message": getChatMessage()
		});

		// Clear the input field after sending
		qs('#chat-input').value = '';
	}

	/**
	 * Make [RETURN] the same as the send button for convenience
	 */
	function onChatInputKeyUp(ev) {
		if (ev.keyCode === 13) { // 13 is RETURN
			send();
		}
	}

	/**
	 * When the socket opens
	 */
	function onSocketOpen(ev) {
		writeOutput("<i>Connection opened.</i>");

		sendMessage('chat-join', {
			"username": getChatUsername()
		});
	}

	/**
	 * When the socket closes
	 */
	function onSocketClose(ev) {
		writeOutput("<i>Connection closed.</i>");
	}

	/**
	 * When the socket errors
	 */
	function onSocketError(ev) {
		writeOutput("<i>Connection error.</i>");
	}

	/**
	 * When the socket receives a message
	 */
	function onSocketMessage(ev) {
		var msg = JSON.parse(ev.data);
		var payload = msg.payload;

		// Sanitize HTML string
		var username = escapeHTML(payload.username);

		switch (msg.type) {
			case 'chat-message':
				writeOutput('<b>' + username + ":</b> " + escapeHTML(payload.message));
				break;

			case 'chat-join':
				writeOutput('<i><b>' + username + '</b> has joined the chat.</i>');
				break;

			case 'chat-leave':
				writeOutput('<i><b>' + username + '</b> has left the chat.</i>');
				break;
		}
	}

	/**
	 * Once the page has loaded
	 */
	function onLoad() {
		var localURL = parseLocation(window.location);

		qs('#chat-input').addEventListener('keyup', onChatInputKeyUp);
		qs('#chat-send').addEventListener('click', send);

		// Create WebSocket
		ws = new WebSocket("ws://" + localURL.host, "beej-chat-protocol");

		ws.addEventListener('open', onSocketOpen);
		ws.addEventListener('close', onSocketClose);
		ws.addEventListener('error', onSocketError);
		ws.addEventListener('message', onSocketMessage);

		var userName = getChatUsername().trim();

		if (userName === '') {
			qs('#chat-username').value = 'Guest ' +
				((Math.random()*0xffff)|0).toString(16);
		}
	}

	// Wait for load event before starting
	window.addEventListener('load', onLoad);
}());
