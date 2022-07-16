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
    broadcastMessage(e.data);
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

  console.log("resource", resource);

  switch (resource) {
    case "broadcast": {
      return handleBroadcastRequest(request, params);
    }

    case "": {
      return handleRootRequest();
    }

    default: {
      return handleRootRequest();
    }
  }
}

async function handleRootRequest() {
  const HTML = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Globo</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100%;
        padding: 0px;
        margin: 0px;
        background: #efefef;
        font-family: Verdana, sans-serif;
      }
      
      .button-group {
        display: flex;
        box-shadow: 0 0.5em 1.5em #CCC;
        transition: all 0.2s ease-in-out;
        
        justify-content: center;
        height: 3em;
        overflow: hidden;
      }
      
      .button-group:hover {
        transition: all 0.2s ease-in-out;
        box-shadow: 0 0.5em 1.5em #AAA;
      }
      
      .button-group div {
        display: inline-block;
      }
      
      #next-button {
        background-color: white;
        color: #555;
        cursor: pointer;
        line-height: 3em;
        text-align: center;
        padding: 0px 1em;
        text-transform: capitalize;
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none; /* Safari */
        -khtml-user-select: none; /* Konqueror HTML */
        -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
        user-select: none; /* Non-prefixed version, currently
        supported by Chrome, Edge, Opera and Firefox */
      }
      
      #next-color {
        background-color: red;
        width: 3em;
        height: 3em;
      }

      #selected-color {
        position: fixed;
        bottom: -5em;
        height: 5em;
        width: 100%;
        /* background: red; */
        box-shadow: 0px -1em 6em white;
      }

      #message{
        position: fixed;
        padding: 1em; 
        text-align: center;
        top: 1em;
        width: 80vw;
        border: 2px solid #888;
      }

      #message span{
        color: red;
        position: absolute;
        right: 1em;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div id="selected-color"></div>
    <div class="button-group">
      <div id="next-color"></div>  
      <div id="next-button" onclick="setNextColor()">Send ambient notification</div>
    </div>
  
    <div id="message">
      <span title="close" onclick="closeHint()">X</span>
      <p>
        Click on the below button to send a notification to my table lamp. A random color is selected everytime you click the button.
      </p>  
      <p>
        The color you see in the bottom is the current color of my table lamp. If the color is changing without your interaction, someone else is playing with it. Read more details about the lamp here.  
      </p>
    </div>
  
    <script>
      const nextColor = document.getElementById('next-color');
      const selectedColor =  document.getElementById('selected-color');
      const messageBox = document.getElementById('message'); 
      const colors = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 0 }, { r: 0, g: 255, b: 255 }, { r: 255, g: 0, b: 255 }];
      let currentColorIndex = 0;
      const socket = new WebSocket('wss://globo.deno.dev');
      
  
      socket.addEventListener('open', function (event) {
        socket.send('hello from visitor');
      });
      
      // Listen for messages
      socket.addEventListener('message', function (event) {
        console.log('Message from server', event.data);
        
        try {
          setSelectedColor(JSON.parse(event.data));
        } catch(e){}
      });
  
      function setNextColor(){
        if(currentColorIndex == colors.length - 1) {
          currentColorIndex = 0;
        } else {
          currentColorIndex++;
        }
        console.log(getRGBColorString(colors[currentColorIndex]))
        socket.send(JSON.stringify(colors[currentColorIndex]))
        setSelectedColor(colors[currentColorIndex]);
        nextColor.style.backgroundColor = getRGBColorString(colors[currentColorIndex]);
      }
       
      function setSelectedColor(rgbColor){
        console.log('0px -1em 6em ' + getRGBColorString(rgbColor), rgbColor);
        selectedColor.style.boxShadow = '0px -1em 6em ' + getRGBColorString(rgbColor);
      }
  
      function getRGBColorString(rgbColor){
        return 'rgb(' + rgbColor.r +','+ rgbColor.g + ','+ rgbColor.b + ')' 
      }
  
      function closeHint(){
        messageBox.style.display = 'none';
      }
    </script>
  </body>
  </html>`;

  return new Response(HTML, {
    headers: {
      "content-type": "text/html",
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

  return new Response(
    JSON.stringify({
      message: "message broadcasted successfully",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

function broadcastMessage(message: string) {
  for (const client of socketPool) {
    client.send(message);
  }
}

process.on("unhandledRejection", (e) => console.log(e));
