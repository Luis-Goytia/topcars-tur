import express from "express";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

export function createSwaggerRouter() {
  const router = express.Router();

  const openApiPath = path.join(__dirname, "..", "..", "openapi.yaml");
  let openApiDocument: any;

  try {
    const file = fs.readFileSync(openApiPath, "utf8");
    openApiDocument = YAML.parse(file);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("OpenAPI spec not found or invalid, swagger UI will be minimal.", err);
    openApiDocument = {
      openapi: "3.0.0",
      info: {
        title: "Top Cars Reviews API",
        version: "0.1.0",
      },
      paths: {},
    };
  }

  router.use("/", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Optional: serve raw spec
  router.get("/openapi.yaml", (_req, res) => {
    res.sendFile(openApiPath);
  });

  return router;
}

