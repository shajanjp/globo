const server = Deno.listen({ port: 8080 });
const socketPool: Set<any> = new Set();

for await (const conn of server) {
  handle(conn);
}

async function handle(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    await requestEvent.respondWith(handleReq(requestEvent.request));
  }
}

function handleReq(req: Request): Response {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return apiHandler(req);
    // return new Response("request isn't trying to upgrade to websocket.");
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.onopen = () => {
    socketPool.add(socket);
    console.log("socket opened");
  };
  socket.onmessage = (e) => {
    console.log("socket message:", e.data);
    socket.send(new Date().toString());
  };
  socket.onerror = (e) => console.log("socket errored:", e);
  socket.onclose = () => {
    socketPool.delete(socket);
  };
  return response;
}

function apiHandler(request: Request): Response {
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
}

function broadcastMessage(message: string) {
  for (const client of socketPool) {
    client.send("test message");
  }
}
