#!/usr/bin/env node
import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";
import { registerServer } from "./bootstrap.ts";
import { createNodeWorkspaceHost } from "./workspace/host-node.ts";

const connection = createConnection(ProposedFeatures.all);
registerServer(connection, { workspaceHost: createNodeWorkspaceHost() });
connection.listen();
