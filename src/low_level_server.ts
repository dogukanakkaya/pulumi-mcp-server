import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { PulumiClient } from './pulumi.js';

const pulumiClient = new PulumiClient(process.env.PULUMI_ACCESS_TOKEN!);

const server = new Server({
  name: "Pulumi MCP Server",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {},
  }
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        name: "Pulumi Stacks",
        uriTemplate: "pulumi://{organization}"
      }
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const organization = uri.split("://")[1];

  const stacks = await pulumiClient.listStacks({ organization });

  return {
    contents: [
      {
        uri,
        text: JSON.stringify(stacks)
      }
    ]
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_pulumi_stack",
        description: "Create a new Pulumi stack",
        inputSchema: {
          type: "object",
          properties: {
            organization: {
              type: "string",
              description: "Organization name to create the stack in",
            },
            project: {
              type: "string",
              description: "Project name",
            },
            stackName: {
              type: "string",
              description: "Stack name",
            },
          },
          required: ["organization", "project", "stackName"],
        },
      }
    ]
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    try {
      if (!request.params.arguments) {
        throw new Error("No arguments provided");
      }

      switch (request.params.name) {
        case "create_pulumi_stack": {
          const { organization, project, stackName } = request.params.arguments as any;
          await pulumiClient.createStack({ organization, project, stackName });

          return {
            content: [{ type: "text", text: `Stack ${project}/${stackName} created in ${organization}` }],
          };
        }

        default:
          throw new Error(`Tool not found: ${request.params.name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);