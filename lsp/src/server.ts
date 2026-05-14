#!/usr/bin/env node
import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";
import { registerServer } from "./bootstrap.ts";

const connection = createConnection(ProposedFeatures.all);
registerServer(connection);
connection.listen();
