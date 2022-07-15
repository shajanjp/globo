import {
  WebSocketClient,
  WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { serve } from "https://deno.land/std@0.148.0/http/server.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
const wss = new WebSocketServer(8080);
const port = 3000;

wss.on("connection", (ws: WebSocketClient) => {
  console.log("connection");
  ws.on("message", (message: string) => {
    console.log(message);
    ws.send(message);
  });
  ws.on("close", () => {
    removeFromSocketPool(ws);
  });
});

const handler = (request: Request): Response => {
  const path = request.url.split("/")[3];
  let responseBody = {};

  switch (path) {
    case "broadcast": {
      broadcastMessage("sample message");

      responseBody = {
        status: "done",
      };
    }
  }

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
};

function removeFromSocketPool(sock) {
  console.log("remove", sock);
}

function broadcastMessage(message: string) {
  for (const client of wss.clients) {
    client.send(message);
  }
}

console.log(`HTTP webserver running. Access it at: http://localhost:8080/`);
await serve(handler, { port });
