import { z } from 'zod';

/**
 * Pulumi API SDK
 * 
 * This module provides functions to interact with the Pulumi Cloud REST API.
 * 
 * @see https://www.pulumi.com/docs/pulumi-cloud/reference/cloud-rest-api/
 */

// Common types
export interface PulumiError {
  code: number;
  message: string;
}

export interface Stack {
  orgName: string;
  projectName: string;
  stackName: string;
  links: {
    self: string;
  };
}

const createStackSchema = z.object({
  organization: z.string().min(1, "Organization name is required"),
  project: z.string().min(1, "Project name is required"),
  stackName: z.string().min(1, "Stack name is required"),
});

export type CreateStackInput = z.infer<typeof createStackSchema>;

export interface ListStacksResponse {
  stacks: Stack[];
}

const listStacksSchema = z.object({
  organization: z.string().optional(),
  project: z.string().optional(),
  tagName: z.string().optional(),
  tagValue: z.string().optional(),
  continuationToken: z.string().optional(),
});

export type ListStacksInput = z.infer<typeof listStacksSchema>;

export class PulumiClient {
  private readonly baseUrl = 'https://api.pulumi.com';
  private token: string;

  /**
   * Creates a new Pulumi API client
   * 
   * @param token The Pulumi access token
   */
  constructor(token: string) {
    this.token = token;
  }

  /**
   * Creates a new stack in the specified organization and project
   * 
   * POST /api/stacks/{organization}/{project}
   * 
   * @param input The input parameters for creating a stack
   * @returns void
   * @see https://www.pulumi.com/docs/pulumi-cloud/reference/cloud-rest-api/#create-stack
   */
  async createStack(input: CreateStackInput) {
    try {
      createStackSchema.parse(input);

      const { organization, project, stackName } = input;

      const url = `/api/stacks/${organization}/${project}`;
      await this.request(url, {
        method: 'POST',
        body: JSON.stringify({ stackName }),
      });

      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw {
          code: 400,
          message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        } as PulumiError;
      }

      throw error;
    }
  }

  /**
   * Lists stacks in the specified organization and project
   * 
   * GET /api/user/stacks?
   * 
   * @param input The input parameters for listing stacks
   * @returns A promise that resolves to the list of stacks
   * @see https://www.pulumi.com/docs/pulumi-cloud/reference/cloud-rest-api/#list-stacks
   */
  async listStacks(input: ListStacksInput): Promise<ListStacksResponse> {
    try {
      listStacksSchema.parse(input);

      const { organization, project, tagName, tagValue, continuationToken } = input;

      const queryParams = new URLSearchParams();
      if (organization) {
        queryParams.append('organization', organization);
      }
      if (project) {
        queryParams.append('project', project);
      }
      if (continuationToken) {
        queryParams.append('continuationToken', continuationToken);
      }
      if (tagName) {
        queryParams.append('tagName', tagName);
      }
      if (tagValue) {
        queryParams.append('tagValue', tagValue);
      }

      const url = `/api/user/stacks?${queryParams.toString()}`;

      return this.request(url);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw {
          code: 400,
          message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        } as PulumiError;
      }

      throw error;
    }
  }

  /**
   * Makes an HTTP request to the Pulumi API
   * 
   * @param url The URL to request
   * @param init @RequestInit
   * @returns A promise that resolves to the response data
   */
  private async request<T = unknown>(url: string, init?: RequestInit) {
    const response = await fetch(this.baseUrl.concat(url), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.pulumi+8',
        Authorization: `token ${this.token}`,
        ...init?.headers
      }
    })

    if (response.status >= 400) throw (await response.json())
    if (response.status === 204) return null as T

    return response.json() as Promise<T>
  }
}
