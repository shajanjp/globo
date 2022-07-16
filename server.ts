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
  const resourcePath = request.url.split("/")[3];
  const [resource, params] = resourcePath.split("?");
  let body = {};
  let status = 200;

  switch (resource) {
    case "broadcast": {
      ({ body, status } = handleBroadcastRequest(request, params));
    }
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function handleBroadcastRequest(request, params) {
  let queryParams = params.split("&").reduce((acc, obj) => {
    const paramSplit = obj.split("=");
    acc[paramSplit[0]] = paramSplit[1];

    return acc;
  }, {});

  broadcastMessage(queryParams.message);

  return {
    body: {
      status: "success",
    },
    status: 204,
  };
}

function broadcastMessage(message: string) {
  for (const client of socketPool) {
    client.send(message);
  }
}

process.on("unhandledRejection", (e) => console.log(e));
