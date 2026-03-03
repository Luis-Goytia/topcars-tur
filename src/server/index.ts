import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.PORT) || 3000;

const server = createServer(app);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Top Cars Reviews API listening on http://localhost:${port}`);
});

