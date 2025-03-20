import 'dotenv/config';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PulumiClient } from './pulumi.js';

const pulumiClient = new PulumiClient(process.env.PULUMI_ACCESS_TOKEN!);

const server = new McpServer({
  name: "Pulumi MCP Server",
  version: "1.0.0"
});

server.tool("create-stack",
  {
    organization: z.string().min(1, "Organization name is required"),
    project: z.string().min(1, "Project name is required"),
    stackName: z.string().min(1, "Stack name is required"),
  },
  async ({ organization, project, stackName }) => {
    await pulumiClient.createStack({ organization, project, stackName });

    return {
      content: [{ type: "text", text: `Stack ${project}/${stackName} created in ${organization}` }]
    };
  }
);

server.resource(
  "stacks",
  new ResourceTemplate("stacks://{organization}", { list: undefined }),
  async (uri, { organization }) => {
    const stacks = await pulumiClient.listStacks({ organization: organization as string });

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(stacks)
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);